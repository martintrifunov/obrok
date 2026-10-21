---
title: Development Environment
---

# Development Environment

## Public Summary

`docker-compose.dev.yml` runs the client, docs, API, OSRM and MongoDB locally with source mounted into the containers, so code changes reload without rebuilding images. This page covers setup, local endpoints, and the server's npm scripts.

## Internal Details

### Setup

Run from the repository root:

1. Create the root `.env` and `apps/client/.env` from [ENV_TEMPLATES.md](https://github.com/martintrifunov/obrok/blob/main/ENV_TEMPLATES.md), with these local values:
   - `CLIENT_ORIGIN=http://localhost:3500`. The API answers any other browser origin with `403 Origin not allowed.`
   - `DATABASE_URI` pointing at `obrok_db:27017` (the container network name), with the same credentials as `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`.
   - `MONGO_URI_LOCAL` only if you run server scripts on the host. MongoDB is published on port `6969`, so use `mongodb://<user>:<password>@localhost:6969/obrok?authSource=admin`.
   - In `apps/client/.env`: `VITE_API_URL=http://localhost:5000` and `VITE_OSRM_URL=http://localhost:5001/route/v1`. These are also the defaults in `apps/client/src/api/consts.js` when the variables are unset.
2. Prepare routing data: `./init-route-data.sh`. It downloads `macedonia-latest.osm.pbf` from Geofabrik into `data/map` and runs `osrm-extract` (car profile), `osrm-partition` and `osrm-customize`. Needs `wget` and Docker.
3. Start everything: `docker compose -f docker-compose.dev.yml up --build`.

To run only the docs site: `docker compose -f docker-compose.dev.yml up --build docs`.

### Local Endpoints

| Service | URL |
| --- | --- |
| Frontend (Vite) | `http://localhost:3500` |
| Docs (VitePress) | `http://localhost:5173` |
| API | `http://localhost:5000` |
| OSRM | `http://localhost:5001` |
| MongoDB | `localhost:6969` |

### Container Behavior

- `apps/client`, `apps/server` and `apps/docs` are bind-mounted into `/app`. The API runs under `nodemon`, the client under `vite --host 0.0.0.0`.
- `node_modules` lives in named volumes (`client_node_modules`, `server_node_modules`, `docs_node_modules`). Docker fills a named volume from the image only when the volume is new, so after a dependency change, remove the volume (for example `docker volume rm obrok_server_node_modules`, prefixed with the Compose project name) and run `up --build` again.
- MongoDB data persists in the `obrok_db` volume.
- `api` and `db` have `restart: always`. The API exits on a failed startup (`Startup failed:` in the log) and on an unhandled promise rejection (Node's default; there is no `unhandledRejection` handler). Under `nodemon` a crash leaves the container running and waiting for a file change, so in development save a file or run `docker restart obrok_api`.
- The docs image installs `git` so VitePress can show "last updated" times.

### Server npm Scripts

Defined in `apps/server/package.json`:

| Script | Purpose |
| --- | --- |
| `npm run scrape [key]` | Scrape all chains, or one (`vero`, `ramstore`, `stokomak`, `kam`), then sync product embeddings if the `ai-search` flag is on and `GEMINI_API_KEY` is set |
| `npm run scrape:db:wipe [key]` | Delete chains, markets, market products, products and embeddings; with a key, only that chain's data and the products left orphaned |
| `npm run coords:populate [--force] [key]` | Geocode store addresses into `src/data/market-coordinates.json` (Google with `GOOGLE_MAPS_API_KEY`, otherwise Nominatim). Writes the file, not the database |
| `npm run coords:seed` | Copy coordinates from `market-coordinates.json` onto matching markets in MongoDB |
| `npm run embeddings:generate` | Embed new or changed products (needs `GEMINI_API_KEY`; ignores the `ai-search` flag). Exits non-zero on failure |
| `npm run embeddings:generate:force` | Re-embed every product |
| `npm run eval:search [case] [--no-meals] [--json=path]` | Run the search evaluation cases in `src/scripts/search-eval/cases.js` |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint with zero warnings, `tsc -p jsconfig.json`, Vitest |

Where to run them:

- In the container: `docker exec obrok_api npm run scrape kam`. The script uses `DATABASE_URI` from the container environment.
- On the host: `cd apps/server && npm ci && npm run scrape kam`. The script uses `MONGO_URI_LOCAL`.

Every script first imports `src/scripts/load-env.js`, which loads the repository root `.env` before any module reads `process.env` (in a container that file is not present, and the variables come from `env_file` instead). `src/shared/utils/scriptMongoUri.js` picks the database: inside a container (detected by `/.dockerenv`) it prefers `DATABASE_URI`, on the host `MONGO_URI_LOCAL`, and each falls back to the other.

## Source Anchors

| Path | Relevance |
| --- | --- |
| `docker-compose.dev.yml` | Dev services, ports, volumes |
| `apps/client/Dockerfile.dev`, `apps/server/Dockerfile.dev`, `apps/docs/Dockerfile.dev` | Dev images |
| `init-route-data.sh` | OSRM data download and preprocessing |
| `apps/server/package.json` | Server npm scripts |
| `apps/server/src/scripts/load-env.js` | `.env` loading for scripts |
| `apps/server/src/shared/utils/scriptMongoUri.js` | Database URI choice for scripts |
| `apps/server/src/config/corsOptions.js` | `CLIENT_ORIGIN` check |

## Risks and Trade-offs

- Dev publishes MongoDB on all interfaces (`6969`). Fine on a workstation, unsafe on a shared network.
- `coords:populate` writes a file inside the source tree. Run it in development and commit the result: in production the file is part of the image and a change made in the container is lost on the next rebuild.
