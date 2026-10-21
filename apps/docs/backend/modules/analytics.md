---
title: Analytics Module
---

# Analytics Module

## Public Summary

First-party visitor analytics. The client sends a heartbeat on each page change and once a minute while the tab is visible. The server records page views and search feature usage, tracks who is active now, and serves an admin dashboard summary, a feature trend and a CSV export.

## Internal Details

### Files

| File | Role |
|------|------|
| `analytics.routes.js` | Routes, heartbeat rate limiter |
| `analytics.controller.js` | Handlers |
| `analytics.service.js` | Heartbeat, feature usage tracking, summary, CSV, cleanup |
| `analytics.repository.js` | Aggregations, session upsert, monthly archive |
| `analytics.schema.js` | `analyticsHeartbeatSchema`, `analyticsDaysQuerySchema` |
| `analytics.model.js` | `AnalyticsEvent`, `VisitorSession`, `AnalyticsMonthlyAggregate` |
| `analytics.cron.js` | Daily cleanup |

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/analytics/heartbeat` | Public, 30 per min per IP; JWT optional | Body `{ path?, isPageView? }`. Returns `{ ok: true }` |
| `GET` | `/api/analytics/summary` | JWT, role `admin` | Dashboard summary |
| `GET` | `/api/analytics/feature-trends` | JWT, role `admin` | Daily smart and hybrid search counts |
| `GET` | `/api/analytics/export` | JWT, username must equal `ADMIN_USERNAME` | CSV `insights-<from>-to-<to>.csv` |

The three GET routes share `analyticsDaysQuerySchema`: optional `days`, integer 7 to 365, default 30. The range runs from local midnight `days - 1` days ago until now.

### Identity

- `visitorTracking` (global middleware) gives every request a `req.visitorId`: the `obrok_vid` cookie, else the `x-visitor-id` header, else a new UUID. Values must match `[A-Za-z0-9-]{12,64}`. The cookie is httpOnly, `sameSite=lax`, 90 days.
- `optionalVerifyJWT` sets `req.user` (username) when a valid token is sent.
- Events store `identityKey` = `user:<username>` when logged in, else `visitor:<visitorId>`. Unique visitor counts group by this key.

### What Gets Recorded

| Trigger | Writes |
|---------|--------|
| Any heartbeat | Upserts the `VisitorSession` for this `visitorId` (`lastSeenAt`, `lastPath`, `userId`). No event. |
| Heartbeat with `isPageView: true` and a `path` | Also a `page_view` event |
| Hybrid search while `ai-search` is on | `feature_usage` event, `feature: "hybrid-search"` |
| Smart search while `smart-search` is on | `feature_usage` event, `feature: "smart-search"` |

The client (`useVisitorHeartbeat`) sends `isPageView: true` when the route changes and `false` for the 60-second keepalive and when the tab becomes visible again.

### Data Models

**AnalyticsEvent** (`analytics_events`)
```
visitorId  : String
userId     : String (username) or null
identityKey: String
eventType  : "page_view" | "feature_usage"
feature    : String or null
path       : String or null
metadata   : Mixed or null
occurredAt : Date
```

**VisitorSession** (`visitor_sessions`): one per `visitorId` with `userId`, `firstSeenAt`, `lastSeenAt`, `lastPath`. "Active users now" counts sessions with `lastSeenAt` in the last 5 minutes.

**AnalyticsMonthlyAggregate** (`analytics_monthly_aggregates`): one per month (`YYYY-MM`) with `visits`, `uniqueVisitors`, `smartSearchUses`, `hybridSearchUses`.

### Summary Response

`totalVisits`, `uniqueVisitors`, `currentMonthUniqueVisitors`, `activeUsersNow`, `featureUsage` (totals per feature), `featureUsageDaily`, `monthlyUniqueVisitors`, `daily`, plus `range`. `monthlyUniqueVisitors` merges archived months with months still in raw events (raw wins).

### Retention Cron

Daily at 02:30 Europe/Skopje, with `retentionDays` from `ANALYTICS_RAW_RETENTION_DAYS` (default 90):

1. Cutoff = now minus `retentionDays`; cutoff month = first day of that month.
2. Every month with raw events before the cutoff month is archived into `AnalyticsMonthlyAggregate`.
3. Raw events before the cutoff month are deleted, so raw data covers whole months and is kept between 90 and about 120 days.
4. Visitor sessions with `lastSeenAt` before the cutoff are deleted.

Monthly aggregates are never deleted.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/analytics/` | Module files |
| `apps/server/src/shared/middleware/visitorTracking.js` | Visitor ID cookie and header |
| `apps/server/src/modules/search/search.service.js` | Records `hybrid-search` usage |
| `apps/server/src/modules/search/smart-search.service.js` | Records `smart-search` usage |
| `apps/client/src/features/insights/hooks/useVisitorHeartbeat.js` | Client heartbeat timing |

## Risks and Trade-offs

- Day buckets use `$dateToString` without a timezone, so daily rows are UTC days, while the range start is server-local midnight.
- Visits only count when the client sends `isPageView: true`. Clients that do not run the hook (bots, API callers) do not appear.
- The CSV export is limited to the configured admin username, while the dashboard accepts any `admin` role.
