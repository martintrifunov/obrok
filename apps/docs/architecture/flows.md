---
title: Data And Request Flows
---

# Data And Request Flows

## Public Summary

Three flows carry the system: user requests (browser to API and to OSRM), price ingestion (scrapers into MongoDB, then embeddings), and search (product and meal). The containers they run on are in [System Architecture Overview](/architecture/overview).

## Internal Details

### User Request Flow

```mermaid
sequenceDiagram
  participant C as Client
  participant N as Nginx
  participant A as API
  participant D as MongoDB
  participant O as OSRM
  C->>N: /api/* request
  N->>A: Proxy
  A->>D: Query or write
  D-->>A: Result
  A-->>C: JSON
  C->>N: /route/v1/... (routing)
  N->>O: Proxy
  O-->>C: Route geometry
```

In production Nginx proxies both; in development the client calls the API and OSRM on their own ports. Requests from origins outside the CORS allow-list get a 403 before any route runs. Routing is detailed in [Routing & Map](/concepts/routing-and-map).

### Ingestion Flow

```mermaid
sequenceDiagram
  participant Cron as Scraper cron
  participant S as ScraperService
  participant G as GeocoderService
  participant D as MongoDB
  participant E as Embedding sync
  participant V as Vector index
  Cron->>S: 03:00 Mon and Thu, each chain in turn
  S->>S: Fetch the chain's store list
  S->>G: Geocode stores not yet in the database
  S->>S: Scrape stores in parallel browser tabs
  S->>D: Upsert products and prices, drop stale prices, unlisted stores' prices and orphan products
  Cron->>E: After all chains
  E->>D: Embed new or changed products
  Cron->>V: Reload if embeddings changed
```

Chains are Vero, Ramstore, Stokomak and KAM, run one after another; stores within a chain are scraped 2 at a time in production and 4 in development (`SCRAPER_CONCURRENT_TABS`). `npm run scrape` runs the same scrape outside the cron; the vector index picks up its embeddings within 10 minutes. Details: [Scraper Module](/backend/modules/scraper), [Geolocation](/concepts/geolocation).

### Search Flows

```mermaid
sequenceDiagram
  participant UI as Search dialog
  participant API as Search routes
  participant IP as Intent parser
  participant SS as SearchService
  participant EMB as Embedding service
  participant VI as Vector index
  participant DB as MongoDB
  UI->>API: GET /api/search or POST /api/smart-search
  opt Meal search
    API->>IP: Decompose meal
    IP->>DB: Saved decomposition (else Gemini)
    IP-->>API: Ingredients
  end
  API->>SS: Product query, or one call per ingredient
  par
    SS->>DB: Keyword matches
  and
    SS->>EMB: Query embedding (cached, else Gemini)
  end
  SS->>VI: Nearest products, scores for keyword hits
  SS->>DB: Keep priced products, prices, display data
  SS-->>API: Fused, ranked results
  API-->>UI: Products, or stores ranked for the meal
```

Product search never calls the intent parser, and meal ingredients use only the vector step (keyword search is their fallback when the index isn't ready). The vector index lives in API memory, not in MongoDB. Rules, weights and thresholds: [Search Module](/backend/modules/search).

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/nginx/nginx.conf` | Production proxying |
| `apps/server/src/config/corsOptions.js` | Origin allow-list |
| `apps/server/src/modules/scraper/scraper.cron.js` | Ingestion schedule, sync and index refresh |
| `apps/server/src/modules/scraper/scraper.service.js` | Per-chain scrape |
| `apps/server/src/modules/search/product-embedding-sync.service.js` | Embedding sync |
| `apps/server/src/modules/search/search.service.js` | Product search |
| `apps/server/src/modules/search/smart-search.service.js` | Meal search |
| `apps/client/src/features/map/components/GlobalAISearchDialog.jsx` | Search UI |
| `apps/client/src/features/map/pages/MapPage.jsx` | Map and routing UI |

## Risks and Trade-offs

- Scrapers depend on each chain's page structure; a site change breaks that chain until the scraper is fixed.
- New and changed products are found by keyword only until the embedding sync after the next scrape succeeds, which needs Gemini quota.
- A scrape run, embedding sync and index reload all happen in the API process while it serves traffic.
