---
title: Public Holiday Module
---

# Public Holiday Module

## Public Summary

Admin-managed list of public holidays. Smart search uses it to count the work days in the current week when it computes the weekly budget.

## Internal Details

### Endpoints

Mounted at `/api/public-holidays`. "Admin" means `verifyJWT` + `verifyAdmin`. Update and delete take the `id` in the JSON body.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/public-holidays` | Public | List, sorted by date. Query: `page`, `limit`, `name` (case-insensitive substring), `from`, `to` (inclusive date range) |
| `GET` | `/public-holidays/:id` | Public | Holiday detail |
| `POST` | `/public-holidays` | Admin | Create. Body: `name`, `date` |
| `PUT` | `/public-holidays` | Admin | Update. Body: `id`, optional `name`, `date` |
| `DELETE` | `/public-holidays` | Admin | Delete. Body: `id` |

Pagination uses `paginationSchema`: default `limit` 10, max 100, and `limit=0` is rejected. Ids are checked by the shared `idSchema`.

### Data Model

Collection `public_holidays`:

```
name : String (required)
date : Date (required, unique)
```

A date string like `2026-10-03` is stored as UTC midnight. A second holiday on the same date returns 409.

### Usage in the Weekly Budget

`SmartSearchService` loads the holidays between Monday and Saturday of the current week (Europe/Skopje calendar) and passes them to `calculateWeeklyBudget` (`shared/utils/obrokBudget.js`):

- A week has 6 work days (Monday to Saturday); each holiday on one of those days removes one.
- Budget = work days x 140.
- When the week spans two months, the result also has one segment per month with its own days and budget.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/public-holiday/public-holiday.routes.js` | Routes, auth and validation |
| `apps/server/src/modules/public-holiday/public-holiday.schema.js` | Query and body schemas |
| `apps/server/src/modules/public-holiday/public-holiday.repository.js` | Filters, date-range lookup |
| `apps/server/src/modules/search/smart-search.service.js` | Budget computation (`#computeBudget`) |
| `apps/server/src/shared/utils/obrokBudget.js` | Work-day and budget calculation |

## Risks and Trade-offs

- Holidays are entered by hand; a missing holiday overstates that week's budget.
- One holiday per date: two names for the same day must share one record.
