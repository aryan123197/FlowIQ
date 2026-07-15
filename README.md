# FlowIQ

A universal data pipeline and AI insight engine. Ingests data from Stripe, Shopify, Salesforce, and CSV uploads, normalizes it into a unified PostgreSQL schema, runs it through a visual drag-and-drop ETL pipeline builder, and surfaces AI-generated insights via Claude with tool use.

See `ARCHITECTURE.md` for the full system design and `REQUIREMENTS.md` for functional requirements.

## Features

- **Connectors** — Stripe (live API), Shopify and Salesforce (mock connectors), CSV upload
- **ETL engine** — sync orchestrator with normalization, idempotent upserts, and per-job error tracking
- **Pipeline builder** — drag-and-drop visual ETL graphs (filter, rename, cast, derive, dedupe transforms) with live run logs over SSE
- **Alert engine** — threshold-based rules on revenue/transaction metrics, dispatched via email or Slack webhook
- **Analytics dashboard** — KPIs, revenue charts, platform breakdown, paginated transaction table
- **AI insights** — Claude-generated insights backed by SQL analysis tools (revenue trends, anomalies, top customers, etc.)
- **Reports** — streaming CSV/JSON export of transaction data

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 16 (local, or via Docker)

### Local development

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run db:migrate
npm run db:seed              # optional: populate sample data across all 4 platforms
npm run dev
```

App runs at `http://localhost:3000`.

### Environment variables

| Variable                                                            | Required                        | Notes                                                                |
| ------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`                                                      | Yes                             | Postgres connection string                                           |
| `ANTHROPIC_API_KEY`                                                 | Yes, for `/api/insights`        | Claude API key                                                       |
| `STRIPE_SECRET_KEY`                                                 | Yes, for Stripe sync            | Real key needed to pull live Stripe data                             |
| `STRIPE_WEBHOOK_SECRET`                                             | Yes, for `/api/webhooks/stripe` | From the Stripe CLI or dashboard                                     |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Yes, for email alerts           | Shopify and Salesforce connectors are mocked and need no credentials |

## Docker

Build and run the full stack (Postgres + app):

```bash
docker compose up --build
```

The app container reads `DATABASE_URL` and the other env vars above from the shell environment — see `docker-compose.yml`.

To run database migrations against the containerized Postgres from your host:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/enterprise_data npm run db:migrate
```

An optional Redis service is available behind a Compose profile (not currently used by the app, reserved for future caching):

```bash
docker compose --profile redis up -d
```

> Note: if you already run Postgres locally on port 5432, `docker compose up` will fail to bind that port. Stop your local Postgres first, or remap the `postgres` service's published port in `docker-compose.yml`.

## Testing

```bash
npm run test         # Vitest, run once
npm run test:watch   # Vitest, watch mode
```

The suite runs against a real local Postgres database (no DB mocking) — `DATABASE_URL` must point at a database you're OK truncating between test runs.

## Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run start        # start production server (after build)
npm run db:generate  # generate a new Drizzle migration
npm run db:migrate   # apply migrations
npm run db:studio    # open Drizzle Studio
npm run db:seed      # seed sample data across all 4 platforms + alert rules
npm run type-check   # tsc --noEmit
npm run format       # prettier --write
```

## Project Structure

```
app/                    Next.js App Router pages and API routes
lib/connectors/         Stripe, Shopify (mock), Salesforce (mock), CSV
lib/normalization/      Per-platform adapters → unified customer/transaction shape
lib/engine/             Sync orchestrator, pipeline runner, transform registry
lib/alerts/             Metric calculation, rule evaluation, email/Slack dispatch
lib/insights/           Claude tool-use agent + SQL analysis tools
lib/db/                 Drizzle schema, migrations, client, seed script
components/             Dashboard, pipeline builder, alerts, and reports UI
test/                   Vitest suite (backend logic, against a real Postgres DB)
```
