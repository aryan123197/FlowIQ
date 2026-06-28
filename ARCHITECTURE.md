# Architecture — Enterprise Data Integration & Insight Platform

## Overview

A **modular monolith with async/event-driven ETL processing**. Single Next.js 16 App Router application containing the full stack: data connectors, ETL engine, alert engine, AI insight agent, REST API, and React dashboard. Packaged as a multi-stage Docker image with PostgreSQL.

---

## System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER / CLIENT                               │
│                                                                              │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │  Pipeline Builder    │  │  Analytics Dashboard  │  │  Alerts & Reports │  │
│  │  (@xyflow/react)    │  │  (Recharts)           │  │                   │  │
│  │                     │  │                       │  │  Alert rule CRUD  │  │
│  │  drag-and-drop      │  │  KPI cards            │  │  Trigger history  │  │
│  │  node canvas        │  │  revenue time-series  │  │  CSV/JSON export  │  │
│  │  edge connections   │  │  platform donut       │  │                   │  │
│  │  config side panel  │  │  insight cards        │  │                   │  │
│  │  live run log (SSE) │  │  sync status (SSE)    │  │                   │  │
│  └──────────┬──────────┘  └──────────┬────────────┘  └───────────────────┘  │
│             │ REST/POST              │ fetch + SSE                            │
└─────────────┼──────────────────────-┼───────────────────────────────────────┘
              │                        │
              ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS APP ROUTER  (API Layer)                        │
│                                                                              │
│  POST /api/sync/trigger            POST /api/upload/csv                     │
│  GET  /api/sync/status             POST /api/webhooks/stripe                │
│  GET  /api/sync/[jobId]/stream  ── SSE                                      │
│                                                                              │
│  GET  /api/data/metrics            GET  /api/data/timeseries                │
│  GET  /api/data/transactions       GET  /api/data/customers                 │
│  GET  /api/data/profile            GET  /api/insights  ── SSE               │
│                                                                              │
│  GET+POST /api/pipelines           GET+PUT+DELETE /api/pipelines/[id]       │
│  POST /api/pipelines/[id]/run      GET  /api/pipelines/[id]/stream  ── SSE  │
│                                                                              │
│  GET+POST /api/alerts              PATCH+DELETE /api/alerts/[id]            │
│  GET /api/alerts/triggers          GET /api/reports/generate  (streaming)   │
└──────────────────────────┬─────────────────────────────────────────────────┘
                           │
          ┌────────────────┴──────────────────────┐
          ▼                                        ▼
┌──────────────────────┐             ┌────────────────────────────────────┐
│  ETL PIPELINE ENGINE  │             │  ALERT ENGINE                      │
│  lib/engine/          │             │  lib/alerts/                       │
│                       │             │                                    │
│  syncOrchestrator     │             │  metricCalculator  (SQL windowed)  │
│  pipelineRunner       │             │  evaluator         (threshold cmp) │
│  stepExecutor         │             │  dispatcher        (email/Slack)   │
│  transformRegistry    │             │                                    │
│  (DB job queue via    │             └────────────────────────────────────┘
│  FOR UPDATE SKIP      │
│  LOCKED)              │
└──────────┬────────────┘
           │
    ┌──────┴──────────────┐
    ▼                     ▼
┌──────────────┐  ┌──────────────────────────────────────────────────────┐
│  CONNECTORS  │  │  NORMALIZATION + AI INSIGHT AGENT                     │
│  lib/conn/   │  │  lib/normalization/   lib/insights/                   │
│              │  │                                                       │
│  Stripe      │  │  normalize.ts  (platform dispatcher)                 │
│  Shopify     │  │  adapters/: stripe, shopify, salesforce, csv         │
│  Salesforce  │  │                                                       │
│  CSV         │  │  agent.ts  (Claude claude-sonnet-4-6 tool-use loop)  │
│  REST (new)  │  │  tools/: revenueTrend, anomalies, periodComparison,  │
│              │  │    topCustomers, failureRate, platformBreakdown       │
└──────────────┘  └──────────────────────────────────────────────────────┘
                           │
                           ▼
          ┌────────────────────────────────────────┐
          │              POSTGRESQL 16              │
          │                                        │
          │  customers          transactions        │
          │  syncJobs           alertRules          │
          │  alertTriggers      pipelines           │
          │  pipelineRuns       pipelineSteps       │
          │  transformRules                         │
          └────────────────────────────────────────┘
