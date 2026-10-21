# Obrok

Obrok is an open source web application that scrapes product prices from market chains in North Macedonia (Vero, Ramstore, Stokomak, KAM) and helps users plan affordable meals from what nearby stores actually sell.

Users can search ingredients across chains, let AI turn a meal into an ingredient list priced at real markets, and see the markets on a map with routes. Admins get a dashboard for managing data, reports, insights and feature flags. It is built with a React frontend, an Express and MongoDB backend, self-hosted OSRM routing, and a VitePress documentation site.

[![CI](https://github.com/martintrifunov/obrok/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/martintrifunov/obrok/actions/workflows/ci.yml)

[Documentation](https://docs.obrok.net) | [Website](https://obrok.net) | [Environment Templates](./ENV_TEMPLATES.md) | [License](./LICENSE)

## Repository Layout

- `apps/client`: React frontend (Vite)
- `apps/server`: Express API, scrapers, cron jobs and CLI scripts
- `apps/docs`: VitePress documentation site
- `apps/nginx`: production Nginx configuration
- `data/map`: OSRM routing data (created by `init-route-data.sh`)

## Quick Start

Requires Docker with Docker Compose, and `wget`.

1. Create the root `.env` and `apps/client/.env` from [ENV_TEMPLATES.md](./ENV_TEMPLATES.md). For local use set `CLIENT_ORIGIN=http://localhost:3500`, `VITE_API_URL=http://localhost:5000` and `VITE_OSRM_URL=http://localhost:5001/route/v1`.
2. Build the routing data: `./init-route-data.sh`
3. Start the stack:

   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3500` |
| API | `http://localhost:5000` |
| OSRM | `http://localhost:5001` |
| Docs | `http://localhost:5173` |
| MongoDB | `localhost:6969` |

Load data by running a scraper in the API container, for example `docker exec obrok_api npm run scrape kam` (keys: `vero`, `ramstore`, `stokomak`, `kam`; omit the key to scrape all).

## Documentation

Everything else is at [docs.obrok.net](https://docs.obrok.net), with the source in `apps/docs`:

- [Development environment and server scripts](https://docs.obrok.net/deployment/dev-environment)
- [Production setup, SSL and releases](https://docs.obrok.net/deployment/prod-environment)
- [Runbooks](https://docs.obrok.net/deployment/runbooks)
- [Docs process](https://docs.obrok.net/contributing/docs-process)

Releases are deployed by publishing a GitHub release with a calendar version tag such as `v2026.03.13.1`.

## License

See [LICENSE](./LICENSE).
