---
title: Dashboard Feature
---

# Dashboard Feature

## Public Summary

The admin area at `/dashboard` is a header plus a tab bar over seven sections: chains, markets, products, holidays, reports, insights and feature flags. Each section page is documented on its feature page; this page covers the shell and the route list.

## Internal Details

### Shell

| File | Role |
|------|------|
| `components/DashboardLayout.jsx` | Header, tab bar and `Outlet` for the active section or form |
| `components/DashboardHeader.jsx` | "Obrok" title (links to `/dashboard`), theme toggle, Map button (to `/`), Logout |
| `pages/Dashboard.jsx` | Redirects `/dashboard` to `/dashboard/chains` |
| `pages/{Chains,Markets,Products,Holidays}Page.jsx` | Search bar, add button and list for each entity |
| `pages/ReportingPage.jsx` | Report filters and job status |

The active tab is chosen by path prefix, so add and edit forms (for example `/dashboard/product/:id`) keep their section's tab highlighted. On small screens tabs show icons only.

### Routes

| Tab | List route | Form routes | Page doc |
|-----|-----------|-------------|----------|
| Chains | `/dashboard/chains` | `/dashboard/chain`, `/dashboard/chain/:chainId` | [CRUD](./crud-entities) |
| Markets | `/dashboard/markets` | `/dashboard/market`, `/dashboard/market/:marketId` | [CRUD](./crud-entities) |
| Products | `/dashboard/products` | `/dashboard/product`, `/dashboard/product/:productId` | [CRUD](./crud-entities) |
| Holidays | `/dashboard/holidays` | `/dashboard/holiday`, `/dashboard/holiday/:holidayId` | [CRUD](./crud-entities) |
| Reports | `/dashboard/reporting` | none | [Reports](./insights-reports-flags#reports) |
| Insights | `/dashboard/insights` | none | [Insights](./insights-reports-flags#insights) |
| Features | `/dashboard/features` | none | [Feature flags](./insights-reports-flags#feature-flags) |

All of these sit behind `RequireAuth` (see [Routing And Access Control](../routing-auth)).

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/client/src/features/dashboard/` | Shell and section pages |
| `apps/client/src/components/layout/App.jsx` | Dashboard route declarations |

## Risks and Trade-offs

- Tabs are shown to every logged-in user. Insights, reports, flags and all writes are admin-only on the server, so a non-admin sees tabs that fail.
- The section list lives in `DashboardLayout` and the routes in `App.jsx`; adding a section means editing both.