```

---

## Architecture Pattern

**Type**: Modular monolith with async/event-driven ETL

This is not a pure event-driven architecture (no message broker). It uses event-driven *patterns* selectively:

| Pattern | Where used | Purpose |
|---|---|---|
| Async job execution | Sync trigger fires job, API returns immediately | Decouple HTTP response from long ETL work |
| Server-Sent Events | Pipeline status, sync progress, insight streaming | Real-time push without client polling |
| Post-sync hook | Alert evaluator runs after every sync | Loose coupling between ETL and alerting |
| DB-backed job queue | `syncJobs` table + `FOR UPDATE SKIP LOCKED` | Durable async queue, no Redis required |
| Tool-use agent loop | Claude calls SQL tools, iterates | Agentic insight generation |

---

## Layer Breakdown

### 1. Data Sources Layer — `lib/connectors/`

Abstract `BaseConnector` class with async generator pattern. Each connector streams data in batches to avoid loading everything into memory.

| Connector | File | Status |
|---|---|---|
| Stripe | `stripe.ts` | Real API (Stripe SDK v2025) |
| Shopify | `shopify.mock.ts` | Mock data (ready for real impl) |
| Salesforce | `salesforce.mock.ts` | Mock data (ready for real impl) |
| CSV | `csv.ts` | Real parser (PapaParse + Zod) |
| REST API | `rest.ts` | Generic paginated fetcher (planned) |

Factory: `lib/connectors/index.ts` → `createConnector(platform, config)`

### 2. Normalization Layer — `lib/normalization/`

Adapters map each platform's raw data shape to `UnifiedCustomer` and `UnifiedTransaction`. The dispatcher (`normalize.ts`) routes by platform string.

All amounts are stored as **integer cents** (no floating point). All currencies are **lowercase ISO 3-letter codes**.

### 3. ETL Engine — `lib/engine/`

| File | Responsibility |
|---|---|
| `syncOrchestrator.ts` | Core ETL loop: validate → fetch customers → fetch transactions → upsert → post-sync hooks |
| `pipelineRunner.ts` | Deserializes React Flow graph JSON → Kahn's topological sort → executes steps in order |
| `stepExecutor.ts` | Routes each node type (source/transform/sink) to the correct handler |
| `transformRegistry.ts` | Maps `ruleType` string → pure transform function |

**Job queue**: Uses PostgreSQL `FOR UPDATE SKIP LOCKED` on the `syncJobs` table. No Redis or external queue needed.

### 4. Transform Layer — `lib/transforms/`

Pure functions, each takes `rows[]` + config, returns `rows[]`:

- `filter.ts` — hand-written expression tokenizer (no `eval()`)
- `rename.ts` — column rename map
- `cast.ts` — type coercion: string → number → date
- `derive.ts` — computed columns
- `dedupe.ts` — deduplication by key field(s)

### 5. Storage Layer — PostgreSQL 16

Managed via Drizzle ORM with strict TypeScript types. Migrations via `drizzle-kit`.

**Schema overview**:

| Table | Purpose |
|---|---|
| `customers` | Unified customer records, multi-platform ID mapping |
| `transactions` | Normalized transactions, unique on (sourcePlatform, sourceTransactionId) |
| `syncJobs` | ETL job tracking with status, counts, error details |
| `alertRules` | Metric threshold rules with notification config |
| `alertTriggers` | History of fired alerts |
| `pipelines` | Pipeline graphs (React Flow JSON) |
| `pipelineRuns` | Execution history per pipeline |
| `pipelineSteps` | Per-node execution status and output metadata |
| `transformRules` | Transform node configs per pipeline |

### 6. AI Insight Agent — `lib/insights/`

Uses **Claude claude-sonnet-4-6** via the Anthropic SDK with tool use (function calling).

**Flow**:
1. Claude receives a system prompt describing the data platform and available tools
2. Claude autonomously calls any combination of 6 SQL tools
3. Each tool executes a real PostgreSQL query and returns structured data
4. Claude interprets the combined results and generates `Insight[]` objects
5. Insights stream back to the browser via SSE

**Tools available to Claude**:
- `get_revenue_trend` — 30-day daily buckets + linear regression slope
- `get_anomalies` — Z-score on daily revenue, flags days > N sigma
- `get_period_comparison` — current vs prior period (WoW/MoM/YoY)
- `get_top_customers` — GROUP BY customer, sorted by lifetime value
- `get_failure_rate` — failed transaction rate vs rolling average
- `get_platform_breakdown` — revenue share by source platform

### 7. Alert Engine — `lib/alerts/`

Runs as a post-sync hook after every `syncOrchestrator` completes.

- `metricCalculator.ts` — time-windowed SQL aggregation per alert metric
- `evaluator.ts` — compares computed value to rule threshold
- `dispatcher.ts` — sends email via Nodemailer or Slack via webhook

### 8. API Layer — `app/api/`

Next.js App Router route handlers. All routes are stateless HTTP or SSE streams.

**Real-time**: SSE via `lib/sse/emitter.ts` (`createSSEStream` factory). No WebSocket upgrades needed — `ReadableStream` is native in Next.js route handlers.

### 9. Frontend — `app/` + `components/`

| Page | Route | Key components |
|---|---|---|
| Analytics Dashboard | `/analytics` | KpiCard, RevenueChart, PlatformDonut, TransactionTable, InsightPanel |
| Pipeline Builder | `/pipelines/[id]` | PipelineCanvas (React Flow), PipelineToolbar, PipelineRunLog |
| Alerts | `/alerts` | AlertRuleForm, AlertRuleCard, TriggerHistory |
| Reports | `/reports` | ReportFilter, ExportButton (streaming download) |

**Pipeline builder**: `@xyflow/react` (React Flow v12) for drag-and-drop node canvas. Graph serializes to JSON stored in `pipelines.graphJson`.

---

## Data Flow: Sync Trigger

```
POST /api/sync/trigger { platform: 'shopify' }
  │
  ├─ INSERT syncJob { status: 'pending' }
  ├─ return 202 { jobId }
  │
  └─ runSync(jobId, platform)  [async, non-blocking]
       │
       ├─ UPDATE syncJob { status: 'running' }
       ├─ connector.validate()
       │
       ├─ for await batch of connector.fetchCustomers():
       │    normalizeCustomer(platform, raw) → UnifiedCustomer
       │    upsertCustomer() → INSERT ... ON CONFLICT DO UPDATE
       │
       ├─ for await batch of connector.fetchTransactions():
       │    normalizeTransaction(platform, raw) → UnifiedTransaction
       │    upsertTransaction() → INSERT ... ON CONFLICT DO UPDATE
       │
       ├─ AlertEvaluator.evaluate()   [post-sync hook]
       │
       └─ UPDATE syncJob { status: 'completed', recordsProcessed, errorCount }
