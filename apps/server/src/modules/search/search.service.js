import mongoose from "mongoose";
import { buildBilingualRegex, buildBilingualTokenRegexes } from "../../shared/utils/bilingualRegex.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";
import { parseSearchQuery } from "./query-rules.js";
import { buildKeywordScorer, fuseResults, sortStrongByPrice } from "./hybrid-ranker.js";
import { ProductModel } from "../product/product.model.js";
import { MarketProductModel } from "../product/market-product.model.js";

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

const buildFieldMatchClauses = (patterns, fields, mode = "and") => {
  if (!patterns.length) return {};

  const clauses = patterns.map((pattern) => ({
    $or: fields.map((field) => ({
      [field]: { $regex: pattern, $options: "i" },
    })),
  }));

  return mode === "or" ? { $or: clauses } : { $and: clauses };
};

export class SearchService {
  constructor(
    embeddingService,
    vectorIndex,
    featureFlagService,
    analyticsService = null,
  ) {
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

    // Hydrate with full product data + market info
    const hydrated = await this.#hydrateResults(paginated, marketId, priceSort);

    return {
      data: hydrated,
      pagination: buildPaginationMeta({ total, page, limit }),
      priceSort,
    };
  }

  async #sortByPrice(results, marketId, priceSort) {
    if (!results.length) return results;
    const match = { product: { $in: results.map((r) => new mongoose.Types.ObjectId(r.productId)) } };
    if (marketId) match.market = new mongoose.Types.ObjectId(marketId);
    const prices = await MarketProductModel.aggregate([
      { $match: match },
      { $group: { _id: "$product", min: { $min: "$price" }, max: { $max: "$price" } } },
    ]);
    const byProduct = new Map(prices.map((p) => [p._id.toString(), p]));
    /** @param {{ productId: string, score: number }} result */
    const sortKey = (result) => {
      const p = byProduct.get(result.productId);
      if (!p) return Infinity;
      return priceSort === "asc" ? p.min : -p.max;
    };
    return sortStrongByPrice(results, sortKey);
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

  /**
   * Nearest products, plus a vector score for every keyword match so both
   * signals are known for each candidate.
   */
  async #vectorSearch(queryEmbedding, marketId, keywordHits) {
    let hits;
    if (marketId) {
      const marketProducts = await MarketProductModel.find({
        market: new mongoose.Types.ObjectId(marketId),
      })
        .select("product")
        .lean()
        .exec();
      hits = this.vectorIndex.search(queryEmbedding, {
        k: VECTOR_LIMIT,
        productIds: marketProducts.map((mp) => mp.product),
      });
    } else {
      const nearest = this.vectorIndex.search(queryEmbedding, { k: VECTOR_OVERFETCH });
      const priced = new Set(
        (await this.#keepPriced(nearest.map((h) => new mongoose.Types.ObjectId(h.productId)))).map(String),
      );
      hits = nearest.filter((h) => priced.has(h.productId)).slice(0, VECTOR_LIMIT);
    }

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
      const pipeline = [
        { $match: { market: new mongoose.Types.ObjectId(marketId) } },
        {
          $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $match: buildFieldMatchClauses(
            tokenPatterns,
            ["product.title", "product.category"],
            "and",
          ),
        },
        { $limit: MARKET_KEYWORD_LIMIT },
        { $project: { "product._id": 1, "product.title": 1, "product.category": 1 } },
      ];
      candidates = (await MarketProductModel.aggregate(pipeline)).map((r) => r.product);
    } else {
      const phrase = buildBilingualRegex(query.trim());
      const [titleStarts, general] = await Promise.all([
        phrase
          ? ProductModel.find({ title: { $regex: `^(?:${phrase})`, $options: "i" } })
            .select("_id title category")
            .limit(TITLE_START_LIMIT)
            .lean()
            .exec()
          : [],
        ProductModel.find({
          ...buildFieldMatchClauses(tokenPatterns, ["title", "category"], "and"),
        })
          .select("_id title category")
          .limit(KEYWORD_OVERFETCH)
          .lean()
          .exec(),
      ]);
      const byId = new Map([...general, ...titleStarts].map((p) => [String(p._id), p]));
      const products = [...byId.values()];
      const priced = new Set((await this.#keepPriced(products.map((p) => p._id))).map(String));
      candidates = products.filter((p) => priced.has(String(p._id)));
    }

    const score = buildKeywordScorer(query);
    return candidates
      .map((p) => ({ productId: p._id.toString(), score: score(p), length: (p.title || "").length }))
      // Among equal scores, shorter titles name the product more directly.
      .sort((a, b) => b.score - a.score || a.length - b.length)
      .slice(0, limit)
      .map(({ productId, score: s }) => ({ productId, score: s }));
  }

  async #keepPriced(productIds) {
    if (!productIds.length) return [];
    const pricedIds = await MarketProductModel.distinct("product", {
      product: { $in: productIds },
    });
    const priced = new Set(pricedIds.map((id) => id.toString()));
    return productIds.filter((id) => priced.has(id.toString()));
  }

  async #hydrateResults(results, marketId, priceSort = null) {
    if (!results.length) return [];

    const productIds = results.map((r) => new mongoose.Types.ObjectId(r.productId));

    const products = await ProductModel.find({ _id: { $in: productIds } })
      .populate({ path: "image", select: "title url mimeType" })
      .lean()
      .exec();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Get market product info (price, market name, chain)
    const mpQuery = { product: { $in: productIds } };
    if (marketId) mpQuery.market = new mongoose.Types.ObjectId(marketId);

    const marketProducts = await MarketProductModel.find(mpQuery)
      .populate({
        path: "market",
        populate: {
          path: "chain",
          populate: { path: "image", select: "title url mimeType" },
        },
      })
      .lean()
      .exec();

    // Group market products by product ID
    const mpByProduct = new Map();
    for (const mp of marketProducts) {
      const pid = mp.product.toString();
      if (!mpByProduct.has(pid)) mpByProduct.set(pid, []);
      mpByProduct.get(pid).push(mp);
    }

    return results.map(({ productId, score }) => {
      const product = productMap.get(productId);
      let mps = (mpByProduct.get(productId) || []).map((mp) => ({
        price: mp.price,
        market: mp.market,
      }));

      // Sort market offerings by price when user expressed a price preference
      if (priceSort) {
        const dir = priceSort === "asc" ? 1 : -1;
        mps.sort((a, b) => (a.price - b.price) * dir);
      }

      return { product, score, marketProducts: mps };
    });
  }
}
