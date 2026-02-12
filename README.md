# Lecture Seeker

A Bay Area event aggregator that scrapes university and athletics calendars, normalizes the data, and presents it in a filterable calendar UI. Download `.ics` invites or email them directly -- with no persistent email logging.

## Architecture

### System Overview

```mermaid
graph TB
    subgraph External["External Data Sources"]
        S1[Stanford Events<br/>REST API]
        S2[UC Berkeley Events<br/>REST API]
        S3[Cal Bears Athletics<br/>ICS Feed]
        S4[CSM Observatory<br/>HTML Page]
        S5[Custom ICS Feeds<br/>User-added]
    end

    subgraph Docker["Docker Compose"]
        subgraph Worker["Worker Service"]
            CRON[node-cron<br/>Every 6 hours]
            SCRAPERS[Scraper Modules]
            CRON --> SCRAPERS
        end

        subgraph Web["Web Service :3000"]
            NEXT[Next.js App Router]
            API[API Routes]
            UI[React Frontend]
            NEXT --- API
            NEXT --- UI
        end

        DB[(PostgreSQL 16)]
    end

    S1 -->|fetch JSON| SCRAPERS
    S2 -->|fetch JSON| SCRAPERS
    S3 -->|fetch ICS| SCRAPERS
    S4 -->|fetch HTML| SCRAPERS
    S5 -->|fetch ICS| SCRAPERS
    SCRAPERS -->|upsert events| DB
    API -->|query events| DB
    UI -->|REST calls| API

    USER((User)) -->|browse / filter| UI
    API -->|SMTP send| EMAIL[Email Recipient]
```

### Scraper Pipeline

```mermaid
flowchart LR
    subgraph Fetch
        F1[HTTP GET<br/>source URL]
    end

    subgraph Parse
        P1[JSON API response]
        P2[ICS VEVENT entries]
        P3[HTML table rows<br/>via Cheerio]
    end

    subgraph Normalize
        N1[NormalizedEvent<br/>interface]
    end

    subgraph Store
        ST1[Prisma upsert<br/>sourceId + sourceEventId]
    end

    F1 --> P1 & P2 & P3
    P1 & P2 & P3 --> N1
    N1 --> ST1
```

### Data Model

```mermaid
erDiagram
    Source ||--o{ Event : "has many"

    Source {
        string id PK
        string name
        string slug UK
        enum type "API_JSON | ICS_FEED | HTML_SCRAPE"
        string url
        json config
        boolean enabled
        boolean isBuiltIn
        datetime lastScrapedAt
        string lastError
    }

    Event {
        string id PK
        string sourceId FK
        string sourceEventId
        string title
        string description
        datetime startTime
        datetime endTime
        boolean isAllDay
        string timezone
        string location
        string address
        float latitude
        float longitude
        string url
        string ticketUrl
        string cost
        boolean isCanceled
        boolean isOnline
        string eventType
        string audience
        string_arr subjects
        json rawData
    }
```

### Request Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React Frontend
    participant API as Next.js API Routes
    participant DB as PostgreSQL

    User->>UI: Browse /events
    UI->>API: GET /api/events?source=stanford&eventType=lecture
    API->>DB: SELECT * FROM Event WHERE ...
    DB-->>API: Event rows
    API-->>UI: { data: [...], pagination: {...} }
    UI-->>User: Render calendar / list / grid

    User->>UI: Click "Download .ics"
    UI->>API: GET /api/events/{id}/ics
    API->>DB: SELECT * FROM Event WHERE id = ...
    DB-->>API: Event row
    API-->>UI: text/calendar attachment
    UI-->>User: .ics file download

    User->>UI: Click "Email Invite"
    UI->>API: POST /api/events/{id}/send-invite { email }
    API->>API: Generate ICS in memory
    API->>SMTP: Send via Nodemailer (transient)
    API-->>UI: { success: true }
