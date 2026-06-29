# FlowIQ — Session Handoff Document

> For the next Claude session picking up this project. Read this before doing anything.

---

## What This Project Is

**FlowIQ** is a universal data pipeline and AI insight engine. It ingests data from multiple sources (Stripe, Shopify, Salesforce, CSV), normalizes it into a unified PostgreSQL schema, runs it through a visual drag-and-drop ETL pipeline builder, and surfaces AI-generated insights via Claude claude-sonnet-4-6 with tool use.

Full architecture: see `ARCHITECTURE.md`  
Full requirements: see `REQUIREMENTS.md`  
Implementation plan: see `/Users/aryangupta/.claude/plans/data-pipeline-insight-refactored-cookie.md`

---

## Current State

### Git

- Branch: `main`
- Last commit: Phase 5 complete (Analytics Dashboard UI)
- No GitHub remote yet (local only)

### What's Built (Phases 1 & 2)

**Database** — PostgreSQL 16, local at `localhost:5432/enterprise_data`

- 10 tables migrated: customers, transactions, syncJobs, alertRules, alertTriggers, pipelines, pipelineRuns, pipelineSteps, transformRules, pipelineOutputs
- Schema: `lib/db/schema.ts`
- Migration files: `lib/db/migrations/0000_curved_stature.sql`, `0001_rainy_captain_flint.sql`

**ETL Engine**

- `lib/connectors/index.ts` — factory: `createConnector(platform, config)`
- `lib/connectors/stripe.ts` — real Stripe API (v2026-04-22.dahlia)
- `lib/connectors/csv.ts` — PapaParse + Zod validation
- `lib/connectors/shopify.mock.ts` — mock: 5 customers, 8 orders
- `lib/connectors/salesforce.mock.ts` — mock: 3 contacts, 4 closed-won opps
- `lib/normalization/normalize.ts` — dispatch by platform → adapter
- `lib/normalization/adapters/` — stripe, shopify, salesforce, csv adapters
- `lib/engine/syncOrchestrator.ts` — core ETL loop (validate → fetch → normalize → upsert)
- `lib/sse/emitter.ts` — `createSSEStream()` factory used by all SSE routes

**AI Insight Agent**

- `lib/insights/agent.ts` — Claude claude-sonnet-4-6 tool-use loop → `Insight[]`
- `lib/insights/tools/` — 6 pure SQL functions: revenueTrend, anomalies, periodComparison, topCustomers, failureRate, platformBreakdown
- `lib/insights/types.ts` — Insight, InsightSeverity, all tool result types

**API Routes (all working, build passes)**

```
POST /api/sync/trigger          — start ETL sync for a platform
GET  /api/sync/status           — list recent sync jobs
GET  /api/sync/[jobId]/stream   — SSE real-time job progress
POST /api/upload/csv            — multipart CSV file ingest
POST /api/webhooks/stripe       — Stripe webhook (signature verified)
GET  /api/data/metrics          — KPI aggregates
GET  /api/data/timeseries       — revenue by platform per day/week/month
GET  /api/data/transactions     — paginated + filtered transactions
GET  /api/data/customers        — paginated + searchable customers
GET  /api/data/profile          — data quality stats
GET  /api/insights              — Claude-generated insight array
```

**Docs**

- `ARCHITECTURE.md` — full system diagram, layer breakdown, data flows, tech stack, design decisions
- `REQUIREMENTS.md` — user stories, functional + non-functional requirements, env var reference

---

## What's NOT Built Yet (Phases 4–8)

### Phase 3 — Alert Engine ✅ DONE

