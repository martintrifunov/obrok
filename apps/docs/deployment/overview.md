---
title: Deployment Overview
---

# Deployment Overview

## Public Summary

Obrok runs on Docker Compose in both environments. Development (`docker-compose.dev.yml`) publishes every service port and mounts the source for live reload. Production (`docker-compose.prod.yml`) runs on a single VPS behind Nginx, with Certbot renewing the Let's Encrypt certificate for `obrok.net` and `docs.obrok.net`. Releases deploy through GitHub Actions.

This page compares the two environments and points to the page for each task.

| Need | Page |
| --- | --- |
| Run the stack locally, env files, server npm scripts | [Development Environment](/deployment/dev-environment) |
| Production topology, first-time VPS setup, SSL, release pipeline | [Production Environment](/deployment/prod-environment) |
| How the docs site is built and served | [docs.obrok.net Hosting](/deployment/docs-obrok-net) |
| Something is broken in production | [Runbooks](/deployment/runbooks) |

## Internal Details

### Services Per Environment

| Service (container) | Development | Production |
| --- | --- | --- |
| `client` (`obrok_client`) | Vite dev server on `3500` | Not a service: the client bundle is built into the Nginx image |
| `docs` (`obrok_docs`) | VitePress dev server on `5173` | Not a service: the built site is mounted into Nginx |
| `nginx` (`obrok_nginx`) | Not used | Ports `80` and `443`, serves the client and docs, proxies API and OSRM |
| `certbot` (`obrok_certbot`) | Not used | Runs `certbot renew` every 12 hours |
| `api` (`obrok_api`) | Port `5000`, `nodemon` | No published port, `node ./src/server.js` |
| `osrm` (`obrok_osrm`) | Port `5001` | No published port |
| `db` (`obrok_db`, `mongo:8.0`) | Port `6969` on all interfaces | Port `6969` on `127.0.0.1` only |

Both files use one bridge network (`obrok_net` in dev, `obrok_prod_net` in prod), and in both the API waits for the `db` healthcheck (`mongosh` ping) before starting.

### Environment Files

Both environments read the same two files, documented in [ENV_TEMPLATES.md](https://github.com/martintrifunov/obrok/blob/main/ENV_TEMPLATES.md):

- Root `.env`: loaded into the API with `env_file`, and used by Compose to substitute `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` for the `db` service.
- `apps/client/.env`: `VITE_*` variables read by Vite in development. Production doesn't use it: the release workflow bakes the production values into the web image (see [Release Pipeline](/deployment/prod-environment#release-pipeline)). The root `.env` in production also holds `OBROK_TAG`, the release whose images run.

### GitHub Actions Workflows

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | Every pull request, every push to `develop`, and called by `deploy.yml` | Server: lint, typecheck, tests. Client: lint, tests, production build. Make its jobs required checks on `main` so a red PR can't merge. |
| `deploy.yml` | Release published | Runs `ci.yml`, then the SSH deploy to the VPS. See [Release Pipeline](/deployment/prod-environment#release-pipeline). |
| `docs-ci.yml` | Pull request touching `apps/docs/**` or the workflow file | `npm ci` and `npm run docs:build` in `apps/docs` |
| `gitlab-sync.yml` | Manual (`workflow_dispatch`) only | Force-pushes `origin/main` to the FINKI GitLab mirror. Automatic triggers are commented out. |

## Source Anchors

| Path | Relevance |
| --- | --- |
| `docker-compose.dev.yml` | Development services, ports, volumes |
| `docker-compose.prod.yml` | Production services, restart policies, volumes |
| `ENV_TEMPLATES.md` | Root and client environment variables |
| `.github/workflows/ci.yml` | Code checks on pull requests, `develop` pushes and releases |
| `.github/workflows/deploy.yml` | Release deployment |
| `.github/workflows/docs-ci.yml` | Docs build check on pull requests |
| `.github/workflows/gitlab-sync.yml` | Manual GitLab mirror push |

## Risks and Trade-offs

- One VPS hosts the app, the database, routing and docs. It is simple to run, but a host failure takes everything down at once.
- Dev and prod compose files are maintained separately, so a change to one (a new env var, volume or port) has to be mirrored by hand.
