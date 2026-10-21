---
title: Backend Overview
---

# Backend Overview

## Public Summary

The backend is a single Express process. Each module under `src/modules/` follows routes, controller, service, repository, model. `container.js` wires every service and controller by hand (no DI library). Cron jobs run in the same process as the API.

## Internal Details

### Startup (`start()` in `server.js`)

1. Connect to MongoDB (`DATABASE_URI`).
2. Seed baseline data: admin user (`seedAdminUser`), chain images, feature flags. The admin seed throws if `ADMIN_USERNAME` or `ADMIN_PASSWORD` is unset.
3. Data repair: backfill `lastSeenAt` on legacy price rows, sweep orphan products.
4. Reports: mark jobs left `PENDING`/`PROCESSING` by a previous run as `ABORTED`, delete stale CSV files.
5. Start the scraper and analytics crons.
6. Start listening on `PORT` (default 5000).
7. Load the vector index in the background. Search is keyword-only until it is ready.

If any step before `listen` fails, `start()` logs the error and exits with code 1. An unhandled promise rejection also ends the process (Node's default behavior; `server.js` adds no handler). In production the `api` service has `restart: always`, so Docker starts it again.

### Shutdown

On `SIGTERM` or `SIGINT` the server stops the cron tasks, closes the HTTP server, disconnects Mongoose and exits 0. If that takes longer than 8 seconds it forces exit 1 (Docker sends `SIGKILL` 10 seconds after `SIGTERM`). The prod compose file sets `init: true` so the signal reaches Node.

### Middleware Order (`app.js`)

| # | Middleware | Notes |
|---|------------|-------|
| 1 | `trust proxy` = 1 | Real client IP behind nginx (used by rate limiters) |
| 2 | Helmet | CSP only when `NODE_ENV=production`; `crossOriginResourcePolicy: cross-origin` |
| 3 | CORS (`corsOptions.js`) | Other origins get a 403 before any route runs. See [Auth and Security](/backend/auth-security) |
| 4 | `urlencoded` and `json` parsers | 1 MB body limit |
| 5 | `cookieParser` | |
| 6 | `visitorTracking` | Sets `req.visitorId`, see [Analytics](/backend/modules/analytics) |
| 7 | `/uploads` static | Serves `src/uploads` |
| 8 | Routers under `/api` | See mounts below |
| 9 | `errorHandler` | Maps errors to status codes |

### Route Mounts

| Prefix | Module |
|--------|--------|
| `/api` | auth (`/login`, `/logout`, `/refresh`) |
| `/api/chains` | chain |
| `/api/products` | product |
| `/api/images` | image |
| `/api/markets` | market |
| `/api/flags` | feature-flag |
| `/api/search` | search (hybrid) |
| `/api/smart-search` | search (smart) |
| `/api/public-holidays` | public-holiday |
| `/api/reports` | report |
| `/api/analytics` | analytics |

The scraper module has no routes. It runs from its cron and from `npm run scrape`.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/server.js` | Startup, seeds, crons, graceful shutdown |
| `apps/server/src/app.js` | Middleware order and route mounting |
| `apps/server/src/container.js` | Composition root |
| `apps/server/src/infrastructure/database/seed.js` | `seedAdminUser` |
| `apps/server/src/infrastructure/database/seed-feature-flags.js` | Default flags |
| `apps/server/src/infrastructure/database/seed-chain-images.js` | Chain image seed |
| `docker-compose.prod.yml` | `api` restart policy and `init: true` |

## Risks and Trade-offs

- All wiring lives in one `container.js`. Easy to read, but every new module edits it.
- Crons share the API process. A heavy scrape competes with request handling, and a crash takes both down until Docker restarts the container.
- Exiting on unknown errors relies on the Docker restart policy. Outside Docker (for example `npm start` on a host) nothing restarts the process.