```

### Frontend Component Tree

```mermaid
graph TD
    RootLayout --> EventsPage
    RootLayout --> SourcesPage

    EventsPage --> Header
    EventsPage --> ViewToggle
    EventsPage --> FilterSidebar
    EventsPage --> CalendarView
    EventsPage --> EventList
    EventsPage --> EventGrid
    EventsPage --> EventDetail

    FilterSidebar --> SearchBar
    FilterSidebar --> SourceFilter
    FilterSidebar --> EventTypeFilter
    FilterSidebar --> TimeOfDayFilter

    EventDetail --> InviteDialog

    SourcesPage --> Header2[Header]
    SourcesPage --> SourceList[Source Cards]
    SourcesPage --> AddSourceForm
```

## Data Sources

| Source | Type | Strategy |
|--------|------|----------|
| [Stanford Events](https://events.stanford.edu) | REST API | Localist platform, paginated JSON at `/api/2/events` |
| [UC Berkeley Events](https://events.berkeley.edu) | REST API | LiveWhale CMS, paginated JSON at `/live/json/events/` |
| [Cal Bears Athletics](https://calbears.com/calendar) | ICS Feed | Sidearm Sports calendar at `/calendar.ashx/calendar.ics` |
| [CSM Observatory](https://collegeofsanmateo.edu/astronomy/observatory.asp) | HTML Scrape | Cheerio parses schedule table for "Jazz Under the Stars" |

Custom ICS feed URLs can be added through the Sources page in the UI.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, FullCalendar |
| UI Components | shadcn/ui (Radix primitives), Lucide icons |
| API | Next.js API Routes |
| Database | PostgreSQL 16, Prisma ORM |
| Scraping | undici (fetch), Cheerio (HTML), node-ical (ICS) |
| Worker | Node.js, node-cron |
| ICS Generation | `ics` npm package |
| Email | Nodemailer (direct SMTP, ephemeral) |
| Testing | Vitest |
| Monorepo | npm workspaces |

## Project Structure

```
lecture-seeker/
  docker-compose.yml
  vitest.config.ts
  packages/shared/           # Prisma schema, types, Zod schemas, constants
  apps/web/                  # Next.js frontend + API routes
    src/app/                 #   Pages and API route handlers
    src/components/          #   React components (calendar, filters, events, layout)
    src/lib/                 #   Utilities (Prisma client, ICS generator, email)
  apps/worker/               # Scraper worker service
    src/scrapers/            #   One module per data source + generic ICS
    src/index.ts             #   Entry point with cron scheduling
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local development)

### Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env with your DB_PASSWORD and optional SMTP settings
docker compose up
```

The web app will be available at `http://localhost:3000`. The worker will seed the four built-in sources and begin scraping on startup.

### Local Development

```bash
# Start just the database
docker compose up -d db

# Install dependencies
npm install

# Generate Prisma client and push schema
npm run db:generate
npm run db:push

# Seed built-in sources
npm run db:seed

# Start both web and worker in dev mode
npm run dev
```

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## API Reference

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events` | List events with filtering and pagination |
| `GET` | `/api/events/[id]` | Get single event |
| `GET` | `/api/events/[id]/ics` | Download .ics calendar file |
| `POST` | `/api/events/[id]/send-invite` | Email .ics invite (body: `{ "email": "..." }`) |

**Query parameters for `GET /api/events`:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 200) |
| `startAfter` | ISO date | Events starting after this time |
| `startBefore` | ISO date | Events starting before this time |
| `source` | string | Filter by source slug |
| `eventType` | string | Filter by type (lecture, sports, etc.) |
| `location` | string | Partial match on location |
| `isOnline` | boolean | Online events only |
| `q` | string | Full-text search |
| `timeOfDay` | string | `morning`, `afternoon`, or `evening` |

### Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sources` | List all sources |
| `POST` | `/api/sources` | Add custom ICS feed source |
| `PATCH` | `/api/sources/[id]` | Enable/disable a source |
| `DELETE` | `/api/sources/[id]` | Remove a custom source |

### Filters

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/filters` | Get available filter values (event types, sources, locations) |

## Email Configuration

Email sending is designed to be ephemeral with no logging:

- A transient Nodemailer SMTP transport is created per request
- The `.ics` file is generated in memory and attached
- The transport is destroyed after sending
- No email content is persisted to disk or database

Configure via environment variables:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

Leave `SMTP_HOST` empty to disable email functionality (the .ics download still works).
