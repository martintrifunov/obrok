---
title: Insights, Reports & Feature Flags
---

# Insights, Reports & Feature Flags

## Public Summary

Three admin sections plus one app-wide hook: an analytics page fed by the visitor heartbeat, an async CSV report generator, and a feature-flag switchboard whose flags turn the map's AI features on and off.

## Internal Details

### Visitor Heartbeat

`useVisitorHeartbeat` runs in `App` for every route, but only after the terms are accepted (see [Frontend Overview](../overview#provider-composition)).

| Trigger | Request body |
|---------|--------------|
| Every pathname change | `{ path, isPageView: true }` |
| Every 60 seconds while the tab is visible | `{ path, isPageView: false }` |
| Tab becomes visible again | `{ path, isPageView: false }` |

- Sent with `fetchPublic` to `POST /analytics/heartbeat`, plus `Authorization: Bearer` when logged in so the server can attribute the visit.
- Like every request, it carries `X-Visitor-Id` (see [browser storage keys](../state-data#browser-storage-keys)).
- Failures are swallowed. The server rate-limits heartbeats to 30 per minute.

### Insights

`InsightsPage` at `/dashboard/insights`.

| Element | Source |
|---------|--------|
| Range select: 30 / 90 / 365 days | `days` query parameter |
| Stat cards: total visits, unique visitors, active users (5 min), smart search uses, hybrid search uses, unique visitors this month | `GET /analytics/summary?days=` |
| Line chart: visits and unique visitors over time | summary `daily` |
| Line chart: feature usage per day | `GET /analytics/feature-trends?days=` |
| Bar chart: smart vs hybrid search totals | summary `featureUsage` |
| Line chart: monthly unique visitors | summary `monthlyUniqueVisitors` |
| Export CSV button | `GET /analytics/export?days=`, saved as `insights-{days}d.csv` |

Summary and trends require the admin role. Export is stricter: the server only allows the user named by `ADMIN_USERNAME`; otherwise the page shows the server's message or "Only admin users can export insights CSV." Loading shows skeletons. Charts use Recharts.

### Reports

`ReportingPage` at `/dashboard/reporting`, hooks in `features/reports/hooks/useReportQueries.js`.

1. Filters: chain, market (narrowed to the chosen chain), from and to dates (both default to today).
2. `POST /reports` with `{ chainId?, marketId?, from, to }` returns `202` with a `jobId`.
3. `GET /reports/:jobId` is polled every 2 seconds while the status is `PENDING` or `PROCESSING`.
4. While active, Cancel calls `POST /reports/:jobId/cancel`. When `COMPLETED`, Download fetches `GET /reports/:jobId/download` and saves `Report.csv`.

| Status | Label |
|--------|-------|
| `PENDING` | Queued |
| `PROCESSING` | Generating |
| `COMPLETED` | Ready |
| `FAILED` | Failed (shows the job's `error`) |
| `CANCELLED` | Cancelled |
| `ABORTED` | Aborted (timed out) |

The job id lives in component state, so leaving the page loses track of the job.

### Feature Flags

| Piece | Behavior |
|-------|----------|
| `featureFlagStore.fetchFlags()` | Public `GET /flags` once on app start; returns key to boolean |
| `useFeatureFlag(key)` | `!!flags[key]` |
| `FeatureFlagsPage` | Lists flags from `GET /flags/admin` (admin only) with a switch each |
| `useToggleFeatureFlag()` | `PUT /flags` with `{ key, enabled }`, then invalidates the admin list and calls `refetchFlags()` so this tab sees the change at once |

Flags the client reads:

| Key | Gates |
|-----|-------|
| `ai-search` | Map AI search button; AI-mode toggle in `SharedMarketProductsModal` |
| `smart-search` | Meal tab in the AI search dialog |

Other open tabs keep their flags until reload.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/client/src/features/insights/hooks/useVisitorHeartbeat.js` | Heartbeat triggers and payload |
| `apps/client/src/features/insights/hooks/useInsightsQueries.js` | Summary, trends, CSV export |
| `apps/client/src/features/insights/pages/InsightsPage.jsx` | Analytics page |
| `apps/client/src/features/reports/hooks/useReportQueries.js` | Create, poll, cancel, download |
| `apps/client/src/features/dashboard/pages/ReportingPage.jsx` | Report filters and status UI |
| `apps/client/src/features/feature-flags/` | Admin flag page and hooks |
| `apps/client/src/store/featureFlagStore.js` | Public flag cache |
| `apps/client/src/hooks/useFeatureFlag.js` | Flag selector |
| `apps/server/src/modules/analytics/analytics.routes.js` | Heartbeat limit and admin checks |

## Risks and Trade-offs

- The heartbeat interval runs on every page, including the dashboard, so admin activity shows up in visitor stats.
- Report progress is not persisted; a refresh during generation leaves the job running on the server with no way to download it from the UI.
- Flags are fetched once per page load, so turning a flag off does not reach users who already have the app open.
