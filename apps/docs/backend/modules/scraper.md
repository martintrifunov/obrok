---
title: Scraper Module
---

# Scraper Module

## Public Summary

Automated web scraping pipeline using Puppeteer with concurrent tabs, market discovery, price collection, geocoding, and post-scrape embedding generation. Runs on a twice-weekly cron schedule.

## Internal Details

### Files

| File | Role |
|------|------|
| `scraper.service.js` | Orchestrator: launches browser, dispatches scrapers |
| `scraper.cron.js` | Cron schedule definition |
| `scraper.registry.js` | Plugin registry for market scrapers |
| `geocoder.service.js` | Nominatim geocoding with caching |
| `vero.scraper.js` | Vero market scraper |
| `ramstore.scraper.js` | Ramstore scraper |
| `stokomak.scraper.js` | Stokomak scraper |
| `kam.scraper.js` | KAM scraper |
| `superkitgo.scraper.js` | SuperKitGo scraper |
| `kipper.scraper.js` | Kipper scraper |
| `utils/` | Shared scraping utilities |

### Scripts

| Command | Description |
|---------|-------------|
| `npm run scrape` | Run all scrapers |
| `npm run scrape -- <chain>` | Run a single chain scraper |
| `npm run scrape:db:wipe` | Wipe all scrape-related data |
| `npm run scrape:db:wipe -- <chain>` | Wipe a single chain's data (markets, products, embeddings) |

### Cron Schedule

- **When**: Monday and Thursday at 03:00
- **Concurrency**: 2 tabs in production, 4 in development

### Pipeline

```mermaid
flowchart TD
    A[Cron Trigger] --> B[Launch Puppeteer Browser]
    B --> C[Load Scraper Registry]
    C --> D[For Each Registered Scraper]
    D --> E[Open Concurrent Tabs]
    E --> F[Navigate + Scrape Products/Prices]
    F --> G[Geocode New Markets]
    G --> H[Upsert Markets + Products + MarketProducts]
    H --> H2[Remove Stale Prices for the Store]
    H2 --> I[Generate Embeddings for New/Changed Products]
    I --> J[Close Browser]
```

### Stale Price Cleanup

Each scrape stamps `lastSeenAt` on every MarketProduct row it upserts. After a store is scraped, that store's stamped rows that weren't seen in this run are deleted, which removes delisted and out-of-stock products.

- Rows an admin created by hand have `lastSeenAt: null` and are never deleted by a scrape.
- Cleanup is skipped (with a warning) when the scraper reports `complete: false`, or when the store now lists fewer than half as many products as its previous scrape saw. A layout change or broken parser should not wipe a store. The baseline is the previous scrape, not all stored rows, so accumulated stale rows can't block cleanup. The first stamped scrape of a store has no baseline, so only the zero-products and incomplete checks apply to it.
- Stores whose pricelist is unchanged (`upToDate`) are skipped entirely, so nothing is deleted.
- Rows created before `lastSeenAt` existed are backfilled once per process, before the first scrape: rows in scraped markets are stamped as long unseen unless their product has a description or image (admin-only fields), which are marked admin-owned.

### Strategy + Registry Pattern

Each market scraper implements a common interface and registers itself in the scraper registry. The orchestrator iterates the registry without knowing scraper internals.

```js
// Each scraper exports: { name, scrape(page, deps) }
registry.register(veroScraper);
registry.register(ramstoreScraper);
// ...
```

### Geocoding

Three-tier strategy, in order:

1. **Static override** — `data/market-coordinates.json`, keyed by normalized market name. Checked first; this is how manually-corrected or chain-provided coordinates take precedence over the two automated tiers below.
2. **Nominatim lookup** — queries built from address, store name, and transliterated variants.
3. **City-center fallback** — if every Nominatim query fails, places the market near a hardcoded city-center coordinate with a small deterministic offset (so multiple failed lookups in the same city don't stack on one point).

See [Geolocation](/concepts/geolocation) for why the static tier exists and its known failure mode.

### Performance Optimizations

- **Request interception**: blocks images, CSS, fonts during scraping.
- **Navigation timeout**: 90 seconds per page.
- **Batch processing**: concurrent tab pool limits resource usage.

### Dependencies

- Product, Market, MarketProduct modules (upsert data)
- Image module (market images)
- Search module (post-scrape embedding generation)
- Feature Flag module (conditional behavior)
- Geocoder service (Nominatim)

### Chain-Specific Wipe

The wipe script (`wipe-db-scrape-data.js`) supports two modes:

- **Full wipe** (`npm run scrape:db:wipe`): deletes all chains, markets, market_products, products, and product_embeddings.
- **Per-chain wipe** (`npm run scrape:db:wipe -- <chain>`): deletes only the target chain's markets and market_products, removes orphaned products and embeddings not referenced by other chains, then deletes the chain record.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/scraper/` | Service, cron, registry, geocoder, market scrapers |
| `apps/server/src/scripts/wipe-db-scrape-data.js` | Full and per-chain data wipe |

## Failure Modes

| Failure | Behavior |
|---------|----------|
| Scraper page timeout | Skip market, log error, continue |
| Partial or suspiciously small scrape | Save the prices seen, keep the unseen ones, log a warning |
| Geocoding failure | Use city center fallback |
| Embedding generation failure | Products saved without embeddings |
| Browser crash | Cron retries on next scheduled run |
