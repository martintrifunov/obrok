---
title: Architecture Decision Records
---

# Architecture Decision Records

## Public Summary

The major architectural decisions in Obrok, with the reason for each and what it costs. Where the patterns live in the code is listed in the [Pattern Catalog](/patterns/catalog).

## Internal Details

### ADR-001: Layered Express Architecture

- Status: Accepted
- Context: Feature growth required clear responsibility boundaries.
- Decision: Each module in `apps/server/src/modules/` is split into routes, controller, service, repository and model, wired together in `apps/server/src/container.js`.
- Consequences: Easier to test and read, at the cost of some boilerplate per module.

### ADR-002: Feature-Based Frontend Structure

- Status: Accepted
- Context: Dashboard and map functionality grew into many domains.
- Decision: Organize `apps/client/src/features/` by feature, each with its own `hooks`, `pages` and `components` as needed.
- Consequences: Clear ownership and navigation, with a risk of duplicated helpers across features.

### ADR-003: Self-Hosted OSRM Routing

- Status: Accepted
- Context: Routing to markets is needed without paying a third-party service per request.
- Decision: Run OSRM (`osrm/osrm-backend`, MLD algorithm) as its own container on preprocessed OpenStreetMap data for North Macedonia, built by `init-route-data.sh`.
- Consequences: Full control and no per-request cost, but the map data must be refreshed and the service operated in-house.

### ADR-004: Docker Compose For Dev And Prod

- Status: Accepted
- Context: Environments must be reproducible for onboarding and deployment.
- Decision: Maintain `docker-compose.dev.yml` and `docker-compose.prod.yml`.
- Consequences: Reproducible setups, but production is limited to a single host.

### ADR-005: Feature Flags For AI Search

- Status: Accepted
- Context: AI and embedding features cost money per call and behave less predictably.
- Decision: Gate them with the `ai-search` and `smart-search` flags, seeded as disabled and checked in both backend and frontend.
- Consequences: Safer rollout, but stale flags must be removed deliberately.

### ADR-006: Replace Axios With Native Fetch

- Status: Accepted
- Context: Axios added a dependency for functionality now available natively. Its interceptor pattern tied auth retry logic to a mutable shared instance, causing re-render issues.
- Decision: Replace axios with a thin wrapper in `apps/client/src/api/fetch.js` (`fetchPublic`, `fetchPrivate`) that reads auth state through Zustand's `getState()` and handles the `401` refresh and retry itself.
- Consequences: One dependency fewer, auth retry decoupled from the React lifecycle, and direct use with TanStack Query. Errors are a custom `HttpError` instead of `AxiosError`.

### ADR-007: Crash On Fatal Errors And Let Docker Restart The API

- Status: Accepted
- Context: A failed startup step used to leave the process alive but never listening, and a global `unhandledRejection` handler only logged errors. In both cases Docker saw a running container and never restarted it.
- Decision: `apps/server/src/server.js` exits with code 1 when startup fails and registers no `unhandledRejection` handler, so Node's default crash applies. `restart: always` in both compose files restarts the container.
- Consequences: The API recovers from transient failures without manual action. A persistent fault becomes a visible restart loop (see [Runbooks](/deployment/runbooks#api-keeps-restarting)).

### ADR-008: Refuse Other Origins Before Routing

- Status: Accepted
- Context: Refresh and logout use cookies. A page on another origin could trigger these routes even though CORS stops it from reading the response.
- Decision: `apps/server/src/config/corsOptions.js` allows requests with no `Origin` header or with `Origin` equal to `CLIENT_ORIGIN`, and fails every other one with a `403` (`Origin not allowed.`) before any route runs.
- Consequences: Cross-origin requests cannot cause side effects. `CLIENT_ORIGIN` must match the client's exact origin in every environment, or the app's own requests are refused.

## Source Anchors

| Path | Relevance |
| --- | --- |
| `apps/server/src/container.js` | ADR-001 wiring |
| `apps/client/src/features/` | ADR-002 structure |
| `init-route-data.sh`, `docker-compose.prod.yml` | ADR-003, ADR-004 |
| `apps/server/src/infrastructure/database/seed-feature-flags.js` | ADR-005 default flags |
| `apps/client/src/api/fetch.js` | ADR-006 |
| `apps/server/src/server.js` | ADR-007 |
| `apps/server/src/config/corsOptions.js` | ADR-008 |

## Risks and Trade-offs

- Records are written after the fact and have no dates. Add new decisions here when they are made, in the same change.
