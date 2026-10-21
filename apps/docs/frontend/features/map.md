---
title: Map Feature
---

# Map Feature

## Public Summary

The public home page is a MapLibre map of supermarket locations with clustered, chain-colored pins, a chain filter, geolocation, OSRM directions (walking, car, cycling) and an AI search dialog with product and meal tabs. This page is the reference for components and configuration; the user journeys are on [Map And UX Flows](../map-flows).

## Internal Details

### Files

| File | Role |
|------|------|
| `pages/MapPage.jsx` | Map setup; owns route, dialog and smart-route state |
| `components/MarketMarkers.jsx` | Clustered pins and the market popup |
| `components/CreditMarker.jsx` | Purple "about Obrok" pin at the initial center |
| `components/LocateUser.jsx` / `UserDot.jsx` | Geolocation watch and the blue position dot |
| `components/RoutingEngine.jsx` | OSRM request and route line |
| `components/RouteControls.jsx` | Mode buttons and cancel-route button |
| `components/RouteConfirmDialog.jsx` | Yes/no confirm before routing from AI search |
| `components/MapSettingsMenu.jsx` | Gear menu: dashboard (logged in), theme, chain filter, login/logout |
| `components/ChainFilterPopover.jsx` | Chain visibility toggles |
| `components/AISearchButton.jsx` | Opens the AI search dialog |
| `components/GlobalAISearchDialog.jsx` | AI search dialog; owns tab, debounce and query state |
| `components/ai-search/` | `ProductSearchTab`, `MealSearchTab`, result cards, input bar, status messages |
| `components/MapProductInfoModal.jsx` | Popup "Products" button that opens `SharedMarketProductsModal` |
| `hooks/useVisibleChains.js` | Chain filter state, persisted |
| `hooks/useMapPitch.js` | Current pitch, used to offset pins in 3D |
| `config/markerColors.js` | Chain colors and `getChainColor` |
| `config/defaultVisibleChains.js` | Known chain names and default filter |
| `config/markerPaths.js` / `mapPopupStyles.js` | Pin SVG paths; popup theme overrides |
| `utils/markerUtils.js` | Pin color and cluster gradient |
| `utils/formatDistance.js` | `850m` / `1.2 km` labels |
| `utils/add3dBuildingsLayer.js` | 3D buildings layer (from zoom 15) |

### Chains, Colors And Filter

| Chain | Color |
|-------|-------|
| Vero | `crimson` |
| Ramstore | `#2e7d32` |
| Stokomak | `#f4c430` |
| KAM | `#ff5fa2` |

- These four are the only chains the filter knows (`KNOWN_CHAIN_NAMES` is built from `markerColors.js`). Super KIT-GO and Kipper were removed.
- `getChainColor` matches case- and punctuation-insensitively and also on substrings; unknown chains get the Vero color.
- A market is shown only if its chain name is in the visible set (case-insensitive). Markets without a chain name are hidden.
- Clusters (Supercluster, radius 50, clustering up to zoom 15) are colored with a conic gradient of the chains they contain. Clicking a cluster zooms to its expansion level.

**Default visible chains.** `VITE_DEFAULT_VISIBLE_CHAINS` is a comma-separated list, matched against the known chains ignoring case and punctuation. Unknown names are dropped. If it is unset, empty or matches nothing, the default is `Vero, Ramstore`.

**Stored selection.** `useVisibleChains` saves the selection to `localStorage` key `obrok.map.visibleChains` as a JSON array. On load:

| Stored value | Result |
|--------------|--------|
| Missing, corrupt or not an array | Defaults |
| `[]` | Nothing visible (respected as a choice) |
| Names | Canonicalized (`"kam"` becomes `"KAM"`); unknown names such as `"Kipper"` are dropped; if none remain, defaults |

### Geolocation

