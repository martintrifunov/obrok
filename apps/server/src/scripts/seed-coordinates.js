/**
 * Seed/migration script to update existing market coordinates from the static JSON file.
 * Reads market-coordinates.json and patches every matching market document in MongoDB.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { MarketModel } from "../modules/market/market.model.js";
import { normalizeMarketName } from "../modules/scraper/normalize-market-name.js";
import { scriptMongoUri } from "../shared/utils/scriptMongoUri.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../../../../.env") });

const COORDS_PATH = path.resolve(__dirname, "../data/market-coordinates.json");

async function main() {
  let coords;
  try {
    coords = JSON.parse(fs.readFileSync(COORDS_PATH, "utf-8"));
  } catch {
    console.error("[seed-coords] Could not read market-coordinates.json");
    process.exit(1);
  }

  const totalEntries = Object.keys(coords).length;
  if (totalEntries === 0) {
    console.log("[seed-coords] JSON is empty — nothing to seed.");
    process.exit(0);
  }

  const uri = scriptMongoUri();
  if (!uri) {
    console.error("[seed-coords] No MongoDB URI found in .env");
    process.exit(1);
  }

  console.log("[seed-coords] Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("[seed-coords] DB connected.\n");

  const allMarkets = await MarketModel.find({});
  console.log(`[seed-coords] Found ${allMarkets.length} markets in DB.`);
  console.log(`[seed-coords] JSON has ${totalEntries} coordinate entries.\n`);

  let updated = 0;
  let notFound = 0;
  const missing = [];

  for (const [key, location] of Object.entries(coords)) {
    const market = allMarkets.find((m) => normalizeMarketName(m.name) === key);

    if (!market) {
      notFound++;
      continue;
    }

    const [oldLat, oldLon] = market.location;
    const [newLat, newLon] = location;

    if (oldLat === newLat && oldLon === newLon) continue;

    market.location = location;
    await market.save();
    updated++;
    console.log(
      `  ✅ ${market.name}: [${oldLat}, ${oldLon}] → [${newLat}, ${newLon}]`,
    );
  }

  for (const market of allMarkets) {
    const key = normalizeMarketName(market.name);
    if (!coords[key]) {
      missing.push(key);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("[seed-coords] DONE");
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  📦 JSON entries not in DB: ${notFound}`);
  console.log(`  ⚠️  DB markets missing from JSON: ${missing.length}`);

  if (missing.length > 0) {
    console.log("\nMarkets in DB without coordinates in JSON:");
    for (const m of missing) {
      console.log(`  - ${m}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed-coords] Fatal error:", err);
  process.exit(1);
});
