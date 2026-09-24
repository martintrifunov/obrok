import mongoose from "mongoose";
import { buildBilingualTokenRegexes } from "../../shared/utils/bilingualRegex.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";
import { ProductModel } from "../product/product.model.js";
import { MarketProductModel } from "../product/market-product.model.js";

const RRF_K = 60;
const KEYWORD_LIMIT = 100;
// Over-fetch before dropping products without prices, so they can't crowd out
// priced ones in the top results.
const KEYWORD_OVERFETCH = 500;

const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

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
    productEmbeddingRepository,
    featureFlagService,
    intentParserService,
    analyticsService = null,
  ) {
    this.embeddingService = embeddingService;
    this.productEmbeddingRepository = productEmbeddingRepository;
    this.featureFlagService = featureFlagService;
    this.intentParserService = intentParserService;
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

  /**
   * Hybrid product search without the feature-flag gate or analytics tracking.
   * Smart search calls this per ingredient with parseIntent: false, since the
   * ingredient names already come from a parsed intent.
   */
  async searchProducts({ q, marketId, page = 1, limit = 10, parseIntent = true }) {
    // Parse intent to extract clean search terms and price sorting preference
    const intent = parseIntent && this.intentParserService?.isAvailable()
      ? await this.intentParserService.parseIntent(q)
      : { searchTerms: q, priceSort: null, intent: "search", products: [] };

    const searchQuery = intent.searchTerms || q;

    const [vectorResults, keywordResults] = await Promise.all([
      this.#vectorSearch(searchQuery, marketId),
      this.#keywordSearch(searchQuery, marketId),
    ]);

    const merged = this.#rrfMerge(vectorResults, keywordResults);

    const total = merged.length;
    const skip = (page - 1) * limit;
    const paginated = merged.slice(skip, skip + limit);

    // Hydrate with full product data + market info
    const hydrated = await this.#hydrateResults(paginated, marketId, intent.priceSort);

    return {
      data: hydrated,
      pagination: buildPaginationMeta({ total, page, limit }),
      priceSort: intent.priceSort,
    };
  }

  async #vectorSearch(query, marketId) {
    if (!this.embeddingService.isAvailable()) return [];

    const queryEmbedding = await this.embeddingService.generateEmbedding(
      query,
      "RETRIEVAL_QUERY",
    );

    let candidateProductIds;
    if (marketId) {
      // Scoped to one market — load only that market's products.
      const marketProducts = await MarketProductModel.find({
        market: new mongoose.Types.ObjectId(marketId),
      })
        .select("product")
        .lean()
        .exec();
      candidateProductIds = marketProducts.map((mp) => mp.product);
    } else {
      // Global search — pre-filter by query tokens to avoid loading all embeddings.
      const tokenPatterns = buildBilingualTokenRegexes(query);
      if (!tokenPatterns.length) return [];
      const keywordMatches = await ProductModel.find({
        ...buildFieldMatchClauses(tokenPatterns, ["title", "category"], "or"),
      })
        .select("_id")
        .limit(2000)
        .lean()
        .exec();
      candidateProductIds = await this.#keepPriced(keywordMatches.map((p) => p._id));
    }

    if (candidateProductIds.length === 0) return [];

    const embeddings = await this.productEmbeddingRepository.findByProducts(
      candidateProductIds,
    );

    const scored = embeddings.map((e) => ({
      productId: e.product.toString(),
      score: cosineSimilarity(queryEmbedding, e.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 100);
  }

  async #keywordSearch(query, marketId) {
    const tokenPatterns = buildBilingualTokenRegexes(query);
    if (!tokenPatterns.length) return [];

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
        { $limit: KEYWORD_LIMIT },
        { $project: { "product._id": 1 } },
      ];

      const results = await MarketProductModel.aggregate(pipeline);
      return results.map((r, i) => ({
        productId: r.product._id.toString(),
        score: 1 / (i + 1),
      }));
    }

    const products = await ProductModel.find({
      ...buildFieldMatchClauses(tokenPatterns, ["title", "category"], "and"),
    })
      .select("_id")
      .limit(KEYWORD_OVERFETCH)
      .lean()
      .exec();
    const priced = await this.#keepPriced(products.map((p) => p._id));

    return priced.slice(0, KEYWORD_LIMIT).map((id, i) => ({
      productId: id.toString(),
      score: 1 / (i + 1),
    }));
  }

  /**
   * Keeps products sold at at least one market, preserving order. Products whose
   * last price was removed by the scraper's stale-price cleanup stay in the
   * catalog but must not show up as search results. (The market-scoped paths
   * start from that market's price rows, so they never need this.)
   */
  async #keepPriced(productIds) {
    if (!productIds.length) return [];
    const pricedIds = await MarketProductModel.distinct("product", {
      product: { $in: productIds },
    });
    const priced = new Set(pricedIds.map((id) => id.toString()));
    return productIds.filter((id) => priced.has(id.toString()));
  }

  #rrfMerge(vectorResults, keywordResults) {
    const scores = new Map();

    vectorResults.forEach(({ productId }, rank) => {
      const prev = scores.get(productId) || 0;
      scores.set(productId, prev + 1 / (RRF_K + rank + 1));
    });

    keywordResults.forEach(({ productId }, rank) => {
      const prev = scores.get(productId) || 0;
      scores.set(productId, prev + 1 / (RRF_K + rank + 1));
    });

    return Array.from(scores.entries())
      .map(([productId, score]) => ({ productId, score }))
      .sort((a, b) => b.score - a.score);
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

    let hydrated = results.map(({ productId, score }) => {
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

    // Re-sort products by their best available price when price intent detected
    if (priceSort) {
      const dir = priceSort === "asc" ? 1 : -1;
      hydrated.sort((a, b) => {
        const priceA = a.marketProducts.length ? a.marketProducts[0].price : Infinity;
        const priceB = b.marketProducts.length ? b.marketProducts[0].price : Infinity;
        return (priceA - priceB) * dir;
      });
    }

    return hydrated;
  }
}
