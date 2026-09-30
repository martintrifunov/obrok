import { MealIntentModel } from "./meal-intent.model.js";

export class MealIntentRepository {
  async findByKey(key) {
    return MealIntentModel.findOne({ key }).select("intent products").lean().exec();
  }

  async save(key, { intent, products }) {
    return MealIntentModel.updateOne(
      { key },
      { $set: { intent, products }, $setOnInsert: { key } },
      { upsert: true },
    ).exec();
  }
}
