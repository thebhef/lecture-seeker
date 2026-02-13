# CLAUDE.md - Lecture Seeker

## Project Overview

Lecture Seeker is a Bay Area event aggregator that scrapes university and athletics calendars, normalizes the data, and presents it in a filterable calendar UI. Users can download `.ics` invites or email them directly (no persistent email logging).

## Architecture

**Monorepo** using npm workspaces with three packages:

```
lecture-seeker/
├── apps/web/          # Next.js 15 frontend + API routes (port 3000)
├── apps/worker/       # Node.js scraper worker (cron-scheduled)
├── packages/shared/   # Shared types, Zod schemas, constants, Prisma schema
```

- **Web app** (`@lecture-seeker/web`): Next.js 15 App Router with React 19, Tailwind CSS 4, Radix UI / shadcn components, FullCalendar
- **Worker** (`@lecture-seeker/worker`): Scrapes event sources on a cron schedule (default every 6 hours), upserts events to PostgreSQL
- **Shared** (`@lecture-seeker/shared`): Prisma schema, TypeScript types, Zod validation schemas, event type constants

### Data Flow

1. Worker runs scrapers on cron schedule (`SCRAPE_INTERVAL_HOURS`, default 6)
2. Each scraper fetches from its source (REST API, ICS feed, or HTML)
3. Events are normalized to `NormalizedEvent` interface
4. Upserted to PostgreSQL via Prisma (deduplicated by `sourceId` + `sourceEventId`)
5. Web app queries events through API routes with filtering/pagination

### Database

PostgreSQL 16 with two models:
- **Source**: Event data sources with scrape metadata (name, slug, type, URL, enabled, scrape stats)
- **Event**: Denormalized event details (title, time, location, coordinates, cost, eventType, etc.)

Unique constraint: `@@unique([sourceId, sourceEventId])` prevents duplicates.
Schema location: `packages/shared/src/prisma/schema.prisma`

### Scraper Architecture

Base class `BaseScraper` with concrete implementations:
- `StanfordScraper` — REST API (Localist platform, paginated JSON)
- `UCBerkeleyScraper` — REST API (LiveWhale CMS, paginated JSON)
- `CalBearsScraper` — ICS feed (Sidearm Sports)
- `CSMObservatoryScraper` — HTML scraping (Cheerio)
- `GenericIcsScraper` — User-provided ICS feeds

Located in: `apps/worker/src/scrapers/`

### Timezone Handling (Important)

All events are Bay Area events. The timezone boundary rules are:

1. **Scrapers (worker)**: HTML scrapers parse local Pacific times from web pages. These **must** be converted to UTC using `pacificDate()` from `apps/worker/src/scrapers/timezone.ts` — never use `new Date(year, month, day, h, m)` directly, because that uses the system timezone (UTC on servers), not Pacific time. API-based scrapers (Stanford, UC Berkeley, Shoreline) receive UTC or timezone-aware ISO strings from their APIs and can use `new Date(isoString)` directly.
2. **Database**: All `DateTime` fields use `@db.Timestamptz()` (PostgreSQL `timestamptz`), which stores UTC internally. The `Event.timezone` column records the source timezone (default `America/Los_Angeles`) but the `startTime`/`endTime` values themselves are always UTC. Raw SQL can use `"startTime" AT TIME ZONE 'America/Los_Angeles'` directly — no double-conversion needed.
3. **Frontend (web)**: The browser receives UTC ISO strings from the API. `new Date()` and standard JS date methods automatically convert to the user's local timezone for display. No manual timezone conversion is needed in frontend components.
4. **ICS generation**: The `ics` library receives explicit UTC DateArrays (`getUTCHours()`, etc.) with `startInputType: "utc"` / `startOutputType: "utc"`. Never use `getHours()` / `getMonth()` — those are system-timezone-dependent and break on non-UTC servers.

