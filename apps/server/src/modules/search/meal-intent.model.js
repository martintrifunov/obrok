import mongoose from "mongoose";

const RETENTION_SECONDS = 180 * 24 * 60 * 60;

const MealIntentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    intent: { type: String, enum: ["recipe", "search"], required: true },
    products: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Refresh stale decompositions twice a year (model and prompt changes).
MealIntentSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const MealIntentModel = mongoose.model("MealIntent", MealIntentSchema, "meal_intents");
