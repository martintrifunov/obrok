---
title: Runbooks
---

# Runbooks

## Public Summary

Fixes for production problems: symptom, likely cause, and the commands to run. Service layout and setup are described in [Production Environment](/deployment/prod-environment).

## Internal Details

Run commands from the repository checkout on the VPS, after defining this shorthand in the shell:

```bash
alias dc='docker compose -f docker-compose.prod.yml'
```

### Health Check

```bash
dc ps                       # all five services up, db "healthy"
dc logs api --tail=200
dc logs nginx --tail=200
curl -sI https://obrok.net | head -1
curl -sI https://docs.obrok.net | head -1
```

### API Keeps Restarting

- **Symptom**: `obrok_api` shows `Restarting`, or `/api/` returns `502` from Nginx.
- **Cause**: the API exits on a failed startup (log line `Startup failed:`) or on an unhandled promise rejection, and `restart: always` starts it again. A restart loop means the failure repeats on every start, most often MongoDB being unreachable or a bad `.env` value.
- **Fix**:

  ```bash
  dc logs api --tail=200                              # find the first error before the exit
  docker inspect -f '{{.RestartCount}}' obrok_api
  dc ps db                                            # API waits for db to be healthy
  ```

  After fixing `.env`, recreate the container (a plain restart keeps the old environment): `dc up -d --force-recreate api`.

### Browser Requests Fail With 403

- **Symptom**: API calls from the site fail with `403` and `Origin not allowed.`
- **Cause**: the request's `Origin` header differs from `CLIENT_ORIGIN`. The CORS check refuses it before any route runs. Requests without an `Origin` header (same-origin, curl) are allowed.
- **Fix**: set `CLIENT_ORIGIN=https://obrok.net` (exact scheme and host, no trailing slash) in the root `.env`, then `dc up -d --force-recreate api`.

### SSL Certificate Not Renewing

- **Symptom**: certificate expiry warnings, or browsers reject the certificate.
- **Cause**: `obrok_certbot` stopped, the ACME challenge is not reachable over HTTP, or DNS no longer points at the VPS.
- **Fix**:

  ```bash
  dc ps certbot
  dc logs certbot --tail=100
  dc run --rm --entrypoint "certbot renew --dry-run" certbot
  curl -sI http://obrok.net/.well-known/acme-challenge/x   # expect 404 from Nginx, not a 301
  dc exec nginx nginx -s reload                           # load a renewed certificate now instead of within 12 h
  ```

  If the certificate files are missing or broken, reissue: `CERTBOT_EMAIL=you@example.com ./init-ssl.sh`. It backs up `data/certbot/conf` first and restores it if the request fails.

### Nginx Does Not Start

- **Symptom**: `obrok_nginx` exits right after start; the log mentions `host not found in upstream` or a missing certificate file.
- **Cause**: Nginx resolves `obrok_api` and `obrok_osrm` at startup, and needs `data/certbot/conf/live/obrok.net/*.pem`.
- **Fix**: `dc up -d api osrm`, check `ls data/map/*.osrm*` and `ls data/certbot/conf/live/obrok.net/`, then `dc up -d nginx`. With no certificate at all, run `init-ssl.sh`.

### Routing Broken Or Map Data Outdated

- **Symptom**: route requests to `/route/v1/...` return `502` or wrong routes.
- **Cause**: `obrok_osrm` is down, or `data/map` is missing or stale.
- **Fix**:

  ```bash
  dc logs osrm --tail=100
  curl -s "https://obrok.net/route/v1/driving/21.43,41.99;21.45,42.00?overview=false" | head -c 200
  ```

  To refresh the map data:

  ```bash
  cp -r data/map data/map.bak
  ./init-route-data.sh                  # replaces the download and rebuilds the .osrm files
  dc restart osrm
  ```

### Report Stuck Or Download Fails

- **Symptom**: an admin cannot start a report (`409 A report is already being generated`), a job ends as aborted, or download returns `Report file no longer exists.`
- **Cause**: each user may have one pending or processing job at a time. A job is aborted after 5 minutes, and jobs still pending or processing when the API restarts are marked aborted at the next startup. A CSV is deleted after a complete download, and any CSV older than 24 hours is deleted at startup.
- **Fix**: cancel the active job from the UI, or wait for the timeout, then start a new one. Check the API log and the reports volume:

  ```bash
  dc logs api --tail=300 | grep -i report
  docker exec obrok_api ls -la src/data/reports
  ```

### Re-Scrape Or Wipe A Chain

- **When**: a chain's prices look wrong or stale and the scheduled scrape (03:00 Europe/Skopje, Monday and Thursday) is too far away.
- **Commands** (keys: `vero`, `ramstore`, `stokomak`, `kam`):

  ```bash
  docker exec obrok_api npm run scrape kam              # one chain; omit the key for all
  docker exec obrok_api npm run scrape:db:wipe kam      # delete one chain's data (omit the key to wipe ALL scraped data)
  docker exec obrok_api npm run embeddings:generate     # embed new products if the scrape skipped it
  ```

  The scrape syncs embeddings itself when the `ai-search` flag is on and `GEMINI_API_KEY` is set. Script behavior and database selection are described in [Server npm Scripts](/deployment/dev-environment#server-npm-scripts). `lint`, `typecheck` and `test` do not work in the production container because dev dependencies are not installed.

### Docs Site Shows An Old Version

- **Symptom**: `docs.obrok.net` does not show changes that are merged.
- **Cause**: the docs ship inside the web image, which is built only when a release is published.
- **Fix**: publish a release. Check that `OBROK_TAG` in the root `.env` is the newest tag (`grep OBROK_TAG .env`) and that `obrok_nginx` runs that image (`docker compose -f docker-compose.prod.yml images nginx`).

### Release Deploy Failed

- **Symptom**: the `Deploy to VPS` workflow is red.
- **Cause**: `test` or `build` failed (nothing reached the VPS), or a step on the VPS failed (the checkout and `OBROK_TAG` may already be on the new tag).
- **Fix**: read the failed step in GitHub Actions. After a fix, re-run the failed jobs from the run page. To go back to the previous release, follow [Rollback](/deployment/prod-environment#rollback).

## Source Anchors

| Path | Relevance |
| --- | --- |
| `docker-compose.prod.yml` | Services, restart policies, volumes |
| `apps/nginx/nginx.conf` | Upstreams, ACME challenge path |
| `apps/server/src/server.js` | Startup failure exit |
| `apps/server/src/config/corsOptions.js` | `403 Origin not allowed.` |
| `apps/server/src/modules/report/report.service.js` | Report timeout, abort, cleanup |
| `apps/server/src/modules/scraper/scraper.cron.js` | Scrape schedule |
| `apps/server/src/modules/scraper/scraper.registry.js` | Scraper keys |
| `init-ssl.sh`, `init-route-data.sh` | Certificate and OSRM data scripts |

## Risks and Trade-offs

- `npm run scrape:db:wipe` without a key deletes every chain, market, product and embedding. Always pass the key unless a full reset is intended.
- `dc down -v` would delete the `obrok_db` and `obrok_reports` volumes. Use `dc down` or `dc restart` instead.
