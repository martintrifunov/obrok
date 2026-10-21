---
title: Feature Flag Module
---

# Feature Flag Module

## Public Summary

Boolean flags stored in MongoDB that turn the AI search features on and off at runtime. Admins toggle them from the dashboard; no restart is needed.

## Internal Details

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/flags` | Public | `{ [key]: enabled }` map |
| `GET` | `/api/flags/admin` | JWT, role `admin` | Full flag documents |
| `PUT` | `/api/flags` | JWT, role `admin` | Body `{ key, enabled, description? }`. Upserts by `key` and returns the flag |

`PUT` upserts, so an unknown `key` creates a new flag.

### Data Model: FeatureFlag (`feature_flags`)

```
key        : String (unique, required)
enabled    : Boolean (required, default false)
description: String (optional)
createdAt, updatedAt: Date
```

### Flags

Seeded at startup by `seedFeatureFlags` (only when missing, so admin changes survive restarts). Both start disabled.

| Key | Gates |
|-----|-------|
| `ai-search` | Hybrid search (returns no results when off), embedding sync after scrapes, vector index load at startup |
| `smart-search` | Smart search (when off it answers 200 with `error: "Smart search is not enabled."`) |

See [Search](/backend/modules/search) for what each feature does.

### Usage

- Server: `featureFlagService.isEnabled(key)` returns `false` for a missing flag. It reads MongoDB on every call; there is no cache.
- Client: `useFeatureFlagStore` (`store/featureFlagStore.js`) loads `/flags` once; `useFeatureFlag(key)` reads it. The admin flags page calls `refetchFlags()` after a change.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/feature-flag/` | Routes, controller, service, repository, schema, model |
| `apps/server/src/infrastructure/database/seed-feature-flags.js` | Default flags |
| `apps/client/src/store/featureFlagStore.js` | Client flag store |
| `apps/client/src/hooks/useFeatureFlag.js` | Client hook |

## Risks and Trade-offs

- Other open browser tabs keep their loaded flags until reload.
- Any string can become a flag through `PUT`; nothing checks that code reads it.
