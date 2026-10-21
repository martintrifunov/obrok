---
title: Jobs, Cron, And Reports
---

# Jobs, Cron, And Reports

## Public Summary

Background work runs inside the API process: two `node-cron` schedules, a few one-off maintenance tasks at startup, and on-demand CSV report jobs. There is no separate worker or queue.

## Internal Details

### Scheduled Jobs

Both use `APP_TIME_ZONE` (`Europe/Skopje`) and are stopped on graceful shutdown.

| Job | Cron | Schedule | What it does |
|-----|------|----------|--------------|
| Scraper | `0 3 * * 1,4` | 03:00 Monday and Thursday | Runs every registered scraper in sequence (one failing market does not stop the rest), then syncs product embeddings (skipped if `ai-search` is off or no embedding service is configured), then refreshes the vector index if stale. See [Scraper](/backend/modules/scraper) and [Search](/backend/modules/search). |
| Analytics cleanup | `30 2 * * *` | 02:30 daily | Archives old months into monthly aggregates, then deletes old raw events and visitor sessions. Retention from `ANALYTICS_RAW_RETENTION_DAYS` (default 90). See [Analytics](/backend/modules/analytics). |

### Startup Tasks

Run once in `start()` before the crons are scheduled (see [Backend Overview](/backend/overview)):

- `scraperService.backfillLegacyPriceRows()` and `scraperService.sweepOrphanProducts()`.
- `reportService.abortInterruptedJobs()`: report jobs still `PENDING` or `PROCESSING` from a previous run become `ABORTED`.
- `reportService.cleanupStaleReports()`: deletes `report-*.csv` files older than 24 hours.

### Report Jobs

Admins create a report with `POST /api/reports`. The API answers 202 at once and builds the CSV in the background; the client polls the status every 2 seconds and downloads the file when it is `COMPLETED`. Endpoints, states, timeout and file handling are in the [Report Module](/backend/modules/report).

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/scraper/scraper.cron.js` | Scraper schedule |
| `apps/server/src/modules/analytics/analytics.cron.js` | Analytics cleanup schedule and retention env var |
| `apps/server/src/shared/utils/calendarDate.js` | `APP_TIME_ZONE` |
| `apps/server/src/server.js` | Startup tasks, cron start and stop |
| `apps/server/src/modules/report/report.service.js` | Report job processing |

## Risks and Trade-offs

- Crons run in the API process. A long scrape shares CPU and memory with requests.
- A missed run (process down at 03:00) is not retried; the next run happens at the next scheduled time.
- Report jobs run as in-process promises. A restart interrupts them; startup marks them `ABORTED` instead of resuming them.
