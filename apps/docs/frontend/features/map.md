---
title: Map Feature
---

# Map Feature

## Public Summary

Interactive MapLibre-based map showing supermarket locations, product search, multi-modal routing (walk, bike, car), market clustering, and AI-powered search dialog.

## Internal Details

### Files

| File | Role |
|------|------|
| `MapPage.jsx` | Main map page; owns route and dialog state and composes the controls |
| `RouteControls.jsx` | Routing mode selector and cancel-route button |
| `MapSettingsMenu.jsx` | Settings menu (dashboard, theme, chain filter, login/logout) |
| `ChainFilterPopover.jsx` | Chain visibility toggles |
| `AISearchButton.jsx` | Floating button that opens the AI search dialog |
| `RoutingEngine.jsx` | OSRM route rendering |
| `MarketMarkers.jsx` | Market pins with clustering |
| `CreditMarker.jsx` | Map attribution |
| `GlobalAISearchDialog.jsx` | AI search overlay; owns tab, debounce, and query state |
| `ai-search/ProductSearchTab.jsx` | Product search tab (results, price sort, pagination) |
| `ai-search/MealSearchTab.jsx` | Meal (smart search) tab with budget and market breakdown |
| `ai-search/MealMarketCard.jsx` / `ProductResultCard.jsx` | Result cards for each tab |
| `RouteConfirmDialog.jsx` | Route mode selection dialog |
| `LocateUser.jsx` | Geolocation button |
| `UserDot.jsx` | User position indicator |
| `MapProductInfoModal.jsx` | Market product detail modal |
| `useMapPitch.js` | 3D pitch interaction hook |
| `useVisibleChains.js` | Chain filter state persisted to `localStorage` |
| `markerUtils.js` | Marker helper utilities |
| `formatDistance.js` | Meters/kilometers label formatting |
| `add3dBuildingsLayer.js` | Adds the 3D buildings layer on map load |
| `mapPopupStyles.js` | Theme overrides for MapLibre popups and attribution |
| `defaultVisibleChains.js` | Default chain filter config |
| `markerColors.js` | Chain color mapping |
| `markerPaths.js` | SVG marker path definitions |

### Key Interactions

```mermaid
flowchart TD
    A[MapPage] --> B[MarketMarkers]
    A --> C[RoutingEngine]
    A --> D[GlobalAISearchDialog]
    A --> E[LocateUser]
    B --> F[Supercluster Grouping]
    F --> G[Click → MapProductInfoModal]
    G --> H[Route to Market → RouteConfirmDialog]
    H --> I[OSRM Route via RoutingEngine]
    D --> J[AI Search Results]
    J --> K[Select → Fly to Market]
```

### Clustering

Uses **Supercluster** to group nearby markets at lower zoom levels, expanding to individual markers on zoom in. Performance optimization for hundreds of market locations.

### Routing

- **OSRM backend** at `/route/` for path calculation.
- Three modes: walking, cycling, driving.
- Route rendered as styled polyline on map.
- Route confirmation dialog lets user pick mode before rendering.

### Chain Filters

- Users can toggle chain visibility (e.g., show only Vero markets).
- Filter state persisted to `localStorage` by `useVisibleChains`; corrupt or unknown stored values fall back to the defaults.
- Default visible chains configured in `defaultVisibleChains.js`.

### Feature Flag Integration

- `ai-search` flag gates the `GlobalAISearchDialog` component.
- When disabled, only basic map browsing is available.

### Dependencies

| Dependency | Usage |
|------------|-------|
| MapLibre GL / react-map-gl | Map rendering |
| Supercluster | Marker clustering |
| OSRM | Routing engine |
| `themeStore` | Dark/light map style |
| `featureFlagStore` | AI search gate |
| `useAuth` / `useLogout` | Auth state in header |

### Tests

Client tests use Vitest, jsdom, and Testing Library (`npm test` in `apps/client`). Map coverage includes the chain filter hook, marker and distance utilities, the settings menu, and the AI search dialog (debounce, rounded location, route requests, rate-limit message). Query hooks are mocked, so the tests never hit the API.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/client/src/features/map/` | Pages, components, hooks, config, utils |
