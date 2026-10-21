---
title: How Obrok Works
---

# How Obrok Works

## Public Summary

Obrok ("meal" in Macedonian) helps people in North Macedonia find where to shop so that a week of groceries fits inside the statutory daily meal allowance (140 MKD per working day, Monday to Saturday, minus public holidays). Everything else exists to answer one question: what can I cook this week, where is it cheapest, and can I get there.

The pages in this section explain the design in plain language, for readers who haven't opened the code:

- [Search & Recipe Decomposition](/concepts/search-and-recipes): how a product query or a whole meal turns into ranked, priced results.
- [Geolocation](/concepts/geolocation): how scraped store listings become map coordinates, and where that fails.
- [Routing & Map](/concepts/routing-and-map): how routes are computed and hundreds of stores are drawn.
- [System Architecture](/architecture/overview) and [Data And Request Flows](/architecture/flows): the services and the main flows all of the above runs on.

## Internal Details

### The Core Problem

Grocery prices vary between chains and even between stores of one chain. Deciding what to cook means cross-referencing a recipe against prices at stores you can reach. Obrok automates that: it scrapes prices from four chains (Vero, Ramstore, Stokomak and KAM) twice a week, lets a user describe a product or a meal, turns a meal into a shopping list, prices it at every store that carries it, and ranks stores by completeness, budget fit and distance.

### How to Read This Section

These pages explain why; the `Backend`, `Frontend`, `Deployment` and `Patterns` sections are the reference (file tables, endpoints, constants). Each concept page links to its reference page. A good order: this page, Search & Recipe Decomposition (the most novel part), Geolocation (a real problem found and fixed), Routing & Map, then System Architecture as the technical summary.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/shared/utils/obrokBudget.js` | The weekly meal allowance that anchors the product |
| `apps/server/src/modules/scraper/scraper.registry.js` | The active chains |
| `apps/server/src/modules/scraper/scraper.cron.js` | Scrape schedule (03:00 Skopje time, Monday and Thursday) |

## Risks and Trade-offs

- This section simplifies. Where it disagrees with a reference page, the reference page (and the source it cites) is authoritative.
