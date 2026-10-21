---
title: Pattern Catalog
---

# Pattern Catalog

## Public Summary

The recurring design patterns in Obrok and where to find each one. The decisions behind the larger ones are recorded in [Architecture Decision Records](/patterns/adrs).

## Internal Details

| Pattern | Purpose | Where Used |
| --- | --- | --- |
| Composition root | Builds repositories, services and controllers in one place and wires their dependencies | `apps/server/src/container.js` |
| Controller, service, repository | Separates HTTP handling, business logic and persistence in each module | `apps/server/src/modules/*` (for example `chain.controller.js`, `chain.service.js`, `chain.repository.js`) |
| Strategy with registry | One scraper class per chain, all extending `BaseScraper`, looked up by key (`vero`, `ramstore`, `stokomak`, `kam`) | `apps/server/src/modules/scraper/markets/`, `apps/server/src/modules/scraper/scraper.registry.js` |
| Middleware pipeline | Ordered cross-cutting HTTP concerns: Helmet, CORS, body parsing, cookies, visitor tracking, then routes and the error handler | `apps/server/src/app.js`, `apps/server/src/shared/middleware/` |
| Feature flag gate | Turns AI features (`ai-search`, `smart-search`) on and off at runtime | `apps/server/src/modules/feature-flag/`, `apps/client/src/store/featureFlagStore.js`, `apps/client/src/hooks/useFeatureFlag.js` |
| Query key factory | Predictable TanStack Query keys for caching and invalidation (for example `chainKeys`) | `apps/client/src/features/*/hooks/use*Queries.js` |
| Private fetch with retry | Adds the access token, refreshes it once on `401`, and replays the request | `apps/client/src/api/fetch.js` (`fetchPrivate`) |
| Persisted UI store | Keeps preferences across sessions with Zustand `persist` | `apps/client/src/store/themeStore.js` |

## Source Anchors

| Path | Relevance |
| --- | --- |
| `apps/server/src/container.js` | Server wiring |
| `apps/server/src/app.js` | Middleware order and route mounting |
| `apps/server/src/modules/scraper/scraper.registry.js` | Scraper registry |
| `apps/client/src/api/fetch.js` | HTTP client |

## Risks and Trade-offs

- The patterns are enforced by convention only. A new module that skips the layering or the key factory goes unnoticed until review.
