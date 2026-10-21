import { ChainModel } from "./chain.model.js";
import { escapeRegExp } from "../../shared/utils/bilingualRegex.js";

const IMAGE = { path: "image", select: "title url mimeType" };

export class ChainRepository {
  #buildQuery(filter = {}) {
    const query = {};
    if (filter.name) {
      query.name = { $regex: escapeRegExp(filter.name), $options: "i" };
    }
    return query;
  }

  async findAll({ page, limit, filter = {} }) {
    const query = this.#buildQuery(filter);
    const find = () => ChainModel.find(query).populate(IMAGE).populate("markets");

    if (limit === 0) return { docs: await find().exec(), total: null };

    const [docs, total] = await Promise.all([
      find().skip((page - 1) * limit).limit(limit).exec(),
      ChainModel.countDocuments(query).exec(),
    ]);
    return { docs, total };
  }

  async findById(id) {
    return ChainModel.findById(id).populate(IMAGE).populate("markets").exec();
  }

  async findByName(name) {
    return ChainModel.findOne({ name }).exec();
  }

  async create(data) {
    return ChainModel.create(data);
  }

  async save(chain) {
    return chain.save();
  }

  async delete(chain) {
    return chain.deleteOne();
  }
}
