import { buildBilingualRegex, buildBilingualTokenRegexes } from "../../shared/utils/bilingualRegex.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";
import { parseSearchQuery } from "./query-rules.js";
import { buildKeywordScorer, fuseResults, sortStrongByPrice } from "./hybrid-ranker.js";

const KEYWORD_LIMIT = 100;
// Over-fetch before dropping products without prices, so they can't crowd out
// priced ones in the top results.
const KEYWORD_OVERFETCH = 500;
// Titles that start with the query are the best matches; fetch them apart so
// the general cap can't crowd them out.
const TITLE_START_LIMIT = 1500;
// One market's catalogue is small enough to score every match.
const MARKET_KEYWORD_LIMIT = 3000;
const VECTOR_LIMIT = 100;
const VECTOR_OVERFETCH = 300;
// Meal ingredients: only products this close to the best vector match count as
// the ingredient. Misleading word matches ("ПАСТА ЗА ЗАБИ" for "паста", sauce
// "СО СИРЕЊЕ" for "сирење") sit 0.03 or more below it.
const INGREDIENT_WINDOW = 0.025;

export class SearchService {
  constructor(
    searchRepository,
    embeddingService,
    vectorIndex,
    featureFlagService,
    analyticsService = null,
  ) {
    this.searchRepository = searchRepository;
    this.embeddingService = embeddingService;
    this.vectorIndex = vectorIndex;
    this.featureFlagService = featureFlagService;
    this.analyticsService = analyticsService;
  }

  async search({ q, marketId, page = 1, limit = 10, analytics = null }) {
    const isEnabled = await this.featureFlagService.isEnabled("ai-search");
    if (!isEnabled) {
      return { data: [], pagination: buildPaginationMeta({ total: 0, page, limit }), priceSort: null };
    }

    await this.analyticsService?.trackFeatureUsage({
      visitorId: analytics?.visitorId,
      userId: analytics?.userId,
      feature: "hybrid-search",
      path: analytics?.path,
    });

    return this.searchProducts({ q, marketId, page, limit });
  }

  async searchProducts({ q, marketId, page = 1, limit = 10 }) {
    const { searchTerms, embeddingText, priceSort } = parseSearchQuery(q);

    const [queryEmbedding, keywordResults] = await Promise.all([
      this.#embedQuery(embeddingText),
      // A price sort must see every match, not just the best-named 100.
      this.#keywordSearch(searchTerms, marketId, priceSort ? KEYWORD_OVERFETCH : KEYWORD_LIMIT),
    ]);
    const vectorResults = queryEmbedding
      ? await this.#vectorSearch(queryEmbedding, marketId, keywordResults)
      : [];

    let merged = fuseResults(vectorResults, keywordResults);
    if (priceSort) merged = await this.#sortByPrice(merged, marketId, priceSort);

    const total = merged.length;
    const skip = (page - 1) * limit;
    const paginated = merged.slice(skip, skip + limit);

    return {
      data: await this.#hydrateResults(paginated, marketId, priceSort),
      pagination: buildPaginationMeta({ total, page, limit }),
      priceSort,
    };
  }

  /**
   * Products that are the named ingredient, by vector similarity, with their
   * prices. Null when vector search isn't available, so callers can fall back.
   * @param {string} name
   */
  async findIngredientCandidates(name) {
    const queryEmbedding = await this.#embedQuery(parseSearchQuery(name).embeddingText);
    if (!queryEmbedding) return null;

    const hits = await this.#nearestPriced(queryEmbedding, VECTOR_OVERFETCH);
    if (!hits.length) return [];

    const floor = hits[0].score - INGREDIENT_WINDOW;
    return this.#hydrateResults(hits.filter((h) => h.score >= floor), null, null);
  }

