import { MarketModel } from "./market.model.js";
import { escapeRegExp } from "../../shared/utils/bilingualRegex.js";

const CHAIN = {
  path: "chain",
  populate: { path: "image", select: "title url mimeType" },
};

export class MarketRepository {
  #buildQuery(filter = {}) {
    const query = {};
    if (filter.name) {
      query.name = { $regex: escapeRegExp(filter.name), $options: "i" };
    }
    if (filter.chain) {
      query.chain = filter.chain;
    }
    return query;
  }

  async findAll({ page, limit, filter = {} }) {
    const query = this.#buildQuery(filter);
    const find = () => MarketModel.find(query).populate(CHAIN);

    if (limit === 0) return { docs: await find().exec(), total: null };

    const [docs, total] = await Promise.all([
      find().skip((page - 1) * limit).limit(limit).exec(),
      MarketModel.countDocuments(query).exec(),
    ]);
    return { docs, total };
  }

  async findById(id) {
    return MarketModel.findById(id).populate(CHAIN).exec();
  }

  async findByName(name) {
    return MarketModel.findOne({ name }).exec();
  }

  async findByChain(chainId) {
    return MarketModel.find({ chain: chainId }).exec();
  }

  /**
   * @param {{ chainId?: string, marketId?: string, from?: Date, to?: Date }} [filters]
   */
  async findAllForReport({ chainId, marketId, from, to } = {}) {
    /** @type {Record<string, any>} */
    const query = {};
    if (chainId) query.chain = chainId;
    if (marketId) query._id = marketId;
    if (from || to) {
      query.lastScrapedUpdate = {};
      if (from) query.lastScrapedUpdate.$gte = new Date(from);
      if (to) {
        const endOfDay = new Date(to);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.lastScrapedUpdate.$lte = endOfDay;
      }
    }

    // No cap: reports cover every matching market (hundreds), so only the fields
    // the CSV needs are loaded. The chain image feeds the chain report's image column.
    return MarketModel.find(query)
      .select("name location chain")
      .populate({
        path: "chain",
        select: "name image",
        populate: { path: "image", select: "filename" },
      })
      .populate({
        path: "marketProducts",
        select: "market product price",
        populate: { path: "product", select: "title" },
      })
      .lean()
      .exec();
  }

  async findScrapedIds() {
    return MarketModel.distinct("_id", { lastScrapedUpdate: { $ne: null } }).exec();
  }

  async create(data) {
    return MarketModel.create(data);
  }

  async save(market) {
    return market.save();
  }

  async delete(market) {
    return market.deleteOne();
  }
}
