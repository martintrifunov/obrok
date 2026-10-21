---
title: Production Environment
---

# Production Environment

## Public Summary

Production is `docker-compose.prod.yml` on one VPS. Nginx is the only public entrypoint (ports 80 and 443): it serves the React bundle and the docs site, and proxies the API and OSRM. Certbot keeps one Let's Encrypt certificate for `obrok.net` and `docs.obrok.net` renewed. Publishing a GitHub release runs the tests and redeploys over SSH.

## Internal Details

### Runtime Topology

```mermaid
flowchart LR
  Internet --> Nginx["Nginx :80/:443"]
  Nginx -->|"/api/, /uploads/"| API["Express API :5000"]
  Nginx -->|"/route/"| OSRM["OSRM :5001"]
  Nginx -->|"/ (obrok.net)"| Bundle["Client bundle in image"]
  Nginx -->|"docs.obrok.net"| Docs["apps/docs/.vitepress/dist"]
  API --> DB[("MongoDB")]
  Certbot -.->|"data/certbot (shared)"| Nginx
```

### Services

| Service | Image or build | Restart | Notes |
| --- | --- | --- | --- |
| `nginx` (`obrok_nginx`) | `ghcr.io/martintrifunov/obrok-web:<OBROK_TAG>`, built from `apps/nginx/Dockerfile`: the Vite bundle and the docs site in `nginx:alpine` | `unless-stopped` | Mounts `apps/nginx/nginx.conf`, `data/certbot/conf` and `data/certbot/www`. Runs `nginx -s reload` every 12 hours to pick up renewed certificates |
| `certbot` (`obrok_certbot`) | `certbot/certbot` | `unless-stopped` | Runs `certbot renew` every 12 hours |
| `api` (`obrok_api`) | `ghcr.io/martintrifunov/obrok-api:<OBROK_TAG>`, built from `apps/server/Dockerfile.prod`: `npm ci --omit=dev`, Alpine Chromium for Puppeteer, runs as `node` | `always` | `init: true` forwards SIGTERM to Node so graceful shutdown runs (crons stop, server closes, Mongo disconnects; forced exit after 8 s) |
| `osrm` (`obrok_osrm`) | `osrm/osrm-backend` | `unless-stopped` | `osrm-routed --algorithm mld --port 5001 /data/macedonia-latest.osrm`, data from `data/map` |
| `db` (`obrok_db`) | `mongo:8.0` | `always` | Published only on `127.0.0.1:6969`; healthcheck gates API start |

Persistent data:

| Data | Where |
| --- | --- |
| MongoDB | Named volume `obrok_db` |
| Generated CSV reports | Named volume `obrok_reports` at `/app/src/data/reports` |
| Uploaded images | Bind mount `apps/server/src/uploads` |
| Certificates and ACME webroot | `data/certbot/conf`, `data/certbot/www` |
| OSRM data | `data/map` |

### API Crash Behavior

The API process exits instead of staying up in a broken state, and `restart: always` brings it back:

