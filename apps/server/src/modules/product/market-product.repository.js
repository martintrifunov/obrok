import mongoose from "mongoose";
import { MarketProductModel } from "./market-product.model.js";
import { buildBilingualRegex } from "../../shared/utils/bilingualRegex.js";

// Stamp for pre-migration scraper rows: known scraper-owned, never seen by a stamped scrape.
const LEGACY_SEEN_AT = new Date(0);

export class MarketProductRepository {
  async findByMarket({ marketId, page, limit, filter = {} }) {
    const matchStage = { market: new mongoose.Types.ObjectId(marketId) };

    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      matchStage.price = {};
      if (filter.minPrice !== undefined)
        matchStage.price.$gte = filter.minPrice;
      if (filter.maxPrice !== undefined)
        matchStage.price.$lte = filter.maxPrice;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ];

    if (filter.title) {
      const regexPattern = buildBilingualRegex(filter.title);
      pipeline.push({
        $match: { "product.title": { $regex: regexPattern, $options: "i" } },
      });
    }

    if (filter.category) {
      const regexPattern = buildBilingualRegex(filter.category);
      pipeline.push({
        $match: { "product.category": { $regex: regexPattern, $options: "i" } },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: "images",
          localField: "product.image",
          foreignField: "_id",
          pipeline: [{ $project: { title: 1, url: 1, mimeType: 1 } }],
          as: "product.image",
        },
      },
      { $unwind: { path: "$product.image", preserveNullAndEmptyArrays: true } },
    );

    if (limit === 0) {
      const docs = await MarketProductModel.aggregate(pipeline);
      return { docs, total: null };
    }

    const countPipeline = [...pipeline, { $count: "total" }];
    const [countResult] = await MarketProductModel.aggregate(countPipeline);
    const total = countResult?.total || 0;

    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: limit });

    const docs = await MarketProductModel.aggregate(pipeline);
    return { docs, total };
  }

  async getUniqueCategories(marketId) {
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
      { $group: { _id: "$product.category" } },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } },
    ];
    const results = await MarketProductModel.aggregate(pipeline);
    return results.map((r) => r._id);
  }

  async findByProduct(productId) {
    return MarketProductModel.find({ product: productId })
      .populate({
        path: "market",
        populate: {
          path: "chain",
          populate: { path: "image", select: "title url mimeType" },
        },
      })
      .exec();
  }

  async bulkUpsert(entries, { seenAt } = {}) {
    if (!entries.length) return null;
    const ops = entries.map(({ market, product, price }) => ({
      updateOne: {
        filter: { market, product },
        update: {
          $set: { market, product, price, ...(seenAt && { lastSeenAt: seenAt }) },
        },
        upsert: true,
      },
    }));
    return MarketProductModel.bulkWrite(ops, { ordered: false });
  }

  /**
   * How many products the market's most recent scrape saw (all rows seen in one
   * scrape share its timestamp). 0 if it has never been scraped with stamps.
   * Stale rows are excluded, so they can't inflate the baseline and block cleanup.
   */
  async countSeenInLatestScrape(marketId) {
    const latest = await MarketProductModel.findOne({
      market: marketId,
      lastSeenAt: { $gt: LEGACY_SEEN_AT },
    })
      .sort({ lastSeenAt: -1 })
      .select("lastSeenAt")
      .lean()
      .exec();
    if (!latest) return 0;

    return MarketProductModel.countDocuments({
      market: marketId,
      lastSeenAt: latest.lastSeenAt,
    }).exec();
  }

  /** Deletes scraper-owned rows of a market that the scrape at `seenAt` didn't see. */
  async deleteUnseenSince(marketId, seenAt) {
    return MarketProductModel.deleteMany({
      market: marketId,
      lastSeenAt: { $ne: null, $lt: seenAt },
    }).exec();
  }

  /**
   * One-time migration for rows created before lastSeenAt existed. Rows in
   * scraped markets whose product has no admin-only fields (description, image)
   * are stamped as scraper-owned but long unseen, so the next complete scrape
   * removes the stale ones. The rest are marked admin-owned (null).
   * Idempotent: only rows missing the field are touched.
   */
  async backfillLastSeen({ scrapedMarketIds, adminProductIds }) {
    const legacy = { lastSeenAt: { $exists: false } };
    const stamped = await MarketProductModel.updateMany(
      {
        ...legacy,
        market: { $in: scrapedMarketIds },
        product: { $nin: adminProductIds },
      },
      { $set: { lastSeenAt: LEGACY_SEEN_AT } },
    ).exec();
    const unowned = await MarketProductModel.updateMany(legacy, {
      $set: { lastSeenAt: null },
    }).exec();
    return { stamped: stamped.modifiedCount, adminOwned: unowned.modifiedCount };
  }

  async create(data) {
    return MarketProductModel.create(data);
  }

  async deleteByMarket(marketId, options = {}) {
    return MarketProductModel.deleteMany({ market: marketId }, options).exec();
  }

  async deleteByProduct(productId, options = {}) {
    return MarketProductModel.deleteMany({ product: productId }, options).exec();
  }
}
