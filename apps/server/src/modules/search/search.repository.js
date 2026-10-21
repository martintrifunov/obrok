import mongoose from "mongoose";
import { ProductModel } from "../product/product.model.js";
import { MarketProductModel } from "../product/market-product.model.js";

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const buildFieldMatchClauses = (patterns, fields, mode = "and") => {
  if (!patterns.length) return {};

  const clauses = patterns.map((pattern) => ({
    $or: fields.map((field) => ({
      [field]: { $regex: pattern, $options: "i" },
    })),
  }));

  return mode === "or" ? { $or: clauses } : { $and: clauses };
};

export class SearchRepository {
  /**
   * Products whose title or category matches every pattern.
   * @param {string[]} patterns
   * @param {number} limit
   */
  async findMatching(patterns, limit) {
    return ProductModel.find(buildFieldMatchClauses(patterns, ["title", "category"], "and"))
      .select("_id title category")
      .limit(limit)
      .lean()
      .exec();
  }

  /**
   * @param {string} pattern regex source for the start of the title
   * @param {number} limit
   */
  async findTitleStartingWith(pattern, limit) {
    return ProductModel.find({ title: { $regex: `^(?:${pattern})`, $options: "i" } })
      .select("_id title category")
      .limit(limit)
      .lean()
      .exec();
  }

  /**
   * Products of one market whose title or category matches every pattern.
   * @param {string} marketId
   * @param {string[]} patterns
   * @param {number} limit
   */
  async findMatchingInMarket(marketId, patterns, limit) {
    const rows = await MarketProductModel.aggregate([
      { $match: { market: toObjectId(marketId) } },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: buildFieldMatchClauses(patterns, ["product.title", "product.category"], "and") },
      { $limit: limit },
      { $project: { "product._id": 1, "product.title": 1, "product.category": 1 } },
    ]);
    return rows.map((r) => r.product);
  }

  /** @param {string} marketId */
  async findMarketProductIds(marketId) {
    const rows = await MarketProductModel.find({ market: toObjectId(marketId) })
      .select("product")
      .lean()
      .exec();
    return rows.map((r) => r.product);
  }

  /**
   * The given ids that are sold at some market, in the given order.
   * @param {unknown[]} productIds
   * @returns {Promise<string[]>}
   */
  async keepPriced(productIds) {
    if (!productIds.length) return [];
    const pricedIds = await MarketProductModel.distinct("product", {
      product: { $in: productIds.map(toObjectId) },
    });
    const priced = new Set(pricedIds.map(String));
    return productIds.map(String).filter((id) => priced.has(id));
  }

  /**
   * @param {string[]} productIds
   * @param {string} [marketId]
   * @returns {Promise<Map<string, { min: number, max: number }>>}
   */
  async findPriceRanges(productIds, marketId) {
    if (!productIds.length) return new Map();
    const match = { product: { $in: productIds.map(toObjectId) } };
    if (marketId) match.market = toObjectId(marketId);
    const rows = await MarketProductModel.aggregate([
      { $match: match },
      { $group: { _id: "$product", min: { $min: "$price" }, max: { $max: "$price" } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), { min: r.min, max: r.max }]));
  }

  /**
   * @param {string[]} productIds
   * @returns {Promise<Map<string, string>>} title by product id
   */
  async findTitles(productIds) {
    if (!productIds.length) return new Map();
    const products = await ProductModel.find({ _id: { $in: productIds.map(toObjectId) } }, { title: 1 }).lean().exec();
    return new Map(products.map((p) => [String(p._id), p.title || ""]));
  }

  /**
   * Products with images, and their price rows with market, chain and chain image.
   * @param {string[]} productIds
   * @param {string} [marketId]
   */
  async findForDisplay(productIds, marketId) {
    const ids = productIds.map(toObjectId);
    const priceQuery = { product: { $in: ids } };
    if (marketId) priceQuery.market = toObjectId(marketId);

    const [products, marketProducts] = await Promise.all([
      ProductModel.find({ _id: { $in: ids } })
        .populate({ path: "image", select: "title url mimeType" })
        .lean()
        .exec(),
      MarketProductModel.find(priceQuery)
        .populate({
          path: "market",
          populate: {
            path: "chain",
            populate: { path: "image", select: "title url mimeType" },
          },
        })
        .lean()
        .exec(),
    ]);
    return { products, marketProducts };
  }
}