- A failed startup (database connection, seeding, startup cleanup) logs `Startup failed:` and exits with code 1.
- An unhandled promise rejection crashes the process (Node's default; `server.js` registers no `unhandledRejection` handler).

### Nginx Routes

`obrok.net` (HTTPS, HTTP/2, HSTS):

| Location | Behavior |
| --- | --- |
| `/` | Client bundle with SPA fallback to `index.html`, `expires -1` so a new deploy is picked up |
| `/assets/` | Hashed bundles, `expires 1y`, `404` when missing (no fallback, so a stale page does not get HTML for its JS) |
| `/api/`, `/uploads/` | Proxied to `obrok_api:5000` |
| `/route/` | Proxied to `obrok_osrm:5001`. Only the OSRM `route` service is reachable (`VITE_OSRM_URL=https://obrok.net/route/v1`) |

Port 80 serves `/.well-known/acme-challenge/` from `/var/www/certbot` and redirects everything else to HTTPS. `client_max_body_size` is `12m` (uploads are capped at 10 MB by multer). The `docs.obrok.net` block is described in [docs.obrok.net Hosting](/deployment/docs-obrok-net).

Nginx resolves `obrok_api` and `obrok_osrm` when it starts, so it fails to start if either container is missing.

### First-Time VPS Setup

From the repository checkout on the VPS:

1. Create the root `.env` (see [ENV_TEMPLATES.md](https://github.com/martintrifunov/obrok/blob/main/ENV_TEMPLATES.md)). `CLIENT_ORIGIN` must be `https://obrok.net` or browsers get `403`. Add `OBROK_TAG=<a published release tag>` so the next steps pull that release's images. The client's `VITE_*` values are baked into the web image in CI, so production needs no `apps/client/.env`.
2. `./init-route-data.sh` to build OSRM data in `data/map`.
3. `CERTBOT_EMAIL=you@example.com ./init-ssl.sh`

`init-ssl.sh` does the following:

1. Refuses to run without a real `CERTBOT_EMAIL` or without `data/map/*.osrm*` files.
2. If `data/certbot/conf` exists, asks for confirmation and moves it to `data/certbot/conf.bak-<timestamp>`. On any later error it restores the backup and restarts Nginx.
3. Creates a one-day self-signed certificate under `live/obrok.net`, pulls the `OBROK_TAG` images and starts Nginx (`up --force-recreate -d nginx`, which also starts `api`, `osrm` and `db`). An image that can't be pulled is built locally; for the web image, build the docs first.
4. Deletes the dummy certificate and requests a real one with `certbot certonly --webroot` for both domains under the certificate name `obrok.net`.
5. Reloads Nginx, deletes the backup, and runs `docker compose -f docker-compose.prod.yml up -d`.

After that, `certbot` renews and `nginx` reloads on their 12-hour loops; no cron is needed.

### Release Pipeline

`.github/workflows/deploy.yml` runs when a GitHub release is published. Tags follow calendar versioning, for example `v2026.03.13.1`.

1. **test**: runs `.github/workflows/ci.yml`, the same checks every pull request gets (server lint, typecheck and tests; client lint, tests and build, on Node 24). A failure stops the release before anything touches the VPS.
2. **build**: builds the docs (with full git history, for "last updated"), then `docker compose -f docker-compose.prod.yml build nginx api` and `push`, with `OBROK_TAG` set to the release tag. Images go to GitHub Container Registry as `ghcr.io/martintrifunov/obrok-web:<tag>` and `obrok-api:<tag>`. The client's `VITE_*` build args default to the production values in the compose file; the optional repository variables `VITE_API_URL`, `VITE_OSRM_URL` and `VITE_DEFAULT_VISIBLE_CHAINS` override them, and `VITE_RELEASE_VERSION` is the tag.
3. **deploy**: SSH to the VPS with `appleboy/ssh-action` using secrets `VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_KEY`, `VPS_PASSPHRASE`. The checkout path is the `VPS_APP_DIR` repository variable, defaulting to `/home/maco/projects/obrok`. On the VPS it:
   1. `git fetch --tags --force` and `git checkout -f <tag>` (for the compose file and `nginx.conf`).
   2. Sets `OBROK_TAG=<tag>` in the root `.env`, so later `docker compose` commands use this release.
   3. Logs in to GHCR with the job's short-lived token, pulls `nginx` and `api`, and logs out.
   4. `docker compose -f docker-compose.prod.yml up -d --no-build`, which recreates the containers whose image changed.
   5. `docker image prune -af --filter "until=720h"`: unused images older than 30 days are removed; every release stays in GHCR.

Nothing is built on the VPS, so it needs Docker and the repository checkout, but no Node.

### Rollback

Set `OBROK_TAG` in the root `.env` to the previous release tag, then:

```bash
docker compose -f docker-compose.prod.yml pull nginx api   # skip if the images are still on the VPS
docker compose -f docker-compose.prod.yml up -d --no-build
```

Pulling works without a login if the two GHCR packages are public (package settings on GitHub); otherwise log in first with a token that has `read:packages`. Run `git checkout <tag>` as well if `nginx.conf` or the compose file changed between the releases.

## Source Anchors

| Path | Relevance |
| --- | --- |
| `docker-compose.prod.yml` | Services, restart policies, volumes |
| `apps/nginx/nginx.conf` | Routes, TLS, headers |
| `apps/nginx/Dockerfile` | Web image: client bundle and docs site in Nginx |
| `apps/server/Dockerfile.prod` | Production API image |
| `apps/server/src/server.js` | Startup, exit on failure, graceful shutdown |
| `init-ssl.sh` | Certificate bootstrap |
| `init-route-data.sh` | OSRM data preparation |
| `.github/workflows/deploy.yml` | Release pipeline: test, build and push images, deploy |

## Risks and Trade-offs

- Everything runs on one host, so a host incident takes down the app, database, routing and docs together.
- Images are built in CI, so a failed build stops the release before the VPS is touched. A failure on the VPS after `git checkout` leaves the checkout on the new tag while the old containers keep running; see [Rollback](#rollback).
- The client's `VITE_*` values are baked in when the web image is built; changing them needs a new release (or the repository variables plus a re-run).
- Nginx and Certbot use `unless-stopped`: a container stopped by hand stays stopped after a reboot.