  async #embedQuery(embeddingText) {
    if (!this.embeddingService.isAvailable()) return null;
    if (!this.vectorIndex.isReady()) {
      // First search after ai-search was switched on: load in the background.
      this.vectorIndex.load().catch((err) => console.error("[VectorIndex] Load failed:", err.message));
      return null;
    }
    return this.embeddingService.generateEmbedding(embeddingText, "RETRIEVAL_QUERY");
  }

  /** Nearest products across the catalogue that are still sold somewhere. */
  async #nearestPriced(queryEmbedding, k) {
    const nearest = this.vectorIndex.search(queryEmbedding, { k });
    const priced = new Set(await this.searchRepository.keepPriced(nearest.map((h) => h.productId)));
    return nearest.filter((h) => priced.has(h.productId));
  }

  /**
   * Nearest products, plus a vector score for every keyword match so both
   * signals are known for each candidate.
   */
  async #vectorSearch(queryEmbedding, marketId, keywordHits) {
    const hits = marketId
      ? this.vectorIndex.search(queryEmbedding, {
        k: VECTOR_LIMIT,
        productIds: await this.searchRepository.findMarketProductIds(marketId),
      })
      : (await this.#nearestPriced(queryEmbedding, VECTOR_OVERFETCH)).slice(0, VECTOR_LIMIT);

    const seen = new Set(hits.map((h) => h.productId));
    const unscored = keywordHits.map((h) => h.productId).filter((id) => !seen.has(id));
    const extra = this.vectorIndex.search(queryEmbedding, { k: unscored.length, productIds: unscored });
    return [...hits, ...extra].sort((a, b) => b.score - a.score);
  }

  async #keywordSearch(query, marketId, limit) {
    const tokenPatterns = buildBilingualTokenRegexes(query);
    if (!tokenPatterns.length) return [];

    let candidates;
    if (marketId) {
      candidates = await this.searchRepository.findMatchingInMarket(
        marketId,
        tokenPatterns,
        MARKET_KEYWORD_LIMIT,
      );
    } else {
      const phrase = buildBilingualRegex(query.trim());
      const [titleStarts, general] = await Promise.all([
        phrase ? this.searchRepository.findTitleStartingWith(phrase, TITLE_START_LIMIT) : [],
        this.searchRepository.findMatching(tokenPatterns, KEYWORD_OVERFETCH),
      ]);
      const byId = new Map([...general, ...titleStarts].map((p) => [String(p._id), p]));
      const priced = new Set(await this.searchRepository.keepPriced([...byId.keys()]));
      candidates = [...byId.values()].filter((p) => priced.has(String(p._id)));
    }

    const score = buildKeywordScorer(query);
    return candidates
      .map((p) => ({ productId: String(p._id), score: score(p), length: (p.title || "").length }))
      // Among equal scores, shorter titles name the product more directly.
      .sort((a, b) => b.score - a.score || a.length - b.length)
      .slice(0, limit)
      .map(({ productId, score: s }) => ({ productId, score: s }));
  }

  async #sortByPrice(results, marketId, priceSort) {
    if (!results.length) return results;
    const prices = await this.searchRepository.findPriceRanges(
      results.map((r) => r.productId),
      marketId,
    );
    /** @param {{ productId: string, score: number }} result */
    const sortKey = (result) => {
      const p = prices.get(result.productId);
      if (!p) return Infinity;
      return priceSort === "asc" ? p.min : -p.max;
    };
    return sortStrongByPrice(results, sortKey);
  }

  async #hydrateResults(results, marketId, priceSort = null) {
    if (!results.length) return [];

    const { products, marketProducts } = await this.searchRepository.findForDisplay(
      results.map((r) => r.productId),
      marketId,
    );
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const mpByProduct = new Map();
    for (const mp of marketProducts) {
      const pid = String(mp.product);
      if (!mpByProduct.has(pid)) mpByProduct.set(pid, []);
      mpByProduct.get(pid).push({ price: mp.price, market: mp.market });
    }

    const dir = priceSort === "desc" ? -1 : 1;
    return results.map(({ productId, score }) => {
      const mps = mpByProduct.get(productId) || [];
      // Sort market offerings by price when user expressed a price preference
      if (priceSort) mps.sort((a, b) => (a.price - b.price) * dir);
      return { product: productMap.get(productId), score, marketProducts: mps };
    });
  }
}
