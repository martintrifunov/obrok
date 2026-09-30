---
title: Market Module
---

# Market Module

## Public Summary

Store locations with GeoJSON coordinates, chain association, and product pricing integration.

## Internal Details

### Files

Standard CRUD layer: controller, service, routes, schema, model, repository (7 files).

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/markets` | Public | List markets (searchable by name/chain) |
| `GET` | `/markets/:id` | Public | Market detail with products |
| `POST` | `/markets` | JWT | Create market |
| `PUT` | `/markets/:id` | JWT | Update market |
| `DELETE` | `/markets/:id` | JWT | Delete market + cascade |

### Data Model — Market

```
name             : String (required)
location         : [Number, Number] — [latitude, longitude]
chain            : ObjectId → Chain (required)
lastScrapedUpdate: Date
```

Virtual: `products` — populated via MarketProduct back-reference.

### Coordinate Order

Coordinates are stored as `[latitude, longitude]`, not GeoJSON's `[lon, lat]` order. This matches the tuple order used throughout the geocoding pipeline (see [Geolocation](/concepts/geolocation)) and by Nominatim's response fields; converting to GeoJSON order is only needed at the map-rendering boundary.

### Cascade Delete

Deleting a market removes all **MarketProduct** junction records for that market, then any **Products** left with no price in any market, with their embeddings, unless an admin edited them (description or image). See [orphaned products](./scraper.md#orphaned-products).

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/market/` | Controller, service, routes, schema, model, repository |
