---
title: State And Server Data
---

# State And Server Data

## Public Summary

Server data is fetched and cached with TanStack Query through feature query hooks. Three Zustand stores hold auth, theme and feature flags. Two fetch wrappers talk to the API and turn error responses into a single error shape that forms read directly.

## Internal Details

### Zustand Stores

| Store | State | Persisted |
|-------|-------|-----------|
| `authStore` | `auth` (`{ username, accessToken }`), `persist` flag, `logout()` | Only `persist`, under `localStorage` key `maco-auth`. The access token stays in memory. |
| `themeStore` | `mode` (`light` / `dark`), `toggleColorMode()` | Yes, key `themeMode` |
| `featureFlagStore` | `flags` (key to boolean), `loaded`, `fetchFlags()`, `refetchFlags()` | No |

`fetchFlags()` runs once from `App` and calls public `GET /flags`; a failure leaves `flags` empty, so every flag reads as off. `useFeatureFlag(key)` returns `!!flags[key]`.

### Query Client Defaults

`src/api/queryClient.js`: `staleTime` 5 minutes, `retry: 1`, `refetchOnWindowFocus: false`. The same instance is imported directly by login and logout, which call `queryClient.clear()`.

### Query Key Conventions

Each feature exports a key factory with an `all` root. Lists and details extend it:

| Feature | Root key | Other keys |
|---------|----------|------------|
| Chains | `["chains"]` | `[..., "list", search, page, limit]`, `[..., "detail", id]`, `[..., "dropdown"]` |
| Markets | `["markets"]` | list, detail, `"dropdown"`, `"map"` |
| Products | `["products"]` | list, detail, `["products", "market", marketId, params]`, `["products", "categories", marketId]` |
| Public holidays | `["public-holidays"]` | list, detail |
| Images | `["images"]` | none |
| Product search | `["search", params]` | none |
| Meal search | `["smart-search", params]`, `["smart-search", "budget"]` | none |
| Reports | `["reports", "job", jobId]` | none |
| Insights | `["insights", "summary", days]`, `["insights", "feature-trends", days]` | none |
| Feature flags (admin) | `["featureFlags", "list"]` | none |

Mutations invalidate by root key, so one invalidation refreshes lists, details, dropdowns and the map at once. Cross-entity invalidation is listed on the [CRUD page](./features/crud-entities#query-hooks).

### Fetch Wrappers

Both wrappers prefix `${VITE_API_URL}/api`, send cookies (`credentials: "include"`), add `Content-Type: application/json` unless the body is `FormData`, and add an `X-Visitor-Id` header.

| Wrapper | Adds | On 401 |
|---------|------|--------|
| `fetchPublic` | Nothing else | Throws |
| `fetchPrivate` | `Authorization: Bearer <token>` when a token exists | Calls `GET /refresh`, stores the new token, retries once |

Concurrent 401s share a single refresh promise. If the refresh fails with 401 or 403, auth is cleared; a network error keeps the session. Most query hooks use `fetchPrivate` even for endpoints the server serves publicly (markets, products, search), so a logged-in admin's token rides along.

`{ raw: true }` returns the `Response` itself; it is used for CSV downloads.

### Error Contract

Non-2xx responses throw `HttpError` with `status`, `message` and `response: { status, data }`, where `data` is the parsed JSON body (or `null`). The server sends two body shapes:

| Server case | Body | How the client shows it |
|-------------|------|-------------------------|
| Validation failure (400) | `{ field: message }`, nested paths dotted (`"location.0"`) | Forms copy `error.response.data` into their `errors` state and show each message under its field |
| Any other handled error | `{ message }` | Alert at the top of the form or page |
| `verifyAdmin` rejection (403) | Empty body | Generic fallback text (for example "Error saving chain") |
| Rate limit (429) | `{ message }` | Meal search shows its own wait message; login shows "Login Failed" |

### Browser Storage Keys

| Key | Written by | Value |
|-----|-----------|-------|
| `obrok_terms_accepted` | `ConsentGate` | `"true"` after accepting the terms |
| `maco-auth` | `authStore` | `{ state: { persist } }` |
| `themeMode` | `themeStore` | `{ state: { mode } }` |
| `obrok.visitorId` | `getVisitorId()` | Random id matching `^[A-Za-z0-9-]{12,64}$` |
| `obrok.map.visibleChains` | `useVisibleChains` | JSON array of chain names |

Every read and write is wrapped so blocked storage falls back to in-memory state. The server also sets its own `obrok_vid` cookie and prefers it over the header when both are valid.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/client/src/store/authStore.js` | Auth state, persisted `persist` flag |
| `apps/client/src/store/themeStore.js` | Theme mode |
| `apps/client/src/store/featureFlagStore.js` | Public flag cache |
| `apps/client/src/hooks/useFeatureFlag.js` | Flag selector |
| `apps/client/src/api/queryClient.js` | Query defaults |
| `apps/client/src/api/fetch.js` | Wrappers, refresh, `HttpError` |
| `apps/client/src/api/visitorId.js` | Visitor id |
| `apps/server/src/shared/middleware/errorHandler.js` | Error body shapes |
| `apps/server/src/shared/middleware/validateRequest.js` | `{ field: message }` validation body |

## Risks and Trade-offs

- Invalidation is written out by hand in every mutation. Adding a new entity relationship means updating several hooks.
- Admin rejections from `verifyAdmin` have no body, so users see generic text instead of a reason.
- If flags fail to load, every flag reads as off and the AI features disappear without an error.
