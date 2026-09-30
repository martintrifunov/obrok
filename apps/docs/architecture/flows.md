---
title: Data And Request Flows
---

# Data And Request Flows

## Public Summary

The platform has three critical flows:

- User request flow (client to API and routing).
- Data ingestion flow (scrapers into MongoDB).
- Search enrichment flow (embeddings and smart search).

## Internal Details

### User Request Flow

```mermaid
sequenceDiagram
  participant U as User
  participant C as Client
  participant N as Nginx
  participant A as API
  participant D as MongoDB
  U->>C: Interact with UI
  C->>N: /api/* request
  N->>A: Proxy request
  A->>D: Query/write data
  D-->>A: Result
  A-->>C: JSON response
  C-->>U: Render update
```

### Scraper Ingestion Flow

```mermaid
sequenceDiagram
  participant Cron as Scraper Cron
  participant S as ScraperService
  participant G as GeocoderService
  participant D as MongoDB
  Cron->>S: Trigger scheduled scrape
  S->>S: Run market-specific scrapers
  S->>G: Geocode market coordinates
  S->>D: Upsert chains/markets/products
  S->>S: Trigger embedding sync (if enabled)
```

### Search Flow

```mermaid
sequenceDiagram
  participant UI as Client Search UI
  participant API as Search/SmartSearch Routes
  participant SS as Search Services
  participant EMB as Embedding Service
  participant DB as MongoDB
  UI->>API: Search query
  API->>SS: Read query (rules; AI only to split meals) and execute strategy
  SS->>EMB: Generate query embedding
  EMB-->>SS: Query vector
  SS->>DB: Vector + keyword search
  DB-->>SS: Matched products
  SS-->>API: Ranked results (weighted fusion)
  API-->>UI: Search response
```

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/scraper/scraper.cron.js` | Cron trigger for ingestion flow |
| `apps/server/src/modules/scraper/scraper.service.js` | Scraper orchestration |
| `apps/server/src/modules/search/search.service.js` | Hybrid search (vector + keyword + fusion) |
| `apps/server/src/modules/search/smart-search.service.js` | Recipe and budget-aware search |
| `apps/client/src/features/map/pages/MapPage.jsx` | User-facing search and routing UI |

## Risks and Trade-offs

- Scraper reliability depends on external HTML structure stability.
- Embedding generation depends on third-party API availability and quota.
- Search quality and performance are coupled to embedding freshness.
