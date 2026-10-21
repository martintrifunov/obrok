import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";

export class PublicHolidayService {
  constructor(publicHolidayRepository) {
    this.publicHolidayRepository = publicHolidayRepository;
  }

  async getAllHolidays({ page, limit, name, from, to }) {
    const { docs, total } = await this.publicHolidayRepository.findAll({
      page,
      limit,
      filter: { name, from, to },
    });
    return {
      data: docs,
      pagination: buildPaginationMeta({ total, page, limit }),
    };
  }

  async getHolidayById(id) {
    const holiday = await this.publicHolidayRepository.findById(id);
    if (!holiday) throw new NotFoundError(`No holiday matches ID ${id}.`);
    return holiday;
  }

  async getHolidaysByDateRange(from, to) {
    return this.publicHolidayRepository.findByDateRange(from, to);
  }

  async createHoliday({ name, date }) {
    return this.publicHolidayRepository.create({ name, date });
  }

  async updateHoliday(id, { name, date }) {
    const holiday = await this.publicHolidayRepository.findById(id);
    if (!holiday) throw new NotFoundError(`No holiday matches ID ${id}.`);

    if (name) holiday.name = name;
    if (date) holiday.date = date;

    return this.publicHolidayRepository.save(holiday);
  }

  async deleteHoliday(id) {
    const holiday = await this.publicHolidayRepository.findById(id);
    if (!holiday) throw new NotFoundError(`No holiday matches ID ${id}.`);
    await this.publicHolidayRepository.delete(holiday);
  }
}
