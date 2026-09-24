import mongoose from "mongoose";

const MarketProductSchema = new mongoose.Schema({
  market: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Market",
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  price: { type: Number, required: true },
  // Set by the scraper on every run that sees this row; null for rows an admin
  // created by hand, which scrape cleanup never touches.
  lastSeenAt: { type: Date, default: null },
});

MarketProductSchema.index({ market: 1, product: 1 }, { unique: true });
MarketProductSchema.index({ market: 1, lastSeenAt: 1 });

export const MarketProductModel = mongoose.model(
  "MarketProduct",
  MarketProductSchema,
  "market_products",
);