**Key rules**:
- Scraper extracts "7:00 PM" from a Bay Area page → `pacificDate(year, month, day, 19, 0)` (not `new Date(...)`)
- Raw SQL on timestamptz → single `AT TIME ZONE 'America/Los_Angeles'`
- Server-side date components → always use `getUTC*()` methods
- Browser-side date components → standard `get*()` methods are correct (they use user's local TZ)

### API Routes

Located in `apps/web/src/app/api/`:
- `GET /api/events` — List/filter events (pagination, date/time range, type, search, source)
- `GET /api/events/[id]` — Single event
- `GET /api/events/[id]/ics` — Download .ics file
- `POST /api/events/[id]/send-invite` — Email event invite
- `GET/POST /api/sources` — List or create sources
- `GET/PATCH/DELETE /api/sources/[id]` — Source CRUD
- `GET /api/sources/[id]/events` — Events for a source
- `GET /api/filters` — Available filter values

### Frontend Structure

Located in `apps/web/src/`:
- `app/` — Next.js App Router pages (`/events`, `/sources`, `/status`)
- `components/` — React components (CalendarView, EventList, EventGrid, filter components, EventDetail modal, InviteDialog)
- `lib/` — Utilities (Prisma client, ICS generator, email transport, types)

## Commands

### Development

```bash
npm run dev              # Start web + worker concurrently in dev mode
npm run build            # Build all packages (shared first, then web + worker)
npm run lint             # ESLint
```

### Testing

```bash
npm test                 # Run all tests once (vitest run)
npm run test:watch       # Watch mode
npm run test:coverage    # With v8 coverage report
```

Test framework: **Vitest** with globals enabled, node environment.

Test locations:
- `apps/web/src/lib/__tests__/` — email, ICS generator tests
- `apps/worker/src/scrapers/__tests__/` — scraper tests (Stanford, Berkeley, CalBears, CSM)
- `packages/shared/src/__tests__/` — schema validation, constants tests

Coverage includes: `packages/shared/src/**/*.ts`, `apps/worker/src/scrapers/**/*.ts`, `apps/web/src/lib/**/*.ts`

### Database

```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (dev)
npm run db:push          # Push schema to database (no migration history)
npm run db:seed          # Seed built-in sources
```

Prisma schema path: `packages/shared/src/prisma/schema.prisma`

### Docker

```bash
docker compose up        # Start PostgreSQL, web, and worker
docker compose up db     # Start only PostgreSQL (for local dev)
```

Services: `db` (postgres:16-alpine on :5432), `web` (:3000), `worker`

## Environment Variables

Copy `.env.example` to `.env`. Required variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://lectureseeker:changeme@localhost:5432/lectureseeker` | PostgreSQL connection |
| `DB_PASSWORD` | `changeme` | Used by docker-compose |
| `SCRAPE_INTERVAL_HOURS` | `6` | Worker scrape frequency |
| `SMTP_HOST` | (empty) | SMTP server; leave empty to disable email |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASS` | (empty) | SMTP password |
| `SMTP_FROM` | `noreply@lectureseeker.local` | Sender address |

## Code Conventions

### TypeScript

- **Strict mode** enabled everywhere (`tsconfig.base.json`)
- Target: ES2022, Module: ESNext, Module resolution: bundler
- Shared types imported via `@lecture-seeker/shared` workspace package
- Path alias `@/` maps to `apps/web/src/` in the web app

### Shared Constants (Important)

**Never hardcode magic numbers that must match across packages.** Any value referenced by more than one file — API limits, default filter values, Zod schema bounds, etc. — must be a named export in `packages/shared/src/constants.ts` and imported wherever used. This prevents silent mismatches (e.g., a frontend sending `limit=500` that the Zod schema rejects at `max(200)`).

Current shared constants include:
- `API_DEFAULT_LIMIT`, `API_MAX_LIMIT`, `API_CALENDAR_LIMIT` — pagination limits used by the Zod schema, API route, and frontend
- `DEFAULT_START_HOUR` — default filter start hour, used by the events page and FilterSidebar
- `SOURCE_SLUGS` — canonical source identifiers
- `EVENT_TYPES` — canonical event type map

When adding a new constant: export it from `constants.ts`, import via `@lecture-seeker/shared`, and reference the constant in tests too (not the raw number).

### Validation

- **Zod** schemas for runtime validation of API inputs (`packages/shared/src/schemas.ts`)
- Zod schema bounds (e.g., `max(API_MAX_LIMIT)`) reference shared constants — update the constant, not the schema literal
- Prisma-generated types for database models
- API routes validate query params/body with Zod and return 400 with details on failure

### Event Type Normalization

12 canonical event types defined in `packages/shared/src/constants.ts`:
`lecture`, `exhibition`, `performance`, `sports`, `workshop`, `conference`, `seminar`, `concert`, `film`, `astronomy`, `social`, `other`

40+ aliases map to these canonical types (e.g., `talk` -> `lecture`, `exhibit` -> `exhibition`).

### Styling

- Tailwind CSS 4 with PostCSS
- shadcn/ui component patterns (Radix UI primitives + `class-variance-authority` + `tailwind-merge`)
- Components in `apps/web/src/components/ui/` follow shadcn conventions

### Email

- Nodemailer transport created per-request, destroyed after sending
- `.ics` attachments generated in memory (not persisted)
- No email content is logged to disk or database

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/prisma/schema.prisma` | Database schema (Source, Event models) |
| `packages/shared/src/types.ts` | Shared TypeScript interfaces (`NormalizedEvent`, etc.) |
| `packages/shared/src/schemas.ts` | Zod validation schemas |
| `packages/shared/src/constants.ts` | Event types, source configs, aliases |
| `packages/shared/src/prisma/seed.ts` | Seeds built-in sources |
| `apps/worker/src/index.ts` | Worker entry point with cron scheduling |
| `apps/worker/src/scrapers/base.ts` | `BaseScraper` abstract class |
| `apps/web/src/app/events/page.tsx` | Main events page |
| `apps/web/src/lib/prisma.ts` | Prisma client singleton |
| `apps/web/src/lib/ics-generator.ts` | ICS file generation |
| `apps/web/src/lib/email.ts` | Email transport utility |
| `vitest.config.ts` | Test configuration |
| `docker-compose.yml` | Docker orchestration (db, web, worker) |

## Common Workflows

### Adding a New Scraper

1. Create a new class extending `BaseScraper` in `apps/worker/src/scrapers/`
2. Implement the `scrape()` method returning `NormalizedEvent[]`
3. Register it in the worker's scraper map (`apps/worker/src/index.ts`)
4. Add a corresponding `Source` entry (via seed or API)
5. Write tests in `apps/worker/src/scrapers/__tests__/`

### Adding a New API Route

1. Create a route handler in `apps/web/src/app/api/<path>/route.ts`
2. Use Zod schemas from `@lecture-seeker/shared` for input validation
3. Use Prisma client from `@/lib/prisma` for database queries

### Adding a New Filter

1. Add filter parameter handling in `GET /api/events` route
2. Add UI component in `apps/web/src/components/`
3. Wire it into `FilterSidebar` component
4. Update `GET /api/filters` if the filter needs dynamic values

### Local Development Setup

1. `cp .env.example .env`
2. `docker compose up db` (start PostgreSQL)
3. `npm install`
4. `npm run db:generate`
5. `npm run db:push`
6. `npm run db:seed`
7. `npm run dev`
