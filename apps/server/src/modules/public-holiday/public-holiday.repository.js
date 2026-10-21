import { PublicHolidayModel } from "./public-holiday.model.js";
import { escapeRegExp } from "../../shared/utils/bilingualRegex.js";

export class PublicHolidayRepository {
  async findAll({ page, limit, filter = {} }) {
    const query = this.#buildQuery(filter);
    const [docs, total] = await Promise.all([
      PublicHolidayModel.find(query).sort({ date: 1 }).skip((page - 1) * limit).limit(limit).exec(),
      PublicHolidayModel.countDocuments(query).exec(),
    ]);
    return { docs, total };
  }

  async findById(id) {
    return PublicHolidayModel.findById(id).exec();
  }

  async findByDateRange(from, to) {
    return PublicHolidayModel.find({
      date: { $gte: from, $lte: to },
    })
      .sort({ date: 1 })
      .exec();
  }

  async create(data) {
    return PublicHolidayModel.create(data);
  }

  async save(holiday) {
    return holiday.save();
  }

  async delete(holiday) {
    return holiday.deleteOne();
  }

  #buildQuery(filter = {}) {
    const query = {};
    if (filter.name) {
      query.name = { $regex: escapeRegExp(filter.name), $options: "i" };
    }
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) query.date.$gte = filter.from;
      if (filter.to) query.date.$lte = filter.to;
    }
    return query;
  }
}
