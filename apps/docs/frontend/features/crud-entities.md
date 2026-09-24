---
title: CRUD Features — Chains, Markets, Products
---

# CRUD Features

## Public Summary

Chains, Markets, and Products share a common CRUD UI pattern: paginated list with search, add/edit form with validation, image association, and delete confirmation.

## Internal Details

### Shared Pattern

Each CRUD feature follows the same structure:

```
feature/
  ├── {Entity}List.jsx           # Paginated table with search
  ├── {Entity}SearchBar.jsx      # Debounced search input
  ├── AddOrEdit{Entity}Form.jsx  # Create/edit form
  └── use{Entity}Queries.js      # React Query hooks
```

### React Query Conventions

Each `use{Entity}Queries.js` file exports:

| Hook | Query Key | Purpose |
|------|-----------|---------|
| `useEntities()` | `[entity, page, search]` | Paginated list |
| `useEntity(id)` | `[entity, id]` | Single entity detail |
| `useCreateEntity()` | mutation | Create with cache invalidation |
| `useUpdateEntity()` | mutation | Update with cache invalidation |
| `useDeleteEntity()` | mutation | Delete with cache invalidation |

Mutations invalidate related query keys (e.g., deleting a chain invalidates markets and products).

### Chains

- Associates an image from the shared image library.
- Cascade-deletes markets and market products on removal.
- CSV report export endpoint.

### Markets

- Chain dropdown selector (populated from chains API).
- Longitude/latitude coordinate inputs for geolocation.
- Products listed inline via shared modal.

### Products

- Rich text editor for descriptions.
- Multi-market pricing (price range display in the list).
- Edit form shows a per-market price table: hand-added prices are editable and removable, scraped prices are read-only ("Updated by scraper"). An "Add price" row stages a new hand-added price at a market the product isn't sold at yet; staged rows can be removed before saving.
- Category filtering.
- Image upload with preview.

### Dependencies

| Dependency | Usage |
|------------|-------|
| `useDebounce` | Debounced search across all lists |
| `fetchPrivate` | Authenticated API calls |
| Images feature | Image gallery selector |
| Material-UI | Tables, forms, dialogs, pagination |

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/client/src/features/chains/` | Chain list, search, form, query hooks |
| `apps/client/src/features/markets/` | Market list, search, form, query hooks |
| `apps/client/src/features/products/` | Product list, search, form, query hooks |
