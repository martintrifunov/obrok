# Obrok

Obrok is an open source web application that scrapes product data from nearby market chains and helps users plan affordable meals from real store inventory.

It combines a React frontend, an Express and MongoDB backend, OSRM routing, and a VitePress documentation site.

[Documentation](https://docs.obrok.net) | [Website](https://obrok.net) | [Environment Templates](./ENV_TEMPLATES.md) | [License](./LICENSE)

## Why Obrok?

Students looking for affordable meals usually have to jump between market flyers, store searches, recipe ideas, and map tools. That workflow is fragmented, hard to compare, and not especially useful when the real question is what meal can be made from products that are actually available nearby.

Obrok brings those pieces together. It collects product data from nearby chains, lets users search ingredients directly, and includes an AI recipe decomposition flow that turns meal searches into ingredient lists tied to real markets.

## What It Includes

- Scraped product data from nearby market chains
- AI recipe decomposition for meal-oriented search and ingredient-based results
- Ingredient-level search across chains, markets, and products
- Interactive map browsing for markets and nearby locations
- Route-aware travel estimates to selected markets through OSRM
- Reporting, insights, feature flags, and supporting admin flows
- Self-hosted development and deployment with Docker Compose
- Maintained engineering documentation for architecture and operations

## Repository Layout

- `apps/client` contains the React frontend built with Vite
- `apps/server` contains the Express API, data workflows, and background jobs
- `apps/docs` contains the VitePress documentation site
- `apps/nginx` contains the production reverse proxy configuration
- `data/map` stores OSRM routing data used by the map service

## Quick Start

The fastest way to run the project locally is through Docker Compose.

### Prerequisites

1. Install Docker and Docker Compose.
2. Configure the root `.env` file and `apps/client/.env` using [ENV_TEMPLATES.md](./ENV_TEMPLATES.md).
3. Prepare OSRM data under `data/map`.

### Run the full stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Local endpoints

- Frontend: `http://localhost:3500`
- Backend API: `http://localhost:5000`
- OSRM: `http://localhost:5001`
- Docs: `http://localhost:5173`

## Documentation

Project documentation lives in `apps/docs` and is published at [docs.obrok.net](https://docs.obrok.net). It covers architecture, backend modules, frontend flows, deployment, and engineering patterns.

### Run docs locally

```bash
cd apps/docs
npm install
npm run docs:dev
```

### Run docs in Docker Compose

```bash
docker compose -f docker-compose.dev.yml build docs
docker compose -f docker-compose.dev.yml up docs
```

### Build docs for verification

```bash
cd apps/docs
npm run docs:build
npm run docs:preview
```

## Development

The repository is structured as a small monorepo with separate client, server, docs, and infrastructure directories.

For day-to-day development:

- Use `docker-compose.dev.yml` to run the full stack locally
- Keep route data under `data/map` up to date before testing routing behavior
- Use `apps/docs` for architecture and operational documentation updates alongside code changes

## Production

Production runs behind Nginx with TLS handled by Let's Encrypt via Certbot. The production stack is defined in `docker-compose.prod.yml`.

### First-time server setup

For a new VPS, bootstrap certificates and start the stack with:

```bash
CERTBOT_EMAIL=you@example.com ./init-ssl.sh
```

Run `./init-route-data.sh` first; the script checks for OSRM data because Nginx won't start without it. It creates temporary certificates, starts Nginx, requests real certificates, reloads the web server, and brings the application online. Existing certificates are backed up first and restored if the request fails.

### Release workflow

Deployments are triggered from GitHub Actions on published releases.

1. Push the required changes.
2. Create a GitHub release.
3. Tag the release using the existing Calendar Versioning pattern, for example `v2026.03.13.1`.
4. Publish the release.

The deployment workflow connects to the VPS, pulls the tagged revision, rebuilds the docs site, injects the release version into the frontend environment, and recreates the production containers.

## Contributing

Contributions should keep code, deployment behavior, and documentation aligned. If a change affects architecture, flows, or operations, update the relevant docs in `apps/docs` as part of the same change set.

## License

This project is licensed under the terms in [LICENSE](./LICENSE).