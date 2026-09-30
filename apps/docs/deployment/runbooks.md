---
title: Runbooks
---

# Runbooks

## Public Summary

Runbooks define routine operational tasks and incident responses for production.

## Internal Details

## 1. Service Health Check

1. Verify containers: docker compose -f docker-compose.prod.yml ps
2. Check API logs: docker compose -f docker-compose.prod.yml logs api --tail=200
3. Check Nginx logs: docker compose -f docker-compose.prod.yml logs nginx --tail=200
4. Validate DB health via compose health status.

## 2. SSL Renewal Failure

1. Confirm certbot container is running.
2. Inspect certbot logs for ACME or DNS issues.
3. Confirm challenge path is reachable in Nginx.
4. Re-run init-ssl.sh if bootstrap assets are missing.

## 3. OSRM Data Refresh

1. Backup current map data folder.
2. Run init-route-data.sh.
3. Restart osrm service.
4. Validate /route endpoint from application UI and API side.

## 4. Report Generation Incident

1. Check API logs for report service errors.
2. Verify data/report output path write permissions.
3. Verify MongoDB availability and query performance.
4. Retry with smaller date range or lower scope while investigating.

## 5. Scraper Data Management

1. Wipe all scraper data: `npm run scrape:db:wipe` (inside the API container).
2. Wipe a single chain: `npm run scrape:db:wipe -- <chain>` (e.g. `npm run scrape:db:wipe -- kam`).
3. Re-scrape the chain: `npm run scrape -- <chain>`.
4. Verify data via API or application UI.

Available chain keys: vero, ramstore, stokomak, kam, superkitgo.

## 6. docs.obrok.net Validation

1. Build docs from apps/docs folder (docs:build).
2. Validate static output exists at apps/docs/.vitepress/dist.
3. Confirm Nginx server_name docs.obrok.net serves static content and returns docs pages.
4. Confirm HTTPS certificate issuance for docs domain.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `docker-compose.prod.yml` | Production service topology |
| `init-ssl.sh` | SSL bootstrap script |
| `init-route-data.sh` | OSRM data preparation |
| `apps/server/src/modules/report/report.service.js` | Report generation logic |