```

## Data Flow: AI Insight Generation

```
GET /api/insights
  │
  └─ InsightAgent.generate()
       │
       ├─ Start Claude (claude-sonnet-4-6) with tool definitions
       │
       ├─ Claude calls tools autonomously (any order, any subset):
       │    get_revenue_trend()      → SQL daily buckets + regression
       │    get_anomalies()          → SQL Z-scores
       │    get_period_comparison()  → SQL this vs prior period
       │    get_top_customers()      → SQL customer LTV ranking
       │    get_failure_rate()       → SQL failure rate vs rolling avg
       │    get_platform_breakdown() → SQL platform revenue share
       │
       ├─ Each tool returns structured JSON to Claude
       │
       └─ Claude generates Insight[] { severity, title, description, recommendation }
            └─ Streamed via SSE as each insight is generated
```

## Data Flow: Pipeline Execution

```
POST /api/pipelines/[id]/run
  │
  ├─ INSERT pipelineRun + pipelineSteps[]
  │
  └─ pipelineRunner.execute(runId, graphJson)
       │
       ├─ Topological sort (Kahn's algorithm) of React Flow DAG
       │
       └─ For each node in sorted order:
            UPDATE pipelineStep { status: 'running' }
            stepExecutor.run(node, inputRows)
              SourceNode    → syncOrchestrator fetch
              TransformNode → transformRegistry[ruleType](rows, config)
              SinkNode      → db.insert().onConflictDoUpdate()
            UPDATE pipelineStep { status: 'completed', outputMeta }
            SSE push: { nodeId, status, recordCount }
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.6 |
| Language | TypeScript | 5.x (strict) |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Charts | Recharts | 3.x |
| Pipeline Canvas | @xyflow/react | 12.x |
| Icons | Lucide React | latest |
| Forms | React Hook Form + Zod | 7.x / 4.x |
| ORM | Drizzle ORM | 0.45.x |
| Database | PostgreSQL | 16 |
| AI SDK | @anthropic-ai/sdk | latest |
| AI Model | Claude claude-sonnet-4-6 | claude-sonnet-4-6 |
| Email | Nodemailer | 8.x |
| CSV Parsing | PapaParse | 5.x |
| Stripe SDK | stripe | 22.x |
| Testing | Vitest | 4.x |
| Container | Docker + Compose | multi-stage |

---

## Key Design Decisions

### Why not microservices?
Single-team project. Monolith is faster to build, easier to reason about, and trivially extractable into services later. The layered structure (connectors/engine/alerts/insights are all isolated modules) means services can be split by moving directories.

### Why PostgreSQL over DuckDB?
DuckDB is excellent for analytics but PostgreSQL gives us ACID transactions, `FOR UPDATE SKIP LOCKED` for the job queue, and production-grade reliability. JSONB handles the flexible raw payload storage. Drizzle's type safety works natively with PostgreSQL.

### Why SSE over WebSockets?
SSE is unidirectional (server → client), which is exactly what pipeline status and sync progress need. It works natively with Next.js `ReadableStream` without a custom server or library. WebSockets require protocol upgrades and state management for no benefit here.

### Why Claude with tool use for insights?
Pure deterministic rules produce the same insights every time and can't reason about context. Claude with tool use lets the AI decide *which* analyses matter for the current data state — if revenue is flat but failure rate spikes, it focuses there. The SQL tools remain testable without an LLM.

### Why no Redis/BullMQ?
The existing `syncJobs` PostgreSQL table is a perfect job queue backing store. `FOR UPDATE SKIP LOCKED` makes it concurrency-safe. Redis adds operational complexity for a project that doesn't need multi-process job distribution. BullMQ is an optional upgrade path if the project scales.

---

## Directory Structure

```
/
├── app/
│   ├── api/
│   │   ├── sync/trigger/          POST — start a sync job
│   │   ├── sync/status/           GET  — list sync jobs
│   │   ├── sync/[jobId]/stream/   GET  — SSE job progress
│   │   ├── upload/csv/            POST — CSV file ingest
│   │   ├── webhooks/stripe/       POST — Stripe webhook
│   │   ├── data/metrics/          GET  — KPI aggregates
│   │   ├── data/timeseries/       GET  — revenue by date
│   │   ├── data/transactions/     GET  — paginated transactions
│   │   ├── data/customers/        GET  — paginated customers
│   │   ├── data/profile/          GET  — data quality profile
│   │   ├── insights/              GET  — SSE AI insights stream
│   │   ├── pipelines/             GET+POST
│   │   ├── pipelines/[id]/        GET+PUT+DELETE
│   │   ├── pipelines/[id]/run/    POST — execute pipeline
│   │   ├── pipelines/[id]/stream/ GET  — SSE step status
│   │   ├── alerts/                GET+POST
│   │   ├── alerts/[id]/           PATCH+DELETE
│   │   ├── alerts/triggers/       GET
│   │   └── reports/generate/      GET  — streaming export
│   └── (dashboard)/
│       ├── analytics/             KPI dashboard
│       ├── pipelines/             Pipeline list + builder
│       ├── alerts/                Alert management
│       └── reports/               Report export
│
├── components/
│   ├── ui/                        Primitive UI components
│   ├── layout/                    Sidebar, Topbar, PageShell
│   ├── pipeline/                  React Flow canvas + nodes
│   ├── analytics/                 Charts, KPI cards, insight cards
│   ├── alerts/                    Alert form + history
│   └── reports/                   Filter + export button
│
├── lib/
│   ├── connectors/                Data source connectors
│   ├── normalization/             Adapters + dispatcher
│   ├── engine/                    ETL orchestrator + pipeline runner
│   ├── transforms/                Pure row transform functions
│   ├── insights/                  Claude agent + SQL tools
│   ├── alerts/                    Evaluator + dispatcher
│   ├── reports/                   Streaming export generator
│   ├── sse/                       SSE stream factory
│   └── db/                        Drizzle schema + client + migrations
│
├── types/                         Shared TypeScript interfaces
├── docker-compose.yml             PostgreSQL + app + optional Redis
├── Dockerfile                     Multi-stage production build
└── __tests__/                     Vitest unit + integration tests
```