`LocateUser` uses `watchPosition` with high accuracy, switching to low accuracy if there is no fix within 5 seconds and retrying high accuracy 30 seconds after a timeout. The first fix flies the map to the user (zoom 16, or 13 if accuracy is worse than 1 km). After that, high-accuracy fixes worse than 100 m are ignored, the parent is notified only after moving more than 15 m, and the map follows the user only while no route is active. No fix within 10 seconds, or a denied or unavailable position, disables routing.

### Routing

`RoutingEngine` calls OSRM directly from the browser, not through the API:

`${VITE_OSRM_URL}/{profile}/{startLng},{startLat};{endLng},{endLat}?overview=full&geometries=geojson`

| Mode | OSRM profile | Line |
|------|--------------|------|
| `walking` (default) | `foot` | `#DC143C`, dashed |
| `car` | `car` | `#FF073A`, solid |
| `cycling` | `bicycle` | `#FF0080`, dotted |

The map fits the route once per destination (max zoom 16). Changing mode refetches; the previous request is aborted.

### AI Search Dialog

The AI button appears only when the `ai-search` flag is on (and the map is not loading). The dialog has two tabs only when `smart-search` is also on; otherwise it shows just the product search.

| Tab | Debounce | Request | Results |
|-----|----------|---------|---------|
| Meal ("Оброк", first tab) | 700 ms | `POST /smart-search` with `{ q, lat, lon, budgetOnly }`; budget from `GET /smart-search/budget` | Shopping list (found / not found), then market cards with matched count, total price, over-budget surcharge and a distance chip |
| Product ("Пребарување") | 500 ms | `GET /search?q&page&limit=10` | Products with per-market price chips, price-sort chip, pagination |

- Meal search sends the user's location rounded to 4 decimals. If the query was sent before the first GPS fix, the fix is attached once when it arrives; later movement does not re-run the query.
- Meal search is never retried on 429 and shows a "try again in a minute" message (the server allows 10 requests per minute per IP). A `redirect` result tells the user to try a more specific meal or the product tab.
- Clicking a product's market chip (only if the market has coordinates) or a meal market's distance chip starts the confirm-and-route flow.
- Closing with the X button, backdrop or Escape clears both inputs and returns to the first tab.

### Other Flag Uses

`SharedMarketProductsModal` shows an AI-mode toggle (search via `GET /search` scoped to the market) only when `ai-search` is on. Without it, the modal searches by title and category through `GET /products`.

### Tests

Specs cover `useVisibleChains`, `markerUtils`, `formatDistance`, `MapSettingsMenu` (guest vs logged-in actions, chain filter), `MealSearchTab`, and `GlobalAISearchDialog` (tabs per flag, debounce, rounded and late-attached location, route requests, explicit close). Query hooks are mocked.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/client/src/features/map/` | Pages, components, hooks, config, utils |
| `apps/client/src/features/map/config/markerColors.js` | Chain colors |
| `apps/client/src/features/map/config/defaultVisibleChains.js` | Known chains, env default |
| `apps/client/src/features/map/hooks/useVisibleChains.js` | Filter persistence |
| `apps/client/src/features/map/components/GlobalAISearchDialog.jsx` | AI search tabs and queries |
| `apps/client/src/features/products/hooks/useProductQueries.js` | `useAISearch`, `useSmartSearch`, `useSmartSearchBudget` |
| `apps/client/src/features/markets/hooks/useMarketQueries.js` | `useMarketsForMap` |
| `apps/client/src/components/ui/SharedMarketProductsModal.jsx` | Per-market products modal |

## Risks and Trade-offs

- The chain list is hard-coded in `markerColors.js`. A new chain from the scraper stays hidden on the map until it is added there.
- Substring color matching is forgiving but can pick the wrong color if one chain name contains another.
- All markets are loaded at once and clustered in the browser; that is fine at the current scale but grows with the market count.
- The map style is fixed; dark mode changes popups and controls but not the tiles.

## Next Extension Points

- Move the known chain list and colors to API data so new chains need no client release.
