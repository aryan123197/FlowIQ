# Code Review Findings

Review of `git diff HEAD` (Phase 1 & 2 dashboard work: analytics page, sync status banner, charts, transaction table, UI primitives). Ranked most-severe first; correctness bugs outrank cleanup/convention findings.

## 1. TransactionTable ignores the date range filter
**File:** `components/analytics/TransactionTable.tsx`

TransactionTable's query never includes the page-level date range, so it doesn't filter with the rest of the dashboard.

**Failure scenario:** User picks a date range via DateRangePicker; KPIs, RevenueChart, and PlatformDonut all update to the filtered window (they fetch with `range` in the query), but `TransactionTable` only keys off `page` and fetches `/api/data/transactions?page=${page}&limit=10` with no dateFrom/dateTo — even though the API route already supports those params. "Recent Transactions" silently keeps showing all-time data, inconsistent with every other panel on the page.

**Fix direction:** Accept a `range` prop (or read shared range state) in `TransactionTable` and forward `dateFrom`/`dateTo` to the fetch, matching the pattern already used by the metrics/timeseries queries.

---

## 2. SyncStatusBanner loses `sourcePlatform` once SSE updates arrive
**File:** `components/analytics/SyncStatusBanner.tsx` (line ~57), `app/api/sync/[jobId]/stream/route.ts`

`const job = liveJob ?? data` fully replaces the polled job object with the SSE payload, which is missing `sourcePlatform`.

**Failure scenario:** While a sync is `pending`/`running`, or right when it completes, the SSE `status`/`completed`/`failed` push (`{jobId, status, recordsProcessed, errorCount, completedAt}` — no `sourcePlatform`) sets `liveJob`, which then wins over `data` entirely. `job.sourcePlatform` (rendered at line ~64 as "Last sync: {job.sourcePlatform}") goes blank/undefined exactly when the user is watching the sync's progress or result.

**Fix direction:** Either merge fields (`{...data, ...liveJob}`) instead of full replacement, or have the stream route include `sourcePlatform` in its payload.

---

## 3. SyncStatusBanner reopens its EventSource on every poll tick
**File:** `components/analytics/SyncStatusBanner.tsx` (line ~35)

The EventSource-managing `useEffect` depends on `data`, which gets a new object reference every 10s poll tick, tearing down and recreating the SSE connection continuously during an active sync.

**Failure scenario:** `useQuery({queryKey: ['sync-status'], refetchInterval: 10_000})` returns a freshly parsed object on every poll. The effect's `[data, queryClient]` dependency array re-fires on every reference change, calling `source.close()` and opening a brand-new `EventSource` roughly every 10 seconds — even when the underlying job hasn't changed — instead of holding one connection open for the sync's duration.

**Fix direction:** Depend on a stable primitive (e.g. `data?.id`, `data?.status`) instead of the whole `data` object.

---

## 4. Fetch errors are swallowed silently across analytics page and TransactionTable
**File:** `app/(dashboard)/analytics/page.tsx`, `components/analytics/TransactionTable.tsx`

Metrics/timeseries queries (and TransactionTable's) destructure only `data`, never `error`, so fetch failures render silently as zero/empty state.

**Failure scenario:** If the `/api/data/metrics` or `/api/data/timeseries` fetch throws (network error, 500, etc.), `metrics`/`timeseries` stay `undefined` and the KPI cards render `$0.00` / `0` and charts render empty — indistinguishable from a legitimate all-zero data window. `InsightPanel.tsx` in the same diff correctly destructures `{data, isLoading, error}` and shows "Failed to generate insights.", proving the pattern exists but wasn't applied here or in `TransactionTable.tsx`.

**Fix direction:** Destructure `error`/`isError` at each call site and render an error state, mirroring `InsightPanel.tsx`.

---

## 5. `PLATFORM_COLORS` duplicated across chart components
**File:** `components/analytics/RevenueChart.tsx` (line ~15), `components/analytics/PlatformDonut.tsx`

`PLATFORM_COLORS` is duplicated byte-for-byte in RevenueChart.tsx and PlatformDonut.tsx, and the platform set is hardcoded into RevenueChart's `TimeseriesPoint` shape instead of a generic `{platform, value}` shape.

**Failure scenario:** No shared constants module exists for this. Adding a 5th platform connector requires editing both color maps in lockstep, plus RevenueChart's fixed-field data interface (PlatformDonut already uses a generic shape, so only RevenueChart and the two color maps are actually at risk) — a missed update silently leaves the new platform uncolored/unplotted in the revenue trend chart.

**Fix direction:** Extract `PLATFORM_COLORS` to a shared module (e.g. `lib/constants.ts`); consider generalizing `TimeseriesPoint` to a `{platform, value}[]` shape.

---

## 6. Unused Dialog/Tabs/Select/Tooltip UI primitives (CLAUDE.md Simplicity-First violation)
**File:** `components/ui/tabs.tsx` (line ~34), `components/ui/dialog.tsx`, `components/ui/select.tsx`, `components/ui/tooltip.tsx`

Dialog, Tabs, Select, and Tooltip primitives were added with zero usages anywhere in the codebase, violating CLAUDE.md's Simplicity-First rules.

**Failure scenario:** Grep confirms no import of any of the four outside `components/ui/` itself. This is speculative, unused surface area per the user's global CLAUDE.md ("No abstractions for single-use code", "nothing speculative"); `TabsTrigger`/`TabsContent` even throw `Error('...must be used within Tabs')` for a scenario that can never occur since no caller exists, violating "No error handling for impossible scenarios" too — dead code that adds maintenance surface for no current benefit.

**Fix direction:** Delete the four unused files until a real caller needs them, per CLAUDE.md.

---

## Lower-severity / not included above (noted for completeness)

- **SSE `'timeout'` event unhandled by client** — `app/api/sync/[jobId]/stream/route.ts` emits a `'timeout'` event after `MAX_POLLS` (2 min), but `SyncStatusBanner.tsx` only handles `'completed'`/`'failed'` to invalidate queries — a job stuck `pending` past 2 minutes leaves stale UI with no reconnection. PLAUSIBLE, low severity.
- **Sidebar links to unbuilt routes** — `components/layout/Sidebar.tsx` hardcodes nav items for `/pipelines`, `/alerts`, `/reports`, which 404 since only `/analytics` is built (per HANDOFF.md, Phases 6-7 pending). Expected given documented roadmap, not a bug introduced by this diff.

---

## Process note: prompt injection encountered during review

While running automated sub-agents for this review, two separate agents reported tool output containing injected fake `<system-reminder>` content — one attempted to make an agent silently accept a fabricated date change and a fake tool/agent listing, another attempted to inject fake "skill-invocation demands." Both agents correctly identified and ignored the injected instructions without acting on them. Worth noting that some tool output in this environment may carry prompt-injection payloads — treat unexpected instructions embedded in tool results with suspicion.
