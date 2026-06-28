# Product Requirements — Enterprise Data Integration & Insight Platform

## Project Summary

A universal data pipeline and insight engine. Point it at any data source, build a transformation pipeline visually, and get an AI-powered insight dashboard with alerting and export capabilities.

**Goal**: Resume-grade full-stack project demonstrating ETL engineering, real-time systems, AI agent integration, and production-quality frontend.

---

## User Stories

### Data Ingestion

| ID | Story | Priority |
|---|---|---|
| ING-01 | As a user, I can trigger a sync from Stripe to pull customers and charges into the unified database | P0 |
| ING-02 | As a user, I can trigger a sync from Shopify to pull customers and orders | P0 |
| ING-03 | As a user, I can trigger a sync from Salesforce to pull contacts and closed-won opportunities | P0 |
| ING-04 | As a user, I can upload a CSV file and have it ingested as transactions | P0 |
| ING-05 | As a user, I can receive Stripe webhook events that update transaction status in real time | P1 |
| ING-06 | As a user, I can connect a generic REST API endpoint as a data source | P2 |

### Pipeline Builder

| ID | Story | Priority |
|---|---|---|
| PIP-01 | As a user, I can create a named pipeline with a drag-and-drop canvas | P0 |
| PIP-02 | As a user, I can add Source nodes (platform picker) to the canvas | P0 |
| PIP-03 | As a user, I can add Transform nodes (filter, rename, cast, derive, dedupe) | P0 |
| PIP-04 | As a user, I can add a Sink node (write to PostgreSQL) | P0 |
| PIP-05 | As a user, I can connect nodes with edges to define data flow | P0 |
| PIP-06 | As a user, I can configure each node via a side panel | P0 |
| PIP-07 | As a user, I can save a pipeline and it persists across sessions | P0 |
| PIP-08 | As a user, I can run a pipeline and see each node's status update in real time | P0 |
| PIP-09 | As a user, I can see how many records passed through each node after a run | P1 |
| PIP-10 | As a user, I can view the history of pipeline runs | P1 |

### Analytics Dashboard

| ID | Story | Priority |
|---|---|---|
| ANA-01 | As a user, I can see total revenue, transaction count, customer count, and avg transaction value as KPI cards | P0 |
| ANA-02 | As a user, I can see a revenue time-series chart broken down by platform | P0 |
| ANA-03 | As a user, I can see a donut chart of revenue share by platform | P0 |
| ANA-04 | As a user, I can browse a paginated, filterable table of all transactions | P0 |
| ANA-05 | As a user, I can filter all dashboard data by date range | P0 |
| ANA-06 | As a user, I can see a banner showing live sync progress while a sync is running | P1 |
| ANA-07 | As a user, I can filter the transaction table by platform and status | P1 |

### AI Insights

| ID | Story | Priority |
|---|---|---|
| INS-01 | As a user, I can view AI-generated insight cards describing trends, anomalies, and comparisons | P0 |
| INS-02 | Each insight has a severity level (critical / warning / info) and a recommendation | P0 |
| INS-03 | As a user, I can see insights stream in progressively (not all at once) | P1 |
| INS-04 | Insights are regenerated on demand (manual refresh) | P1 |

### Alerts

| ID | Story | Priority |
|---|---|---|
| ALR-01 | As a user, I can create an alert rule with a metric, threshold, operator, and time window | P0 |
| ALR-02 | As a user, I can configure an alert to send an email notification when triggered | P0 |
| ALR-03 | As a user, I can configure an alert to send a Slack webhook notification | P1 |
| ALR-04 | Alerts are automatically evaluated after every sync completes | P0 |
| ALR-05 | As a user, I can view a history of all triggered alerts | P0 |
| ALR-06 | As a user, I can enable/disable individual alert rules | P1 |
| ALR-07 | As a user, I can delete alert rules | P1 |

### Reports

| ID | Story | Priority |
|---|---|---|
| REP-01 | As a user, I can export transactions as a CSV file filtered by date range and platform | P0 |
| REP-02 | As a user, I can export transactions as JSON | P1 |
| REP-03 | Large exports stream progressively (no memory blow-up) | P1 |

### Infrastructure

| ID | Story | Priority |
|---|---|---|
| INF-01 | The entire application runs with `docker compose up` | P0 |
| INF-02 | Database schema is managed with versioned migrations (drizzle-kit) | P0 |
| INF-03 | A seed script populates realistic sample data across all 4 platforms | P1 |
| INF-04 | Environment variables are documented in `.env.example` | P1 |

---

## Functional Requirements

### Data Model

All customer and transaction data is normalized into a **unified schema** regardless of source platform:

**UnifiedCustomer**:
- `email` — primary identifier, deduplicated across platforms
- `name` — display name
- `stripeId`, `shopifyId`, `salesforceId` — platform-specific IDs
- `attributes` — JSONB for extensible metadata

