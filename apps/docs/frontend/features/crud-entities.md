---
title: CRUD Features (Chains, Markets, Products, Holidays)
---

# CRUD Features

## Public Summary

Chains, markets, products and public holidays share one admin pattern: a searchable, paginated list with edit and delete actions, and an add/edit form on its own route. Products add per-market price editing; chains and products have an image picker.

## Internal Details

### Shared Pattern

| Piece | Location | Behavior |
|-------|----------|----------|
| Section page | `features/dashboard/pages/{Entity}Page.jsx` | Search bar, add button, list |
| Search bar | `features/<entity>/components/{Entity}SearchBar.jsx` | Plain input; the list debounces it (`useDebounce`, 300 ms) |
| List | `features/<entity>/components/{Entity}List.jsx` | 5 rows per page; page resets to 0 when the search changes (`useResettablePage`); after deleting the last row on a page, steps back one page; redirects to `/login` on a 401 |
| Delete | List | `window.confirm`, then the delete mutation. Chain and market prompts warn that their price listings are removed too. |
| Form | `features/<entity>/pages/AddOrEdit{Entity}Form.jsx` | Edit mode when the route has an id. `useInitFromData` fills the form once per loaded record, so a refetch does not overwrite typed edits. |
| Errors | Form | `error.response.data` goes straight into `errors`: field messages under fields, `message` in an alert (see [error contract](../state-data#error-contract)) |

Feature folders: `chains`, `markets`, `products`, `public-holidays`.

### Query Hooks

Each `use{Entity}Queries.js` exports:

| Hook | Call | Key |
|------|------|-----|
| `use{Entities}({ searchTerm, page, limit = 5 })` | `GET /{entities}?page&limit&name` (products filter by `title`) | `[root, "list", searchTerm, page, limit]` |
| `use{Entity}(id)` | `GET /{entities}/:id`, enabled only with an id | `[root, "detail", id]` |
| `useSave{Entity}(isEditMode, id)` | `POST` or `PUT /{entities}` with the id in the body | mutation |
| `useDelete{Entity}()` | `DELETE /{entities}` with `{ id }` in the body | mutation |
| `useChainsDropdown()` / `useMarketsDropdown()` | `GET /chains?limit=0` / `GET /markets?limit=0` | `[root, "dropdown"]` |

Holidays use the path `/public-holidays` and root key `["public-holidays"]`.

Invalidation on success:

| Mutation | Also invalidates |
|----------|------------------|
| Save chain | markets |
| Delete chain | markets, products |
| Save market | chains |
| Delete market | products, chains |
| Save or delete product | chains, markets |
| Holiday mutations | holidays only |

### Per Entity

| Entity | Form fields | After save |
|--------|-------------|-----------|
| Chain | Name, image | `/dashboard` (redirects to chains) |
| Market | Name, chain (dropdown), latitude, longitude; sent as `location: [lat, lon]` | `/dashboard/markets` |
| Product | Title, category (free text), description (rich text), image, prices | `/dashboard/products` |
| Holiday | Name, date (both required) | `/dashboard/holidays` |

The markets list can open `SharedMarketProductsModal` to show a market's products. The products list shows each product's category and min to max price across markets.

### Product Prices

- **Create:** one market and one price (`market`, `price`).
- **Edit:** `MarketPricesTable` lists every market price. Hand-added prices (`lastSeenAt === null`) can be edited or marked for removal (and restored before saving). Scraped prices are read-only and labeled "Updated by scraper".
- `AddMarketPriceRow` stages a new price at a market the product is not sold at yet; staged rows can be removed before saving.
- On save, only changes are sent: `prices`, `removedMarkets`, `addedPrices`. Prices must be greater than 0.
- Clearing the image on an existing product sends `image: null`, because an omitted image means "keep it" on the server.

### Images

Chain and product forms use `FileUploader` (`.jpeg, .jpg, .png, .webp`). Upload is `POST /images` as `FormData` field `image`. The image library (`GET /images?limit=0`) is not fetched until the picker dialog opens.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/client/src/features/chains/` | Chain list, search, form, query hooks |
| `apps/client/src/features/markets/` | Market list, search, form, query hooks |
| `apps/client/src/features/products/` | Product list, form, price table, query hooks |
| `apps/client/src/features/products/utils/marketPrices.js` | `isManualPrice` rule |
| `apps/client/src/features/public-holidays/` | Holiday list, search, form, query hooks |
| `apps/client/src/features/images/hooks/useImageQueries.js` | Image library and upload |
| `apps/client/src/hooks/useInitFromData.js` | One-time form fill |
| `apps/client/src/hooks/useResettablePage.js` | Page reset on search change |
| `apps/client/src/components/ui/FileUploader.jsx` | File input |

## Risks and Trade-offs

- The four features copy the same list and form code instead of sharing components, so fixes have to be applied four times.
- Deletes use the browser's `confirm` dialog, which does not match the MUI styling.
- Cross-entity invalidation is hand-written per hook (see table) and easy to miss when relationships change.
