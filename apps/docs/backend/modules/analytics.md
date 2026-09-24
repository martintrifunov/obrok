---
title: Analytics Module
---

# Analytics Module

## Public Summary

Tracks visitor and user behavior — page views, feature usage, session activity — and provides dashboard summaries with CSV export.

## Internal Details

### Files

| File | Role |
|------|------|
| `analytics.controller.js` | HTTP handlers |
| `analytics.service.js` | Aggregation and export logic |
| `analytics.routes.js` | Route definitions |
| `analytics.schema.js` | Zod validation |
| `analytics.model.js` | Event and aggregate schemas |
| `analytics.repository.js` | Data access |
| `analytics.cron.js` | Daily cleanup cron |

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/analytics/heartbeat` | Public | Track page view / activity |
| `GET` | `/analytics/summary` | JWT | Dashboard summary data |
| `GET` | `/analytics/feature-trends` | JWT | Feature usage trends |
| `GET` | `/analytics/export` | JWT (admin) | CSV export |

### Data Models

**AnalyticsEvent**
```
type     : PAGE_VIEW | HEARTBEAT | FEATURE_USAGE
visitorId: String
userId   : ObjectId → User (optional)
metadata : Object
createdAt: Date
```

**AnalyticsMonthlyAggregate** — pre-computed monthly rollups.

### Cron Job

- **Daily at 02:30 Europe/Skopje**: purges raw events older than 90 days.
- Monthly aggregates are retained indefinitely.

### Dual Identity Tracking

Events track both anonymous `visitorId` (cookie-based) and authenticated `userId` when available, allowing correlation of pre-login and post-login behavior.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/analytics/` | Controller, service, routes, schema, model, repository, cron |
