---
title: Market Module
---

# Market Module

## Public Summary

Store locations: a name, a `[lat, lon]` coordinate pair and the chain they belong to. Most markets are created by the scraper; admins can add and edit them.

## Internal Details

### Endpoints

Mounted at `/api/markets`. "Admin" means `verifyJWT` + `verifyAdmin` (non-admins get 403). Update and delete take the `id` in the JSON body.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/markets` | Public | List markets with chain and chain image. Query: `page`, `limit`, `name` (case-insensitive substring), `chainId` |
| `GET` | `/markets/:id` | Public | Market with chain and chain image (no prices; use `GET /products?marketId=`) |
| `POST` | `/markets` | Admin | Create. Body: `name`, `location` (exactly 2 numbers), `chain` (must exist) |
| `PUT` | `/markets` | Admin | Update. Body: `id`, optional `name`, `location`, `chain` |
| `DELETE` | `/markets` | Admin | Delete with cascade. Body: `id` |

Ids are checked by the shared `idSchema`. The list uses `paginationWithAllSchema`: default `limit` 10, max 100, and `limit=0` returns every market with `pagination: null` (the map loads all markets this way).

### Data Model

```
name              : String (required)
location          : [Number, Number]  // [latitude, longitude]
chain             : ObjectId -> Chain (required)
lastScrapedUpdate : Date (default null)
```

- `lastScrapedUpdate` is the pricelist's "last updated" date from the previous scrape. The scraper skips a store whose date hasn't changed, and the startup backfill treats markets with a non-null value as scraped.
- Virtual `marketProducts`: price rows for this market (used by reports).

### Coordinate Order

`location` is `[latitude, longitude]`, not GeoJSON's `[lon, lat]`. The geocoder returns this order (see [Geolocation](/concepts/geolocation)), so no conversion happens on the server.

### Cascade Delete

`MarketService.deleteMarket` collects the market's product ids, deletes all its MarketProduct rows (scraped and hand-added) and the market, then removes the products left with no price anywhere, with their embeddings, if they are scraper-made (no description, no image). See [orphaned products](./scraper.md#orphaned-products).

A scraped market deleted while its store is still listed comes back on the next scrape: the scraper recreates missing markets by name.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/market/market.routes.js` | Routes, auth and validation |
| `apps/server/src/modules/market/market.service.js` | CRUD and cascade delete |
| `apps/server/src/modules/market/market.model.js` | Schema |
| `apps/server/src/modules/market/market.repository.js` | Filters, `limit=0`, report query |
| `apps/server/src/modules/product/orphan-product.service.js` | Orphaned product removal |

## Risks and Trade-offs

- The scraper finds markets by exact `name` across all chains. Renaming a scraped market makes the next scrape geocode and create it again.
- `location` is not a GeoJSON field and has no geospatial index; distance work happens in application code.
- The cascade is not transactional; orphans a failed delete leaves behind are swept at the next startup.