- `lib/alerts/metricCalculator.ts` — time-windowed SQL aggregations per alert metric (revenue_total, transaction_count, failed_transaction_rate, customer_count)
- `lib/alerts/evaluator.ts` — fetches enabled rules, compares metric vs threshold, inserts/resolves alertTriggers (dedupes — won't re-fire while an unresolved trigger exists for a rule)
- `lib/alerts/dispatcher.ts` — Nodemailer email + Slack webhook send
- Wired into `syncOrchestrator.ts` — `evaluateAlerts()` runs after every completed sync (failures are caught/logged, don't fail the sync job)
- `app/api/alerts/route.ts` — GET list + POST create
- `app/api/alerts/[id]/route.ts` — PATCH update + DELETE
- `app/api/alerts/triggers/route.ts` — GET trigger history (optional `?ruleId=` filter)
- Verified end-to-end: created a rule, triggered a sync, confirmed trigger row was inserted and dispatch failure was caught/logged without crashing the sync.

### Phase 4 — Pipeline Builder Backend ✅ DONE

- `lib/transforms/filter.ts` — hand-written tokenizer/parser for expressions like `"amount > 1000 AND status == 'completed'"`. No `eval()`/`new Function()`. Mixing AND/OR in one expression throws (no parens support).
- `lib/transforms/rename.ts`, `cast.ts`, `derive.ts`, `dedupe.ts` — column rename, type coercion, computed columns, dedup by key fields
- `lib/engine/transformRegistry.ts` — maps `ruleType` → transform function, `runTransform()` helper
- `lib/engine/pipelineRunner.ts` — Kahn's topological sort (throws on cycles / dangling edges), executes nodes in order, records `pipelineSteps` per node, marks run/step `failed` and rethrows on any node error
- `lib/engine/stepExecutor.ts` — `executeNode(node, inputRows, runId)`: `source` reads from `transactions` (optionally filtered by `platform`), `transform` calls the registry, `sink` writes rows into `pipelineOutputs` (see constraint #13) and passes rows through unchanged
- `app/api/pipelines/route.ts` — GET list + POST create (Zod-validated against React Flow's native graph shape)
- `app/api/pipelines/[id]/route.ts` — GET + PUT + DELETE
- `app/api/pipelines/[id]/run/route.ts` — POST → fire-and-forget `runPipeline()`, same pattern as `/api/sync/trigger`
- `app/api/pipelines/[id]/stream/route.ts` — SSE step-by-step status, polls `pipelineRuns`/`pipelineSteps`, same pattern as `/api/sync/[jobId]/stream`
- `lib/reports/generator.ts` — `generateReportStream()`, batches `transactions` rows (500/batch) into a CSV or JSON `ReadableStream`
- `app/api/reports/generate/route.ts` — GET, streams CSV/JSON as a file download
- Verified end-to-end: created a pipeline (source filtered by platform → filter transform → sink), ran it, confirmed correct row counts at each step via the SSE stream and persisted rows in `pipeline_outputs`.

### Phase 5 — Analytics Dashboard UI ✅ DONE

- `app/providers.tsx` — wraps the app in a `QueryClientProvider` (see constraint #15 below — `@tanstack/react-query` was added this phase, wasn't previously installed)
- `app/(dashboard)/layout.tsx` — renders `PageShell`
- `app/(dashboard)/analytics/page.tsx` — KPIs + charts + table + insights, all client-fetched via React Query, date range filters re-key the metrics/timeseries queries
- `app/page.tsx` — now redirects to `/analytics` (replaced the default `create-next-app` template page)
- `components/ui/` — button, card, badge, dialog, input, select, table, tabs, tooltip, spinner. **Hand-built, not shadcn** — no Radix/shadcn CLI in this project, just Tailwind + `class-variance-authority` + the `cn()` helper in `lib/utils.ts` (new file, also added this phase)
- `components/layout/Sidebar.tsx` (nav links to `/analytics`, `/pipelines`, `/alerts`, `/reports` — only `/analytics` has a page so far, the rest 404 until Phases 6–7), `Topbar.tsx` (renders `SyncStatusBanner`), `PageShell.tsx`
- `components/analytics/KpiCard.tsx`, `RevenueChart.tsx` (recharts `LineChart`), `PlatformDonut.tsx` (recharts `PieChart`)
- `components/analytics/TransactionTable.tsx` (`@tanstack/react-table`, paginated against `/api/data/transactions`), `InsightCard.tsx`, `InsightPanel.tsx` (hits `/api/insights`, 5min staleTime since it calls Claude)
- `components/analytics/SyncStatusBanner.tsx` — polls `/api/sync/status` every 10s via React Query; if the latest job is `pending`/`running`, opens an `EventSource` to `/api/sync/[jobId]/stream` for live updates and invalidates `metrics`/`timeseries`/`sync-status` queries on completion
- `components/analytics/DateRangePicker.tsx`
- Verified: `npm run build` clean, `/analytics` registered as a static-shell route, triggered a real shopify sync and confirmed `/api/data/metrics` reflected it (the same endpoint the dashboard calls)

### Phase 6 — Pipeline Builder UI ✅ DONE

- `@xyflow/react` (v12) installed — clean install, no `node_modules` duplicate-folder corruption (constraint #17 watchlist)
- `components/pipeline/types.ts` — `SourceNodeData`, `TransformNodeData`, `SinkNodeData` (all `Record<string, unknown>`-compatible per the backend's Zod node schema)
- `components/pipeline/nodes/` — `SourceNode.tsx`, `TransformNode.tsx`, `SinkNode.tsx`: minimal custom React Flow node renderers with `Handle`s wired for left-to-right flow (source: right only, transform: both, sink: left only)
- `components/pipeline/panels/` — `SourcePanel.tsx` (platform dropdown), `TransformPanel.tsx` (rule-type dropdown + a config sub-editor per rule type: filter expression input, rename/cast key-value rows, derive rule rows, dedupe key-fields csv), `SinkPanel.tsx` (label only). Uses plain native `<select>` — no `components/ui/select.tsx` exists (it was deleted in Phase 5 as unused dead code per constraint #16/CODE_REVIEW_FINDINGS.md #6), so panels don't reintroduce it.
- `components/pipeline/PipelineCanvas.tsx` — React Flow root: `useState` for nodes/edges (not the `@xyflow/react` hooks, since the parent page needs the graph to save), node click → side panel, `onChange` bubbles `{nodes, edges}` up to the page on every node/edge/connection change
- `components/pipeline/PipelineToolbar.tsx` — add Source/Transform/Sink buttons, Save, Run
- `components/pipeline/PipelineRunLog.tsx` — SSE consumer of `/api/pipelines/[id]/stream?runId=`, same `EventSource` + named-event pattern as `SyncStatusBanner.tsx` (`step`, `run-status`, `timeout`, `error` events)
- `app/(dashboard)/pipelines/page.tsx` — list + create (POST with empty graph, redirects into the builder)
- `app/(dashboard)/pipelines/[id]/page.tsx` — loads `graphJson`, renders canvas + toolbar, Save → PUT, Run → POST `/run` then mounts `PipelineRunLog` with the returned `runId`
- Verified end-to-end via curl (no browser extension available in this session): created a pipeline (source[shopify] → filter → sink) via the API, hit `/pipelines` and `/pipelines/[id]` (200, no server errors in dev log), ran it, confirmed SSE stream emitted `step` events for all 3 nodes and a terminal `run-status: completed`, confirmed `pipeline_outputs` row count matched the filter result (0 rows — test filter referenced a nonexistent field, which is expected `NaN > 0 → false` behavior, not a bug)

### Phase 7 — Alerts + Reports UI ✅ DONE

- `components/alerts/types.ts` — `AlertRule`, `AlertTrigger`, `AlertMetric`/`AlertOperator`/`AlertAction` (mirrors `lib/db/schema.ts` enums; `threshold`/`value` are strings client-side since Drizzle `numeric` columns serialize as strings over JSON)
- `components/alerts/AlertRuleForm.tsx` — create form: metric/operator/timeWindow/actionType selects, single "action target" input that maps to `actionConfig.to` (email) or `actionConfig.webhookUrl` (slack) depending on `actionType`
- `components/alerts/AlertRuleCard.tsx` — enable/disable toggle (PATCH) + delete (DELETE)
- `components/alerts/TriggerHistory.tsx` — GET `/api/alerts/triggers`, optional `?ruleId=` filter
- `app/(dashboard)/alerts/page.tsx` — rule list (click a card to filter trigger history by that rule) + create form + trigger history, all via React Query mutations invalidating `['alert-rules']`
- `components/reports/ReportFilter.tsx` — platform/status/date range/format controls (plain native `<select>`, same reasoning as the pipeline panels — no `select.tsx` primitive exists)
- `components/reports/ExportButton.tsx` — plain `<a href download>` to `/api/reports/generate?...`, not a fetch+blob — the route already sets `Content-Disposition: attachment` so browser-native download works. Renders a styled anchor directly rather than wrapping `Button` (which has no `asChild`/Radix `Slot` support, constraint #16)
- `app/(dashboard)/reports/page.tsx` — filter form + export button, no data preview (the export endpoint streams, doesn't return data for client display)
- Verified end-to-end via curl (no browser extension available this session either): created an alert rule (201), toggled disabled (PATCH 200), listed triggers (`[]`, expected — no triggers fired yet), downloaded both CSV and JSON reports and confirmed file content/headers, hit `/alerts` and `/reports` pages (200, dev log clean), deleted the test rule

### Phase 8 — Docker + Polish

- `Dockerfile` — multi-stage build, `output: 'standalone'` in next.config.ts
- Update `docker-compose.yml` — add app service + Redis optional profile
- `lib/db/seed.ts` — realistic sample data across all 4 platforms
- `README.md`
- Tests: syncOrchestrator, insight SQL tools (no LLM mock needed), transforms, alert evaluator

---

## Environment

### Local Setup

- Node: v22.23.1 (ARM64) via nvm — symlinked at `~/.local/bin/node`
- PostgreSQL: running locally at `localhost:5432`, user `postgres` (no password)
- Database: `enterprise_data` (already created and migrated)
- Docker: available but port 5432 is taken by local Postgres; Docker compose will conflict on that port

### .env.local (key values)

```
DATABASE_URL=postgresql://postgres@localhost:5432/enterprise_data
ANTHROPIC_API_KEY=sk-ant-api03-...  (real key, configured)
STRIPE_SECRET_KEY=sk_test_placeholder  (placeholder — real key needed for Stripe sync)
STRIPE_WEBHOOK_SECRET=whsec_placeholder
SMTP_HOST=smtp.gmail.com  (email alerts need SMTP_USER + SMTP_PASS to work)
```

### npm scripts

```bash
npm run dev          # start dev server
npm run build        # production build (clean as of last commit)
npm run db:generate  # generate new Drizzle migration (loads .env.local via dotenv-cli)
npm run db:migrate   # apply migrations (loads .env.local via dotenv-cli)
npm run db:studio    # open Drizzle Studio GUI
npm run test         # Vitest
```

---

## Key Architectural Constraints to Respect

1. **`transactions` has NO `updatedAt` column** — do not add it to upsert `set:` clauses
2. **`syncJobs` uses `sourcePlatform` not `platform`** — column is named `sourcePlatform`
3. **`customers` has NO `sourcePlatform` column and NO `csvId`** — dedup is by `email`
4. **Amounts are always integer cents** — $10.00 = 1000, never floats
5. **Currencies are lowercase ISO** — `usd` not `USD`
6. **BaseConnector.validate() returns `Promise<void>`** — not boolean
7. **Filter transforms must NOT use `eval()` or `new Function()`** — hand-written tokenizer only
8. **SSE via `createSSEStream()` in `lib/sse/emitter.ts`** — all SSE routes use this factory
9. **Drizzle `and()` with undefined filters** — pass `undefined` not empty conditions array to avoid SQL errors; use spread: `and(...conditions)` where conditions may be empty — test this carefully
10. **Claude model**: always use `claude-sonnet-4-6` (not claude-3, not opus)
11. **`transactions.customerId` is resolved in `syncOrchestrator.ts`'s `resolveCustomerId()`** — looks up by `customerEmail` against `customers.email` at upsert time. Don't expect adapters/connectors to set it directly (only Salesforce's adapter signature accepts a pre-resolved id, but nothing upstream ever passed one — the orchestrator is the single source of truth now)
12. **CSV transactions bypass `normalizeTransaction()`** — `CSVConnector.fetchTransactions()` already yields fully-formed `UnifiedTransaction` objects (column aliasing, Zod validation, status mapping all happen inside the connector). `syncOrchestrator.ts` special-cases `platform === 'csv'` to skip the redundant re-normalize step. Don't "fix" this by routing CSV back through `normalizeTransaction` — `csvRowToUnifiedTransaction` expects a raw-row shape (`row.date` as string) and will throw "Invalid time value" against the connector's already-unified shape (`transactionDate` as Date). The adapter function itself is now unused dead code in the sync path, left in place — only touch it if asked.
13. **Pipeline graphs use React Flow's native shape** — `{ nodes: [{id, type, data, position?}], edges: [{id, source, target}] }`, validated via Zod in `app/api/pipelines/route.ts`. No translation layer between the (not-yet-built) UI and the backend.
14. **Sink nodes persist to `pipelineOutputs`, not `transactions`** — `stepExecutor.ts`'s `sink` case inserts each output row into the `pipeline_outputs` table (`runId`, `nodeId`, `row` jsonb), then passes rows through unchanged so step metadata still reflects them. This was a deliberate decision (asked the user) to avoid a misconfigured pipeline silently corrupting the source-of-truth `transactions` table.
15. **`@tanstack/react-query` is now a dependency** — added in Phase 5 (wasn't in the original plan/package.json) because no data-fetching library existed and the user chose it over plain `useEffect`/`fetch`. `app/providers.tsx` sets up one `QueryClient` per app instance with `staleTime: 30s` and `refetchOnWindowFocus: false` as sane dashboard defaults — override per-query (e.g. `InsightPanel` uses 5min staleTime since `/api/insights` calls Claude).
16. **`components/ui/` is hand-built, not shadcn** — no `components.json`, no Radix deps. Don't run the shadcn CLI against this project or assume Radix primitives exist; primitives are plain Tailwind + `class-variance-authority` (already installed) + `cn()` in `lib/utils.ts`.
17. **Recurring `node_modules` corruption** — periodically, stray duplicate folders appear (e.g. `@types/pg 3`, `react 3`) causing `npm run build` to fail TypeScript with "Cannot find type definition file for 'X 3'". Root cause still unconfirmed (suspect a filesystem sync tool). Fix is always: confirm `package-lock.json` diff is clean (or only contains your intended dependency changes) via `git diff package-lock.json`, then `rm -rf node_modules && npm install`. This has now happened twice (Phase 3→4 transition, Phase 4→5 transition) — if it recurs again, worth investigating the actual root cause (e.g. iCloud/Dropbox sync on this directory) rather than just re-fixing it each time.

---

## Test Suite (Phases 1–4)

Added a Vitest suite (69 tests, all passing) covering Phases 1–4 against the real local Postgres DB (no mocking of DB/SQL — only `fetch` is mocked in alert dispatcher tests). Run with `npm run test`.

- `test/setup.ts` — truncates all relevant tables before/after each test for isolation
- `test/normalization.test.ts` — pure adapter functions (stripe/shopify/salesforce/csv → UnifiedCustomer/UnifiedTransaction), status mapping tables, cents conversion, currency lowercasing
- `test/syncOrchestrator.test.ts` — full `runSync()` runs against mock connectors: record counts, idempotency (run twice → no dupes), customerId resolution, CSV partial-failure handling, CSV error-rate threshold failure
- `test/insightTools.test.ts` — all 6 insight SQL tools against seeded data with hand-computed expected values
- `test/alerts.test.ts` — `metricCalculator`, `evaluateAlerts()` (breach → trigger, dedup while unresolved, auto-resolve, disabled rules skipped, dispatch failure doesn't block trigger creation)
- `test/transforms.test.ts` — all 5 transform functions, including filter expression parsing edge cases (AND/OR, mixed AND/OR rejection, malformed expressions)
- `test/pipelineRunner.test.ts` — full `runPipeline()` integration tests against real DB: source/transform/sink wiring, platform filtering, multi-step transform chains, cycle detection, failure propagation, `pipelineOutputs` persistence

**`vitest.config.ts` has `fileParallelism: false`** — required because all test files share one real Postgres DB and `beforeEach` truncates tables; running files in parallel processes causes cross-file truncation races. Don't remove this without giving each file its own schema/transaction isolation.

### Two real bugs found and fixed while writing these tests

1. **`transactions.customerId` was always `null`** — no platform ever resolved it before upsert, so `getTopCustomers()` always returned an empty list. Fixed via `resolveCustomerId()` in `syncOrchestrator.ts` (see constraint #11 above).
2. **CSV uploads always failed** — every CSV row threw "Invalid time value" because of the double-normalization bug (see constraint #12 above). This means CSV upload has likely never worked correctly until this fix.

---

## How to Verify the Current Build Works

```bash
# 1. Check the build compiles
npm run build

# 2. Start dev server
npm run dev

# 3. Trigger a mock sync (Shopify has data immediately)
curl -X POST http://localhost:3000/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"platform": "shopify"}'
# → returns { jobId: "...", status: "pending" }

# 4. Check job status
curl http://localhost:3000/api/sync/status

# 5. Check data landed
curl http://localhost:3000/api/data/metrics
curl http://localhost:3000/api/data/transactions

# 6. Test AI insights (requires ANTHROPIC_API_KEY, takes ~10s)
curl http://localhost:3000/api/insights
```

---

## Files to Read First in a New Session

In priority order:

1. This file (`HANDOFF.md`)
2. `ARCHITECTURE.md` — system diagram and design decisions
3. `lib/db/schema.ts` — source of truth for all column names and types
4. `types/index.ts` — UnifiedCustomer, UnifiedTransaction interfaces
5. `lib/engine/syncOrchestrator.ts` — understand the ETL loop before extending it
6. `/Users/aryangupta/.claude/plans/data-pipeline-insight-refactored-cookie.md` — full implementation plan with all remaining phases

---

## Next Session Should Start With

**Phase 8 — Docker + Polish.** `Dockerfile` (multi-stage, `output: 'standalone'` in `next.config.ts`), update `docker-compose.yml` (add app service + Redis optional profile), `lib/db/seed.ts` (realistic sample data across all 4 platforms), `README.md`, and a new Vitest suite covering Phases 5–7 (UI components don't strictly need tests per the existing suite's scope, but check with the user — the existing `test/` directory only covers Phases 1–4 backend logic).

Browser-extension caveat carried over from Phases 6 and 7: the Chrome browser-automation tool wasn't connected in either session, so the pipeline builder UI, alerts UI, and reports UI were all verified via `curl` + dev-server-log inspection (page 200s, no server exceptions, correct API responses) rather than visually in-browser. If the extension becomes available, worth doing one visual pass over `/pipelines/[id]` (canvas drag/connect/save), `/alerts` (form/card interactions), and `/reports` (filter + download) before Phase 8 polish.
