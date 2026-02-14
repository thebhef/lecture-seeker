# Lecture Seeker

A Bay Area event aggregator that scrapes university and athletics calendars, normalizes the data, and presents it in a filterable calendar UI. Download `.ics` invites or email them directly.

## Quick Start

```bash
cp .env.example .env
docker compose up
```

Open [localhost:3000](http://localhost:3000). The worker seeds four built-in sources and begins scraping on startup.

## Local Development

```bash
docker compose up -d db        # Start PostgreSQL
npm install
npm run db:generate && npm run db:push && npm run db:seed
npm run dev                    # Start web + worker in dev mode
```

## Testing

```bash
npm test                       # Run all tests once
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage report
```

## Project Structure

```
lecture-seeker/
  packages/shared/             # Prisma schema, types, Zod schemas, constants
  apps/web/                    # Next.js 15 frontend + API routes
  apps/worker/                 # Scraper worker (cron-scheduled)
```

**npm workspaces** monorepo. The worker scrapes event sources on a schedule, upserts to PostgreSQL via Prisma, and the web app queries and displays them with filtering, calendar views, and .ics export.

## Data Sources

| Source | Type |
|--------|------|
| [Stanford Events](https://events.stanford.edu) | REST API (Localist) |
| [UC Berkeley Events](https://events.berkeley.edu) | REST API (LiveWhale) |
| [Cal Bears Athletics](https://calbears.com/calendar) | ICS feed |
| [CSM Observatory](https://collegeofsanmateo.edu/astronomy/observatory.asp) | HTML scrape |

Custom ICS feeds can be added through the Sources page in the UI.

## Environment Variables

Copy `.env.example` to `.env`. See that file for all available options. At minimum you need `DATABASE_URL` (pre-configured for the Docker Compose database). SMTP variables are optional — leave `SMTP_HOST` empty to disable email.