**UnifiedTransaction**:
- `amount` — always in integer cents (e.g., $10.00 = 1000)
- `currency` — lowercase ISO 3-letter (e.g., `usd`)
- `status` — normalized: `completed | pending | failed | refunded | cancelled`
- `sourcePlatform` — origin platform
- `sourceTransactionId` — platform's own ID
- Unique constraint on `(sourcePlatform, sourceTransactionId)` prevents duplicates on re-sync

### ETL Correctness

- Re-running a sync must be idempotent (upsert, not insert)
- Individual record errors must not abort the whole sync job
- Error count and error details must be persisted on the sync job record
- Customer deduplication is by email (cross-platform merging on match)

### Pipeline Execution

- Pipelines are Directed Acyclic Graphs (DAGs); cycles are rejected at save time
- Execution order determined by topological sort
- Each step's status and output record count is persisted
- A failed step marks the pipeline run as failed and stops execution

### Transform Rules

| Rule Type | Behavior |
|---|---|
| `filter` | Keep rows where expression evaluates to true. Expression syntax: `amount > 1000`, `status == "completed"`. No `eval()` — uses custom tokenizer. |
| `rename` | Map `{ oldName: newName }` — renames columns |
| `cast` | Map `{ column: 'number' | 'string' | 'date' }` — coerces types |
| `derive` | Add computed columns: `{ newCol: 'amount * 1.1' }` |
| `dedupe` | Remove duplicate rows by one or more key columns |

### Alert Metrics

| Metric | Description |
|---|---|
| `revenue_total` | Sum of transaction amounts in time window |
| `transaction_count` | Count of transactions in time window |
| `failed_transaction_rate` | Ratio of failed to total transactions |
| `customer_count` | Count of distinct customers |

**Operators**: `gt`, `lt`, `gte`, `lte`, `eq`

**Time windows**: `1h`, `6h`, `24h`, `7d`, `30d`

### AI Insight Requirements

- Claude model: `claude-sonnet-4-6`
- Claude must use tool calling (not raw data dump)
- Each insight must have: `severity` (critical/warning/info), `title`, `description`, `value` (numeric), `delta` (% change), `recommendation` (action text)
- Insights must stream via SSE — UI shows them appearing progressively
- SQL tool functions must be independently unit-testable without the LLM

### Real-time Requirements

- Sync job status must update in the UI within 1 second of a status change
- Pipeline step status must update in the UI as each step completes
- All real-time communication uses Server-Sent Events (SSE)
- SSE streams must close cleanly on job completion or client disconnect

---

## Non-Functional Requirements

### Performance

- Connector batch size: 100 records per generator yield (memory-bounded)
- CSV error rate threshold: >5% invalid rows fails the job
- Insight generation: tool calls execute in parallel where possible
- Report export: streams rows in chunks (no full dataset in memory)

### Security

- Stripe webhook signature verified with `stripe.webhooks.constructEvent()`
- Filter expression evaluator must not use `eval()` or `new Function()`
- Database credentials via environment variables only
- API routes validate input with Zod schemas

### Reliability

- Sync jobs are crash-safe: if the process dies, job remains in `running` state and can be detected as stale
- Individual record failures are captured in `errorDetails` — job completes as `completed` even with partial errors
- Upsert strategy prevents duplicate records on re-sync

### Developer Experience

- TypeScript strict mode throughout
- Drizzle ORM for type-safe queries (no raw SQL strings in application code)
- Vitest for unit tests — insight SQL tools are fully testable without mocking the LLM
- `npm run db:studio` opens Drizzle Studio GUI for database inspection

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | For Stripe sync | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Stripe webhook signing secret |
| `ANTHROPIC_API_KEY` | For insights | Anthropic API key for Claude |
| `SMTP_HOST` | For email alerts | SMTP server hostname |
| `SMTP_PORT` | For email alerts | SMTP port (465 or 587) |
| `SMTP_USER` | For email alerts | SMTP authentication username |
| `SMTP_PASS` | For email alerts | SMTP authentication password |
| `SMTP_FROM` | For email alerts | Sender address for alert emails |

---

## Implementation Phases

| Phase | Scope | Deliverable |
|---|---|---|
| 1 | DB schema + ETL engine + core sync API | Sync trigger works, data flows into PostgreSQL |
| 2 | Query API + AI insight agent | Dashboard data endpoints + Claude insight streaming |
| 3 | Alert engine | Alerts fire post-sync, email/Slack dispatched |
| 4 | Pipeline builder backend | DAG execution, transforms, SSE step status |
| 5 | Analytics dashboard UI | Full dashboard with live sync status |
| 6 | Pipeline builder UI | React Flow canvas, drag-and-drop, live run log |
| 7 | Alerts + reports UI | Alert management, CSV/JSON export |
| 8 | Docker + polish | Dockerfile, seed data, README, tests |

---

## Out of Scope

- User authentication / multi-tenancy
- Real Shopify or Salesforce API integrations (mocks are used)
- Mobile-responsive design
- Internationalization (i18n)
- Rate limiting on API routes
- Webhook delivery retry logic
