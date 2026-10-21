---
title: Search & Recipe Decomposition
---

# Search & Recipe Decomposition

## Public Summary

Obrok answers two different kinds of questions with two different search paths: "where is milk cheapest" (hybrid product search) and "I want to cook tavče gravče this week, where should I shop" (recipe search). Product search reads the query with simple rules (price words, filler words, script) and never calls a language model. Recipe search asks a small language model to split the meal into ingredients, and saves that answer so each dish is decomposed only once.

## Internal Details

### Why Not Just Keyword Search

A pure keyword search fails on typos, synonyms, and bilingual input (Macedonian is written in both Cyrillic and Latin script, sometimes in the same session). A pure vector (embedding) search fixes those but is worse at exact-match queries like a specific brand name. Obrok runs both and merges the results, so a query benefits from whichever method scores it better.

```mermaid
flowchart TD
    A[User types a query] --> B[Query rules: product terms, price preference]
    B --> C[Vector search: nearest products in an in-memory index of all embeddings]
    B --> D[Keyword search: MongoDB text/regex match]
    C --> E[Weighted score fusion]
    D --> E
    E --> F[Ranked, priced results]
```

**Embeddings** are numeric vectors that place semantically similar text near each other in space, e.g. "тепсиско млеко" and "milk" end up close together even though they share no characters. Every product's title/description is embedded once (and re-embedded only when its text changes, via an incremental sync job); a query is embedded the same way at search time, and the two are compared by cosine similarity.

**The merge step** puts both signals on the same 0 to 1 scale and adds them with fixed weights (keyword 0.6, vector 0.4). The keyword score says how directly the title names the query: 1 if the title starts with it, 0.8 if every query word starts a word in the title, 0.4 for a looser match. The vector score is measured relative to the best vector hit, and hits more than 0.1 below it are dropped as unrelated. A product that both methods agree on ranks highest. When the query asks for the cheapest or most expensive, only the strong matches (within 80% of the best score) are sorted by price; weaker matches follow, so "cheapest milk" isn't led by a chocolate bar that mentions milk.

### Recipe Decomposition

For a meal (e.g. "тавче гравче за 4 луѓе") the flow changes:

```mermaid
flowchart TD
    A[Recipe query] --> B[Saved decomposition, or the language model splits it into ingredients]
    B --> C[Per ingredient: products closest to it by meaning, in parallel]
    C --> D[Group results by market: which markets carry which ingredients, at what price]
    D --> E[Rank markets: complete match first, then within-budget, then match count, then distance, then price]
    E --> F[Shopping list + ranked markets returned]
```

Each ingredient is matched by meaning, not by the word alone: "паста" in a meal should be priced with pasta, not "ПАСТА ЗА ЗАБИ" (toothpaste), even though the toothpaste title contains the word. Only products very close to the best match count. In each store, the closest matches are compared per kilogram or litre among normal pack sizes for that ingredient (read from the title), so milk is priced with a 1 L carton rather than cheaper coffee creamer portions, and cheese with a usual pack rather than a 1 kg block. Where titles carry no size, as with eggs, the cheapest package is used. Results show at most three stores per chain, since stores of one chain usually share a pricelist.

The ingredient list itself is whatever the language model returns, there is no structured recipe database behind it. This is a deliberate trade-off: it works for arbitrary dishes without needing anyone to curate a recipe corpus, at the cost of decomposition quality being only as good as the model's output for that particular dish and phrasing.

### The Budget Angle

Every recipe search is scored against a weekly budget: 140 MKD/day for each working day (Monday–Saturday) in the current week, adjusted for public holidays, this is the statutory daily meal allowance in North Macedonia and the reason the app is named Obrok. A market is flagged `withinBudget` if the full ingredient list costs less than that weekly figure, and results are sorted with complete, within-budget matches first.

### Distance

Once markets are ranked by price completeness, straight-line (haversine) distance from the user's location breaks ties, this is where [geolocation](/concepts/geolocation) accuracy directly affects search quality: a market with wrong coordinates can be mis-ranked as closer or farther than it really is.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/search/search.service.js` | Hybrid search orchestration |
| `apps/server/src/modules/search/hybrid-ranker.js` | Keyword scoring, score fusion, price sorting |
| `apps/server/src/modules/search/smart-search.service.js` | Recipe decomposition, market ranking, budget logic |
| `apps/server/src/modules/search/query-rules.js` | Price intent and query cleanup for product search |
| `apps/server/src/modules/search/intent-parser.service.js` | Meal decomposition into ingredients |
| `apps/server/src/modules/search/embedding.service.js` | Embedding generation |
| `apps/server/src/shared/utils/obrokBudget.js` | Weekly budget calculation |
| `apps/server/src/shared/utils/haversine.js` | Distance calculation |
| [Search Module reference](/backend/modules/search) | Full endpoint/file breakdown |

## Risks and Trade-offs

- Both search paths depend on a third-party LLM provider being available; both degrade to keyword-only search or a raw-query pass-through if it isn't, rather than failing outright.
- Recipe decomposition quality is bounded by the model's judgment for a given dish and phrasing, there is no way to verify an ingredient list is "correct" the way a curated recipe database would guarantee.
- The fusion weights, the vector window and the strong-match share are tuned against the cases in `npm run eval:search`, a small hand-written set rather than a large labeled relevance dataset.
