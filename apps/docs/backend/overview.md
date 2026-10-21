---
title: Backend Overview
---

# Backend Overview

## Public Summary

The backend is an Express service organized by modules and built with layered architecture: route/controller, service, repository, model.

## Internal Details

### Startup Lifecycle

1. Load environment and initialize Express.
2. Connect MongoDB.
3. Seed required baseline data.
4. Start scheduled jobs (scraper and analytics).
5. Start HTTP server.

A failed startup step or an unhandled promise rejection ends the process with exit code 1, and Docker's `restart` policy starts it again rather than leaving it running in an unknown state.

### Middleware Stack (Order Matters)

1. Helmet security headers.
2. CORS (with credentials enabled). Requests from any other origin get a 403 before any route runs.
3. Body parsers and cookie parser.
4. Visitor tracking.
5. Route mounting.
6. Centralized error handler.

### Module Boundaries

Main modules include auth, chain, product, market, image, scraper, search, feature-flag, public-holiday, report, and analytics.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/server.js` | Startup lifecycle |
| `apps/server/src/app.js` | Middleware stack and route mounting |
| `apps/server/src/container.js` | DI composition root |
| `apps/server/src/modules/` | All module directories |

## Risks and Trade-offs

- Container wiring is explicit and readable, but growth in module count increases maintenance cost in one central file.
- Cron jobs in the same process improve simplicity but reduce isolation from API workload.
