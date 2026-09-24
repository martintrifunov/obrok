import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../../../../.env") });

import mongoose from "mongoose";
import { ChainRepository } from "../modules/chain/chain.repository.js";
import { ProductRepository } from "../modules/product/product.repository.js";
import { MarketProductRepository } from "../modules/product/market-product.repository.js";
import { MarketRepository } from "../modules/market/market.repository.js";
import { ImageRepository } from "../modules/image/image.repository.js";
import { GeocoderService } from "../modules/scraper/geocoder.service.js";
import { ScraperService } from "../modules/scraper/scraper.service.js";
import { EmbeddingService } from "../modules/search/embedding.service.js";
import { ProductEmbeddingRepository } from "../modules/search/product-embedding.repository.js";
import { syncProductEmbeddings } from "../modules/search/product-embedding-sync.service.js";
import { FeatureFlagRepository } from "../modules/feature-flag/feature-flag.repository.js";
import { FeatureFlagService } from "../modules/feature-flag/feature-flag.service.js";
import {
  createAllScrapers,
  createScraper,
  SCRAPER_KEYS,
} from "../modules/scraper/scraper.registry.js";

async function main() {
  const target = process.argv[2]?.toLowerCase();
  const selectedScraper = target ? createScraper(target) : null;

  if (target && !selectedScraper) {
    console.error(
      `[scrape] Unknown market "${target}". ` +
        `Available: ${SCRAPER_KEYS.join(", ")}`,
    );
    process.exit(1);
  }

  const scrapers = selectedScraper ? [selectedScraper] : createAllScrapers();

  const uri = process.env.MONGO_URI_LOCAL ?? process.env.DATABASE_URI;

  if (!uri) {
    console.error("[scrape] No MongoDB URI found in .env");
    process.exit(1);
  }

  console.log(`[scrape] Connecting to MongoDB...`);
  await mongoose.connect(uri);
  console.log("[scrape] DB connected.\n");

  const featureFlagService = new FeatureFlagService(new FeatureFlagRepository());
  const embeddingService = new EmbeddingService();
  const productEmbeddingRepository = new ProductEmbeddingRepository();
  const productRepository = new ProductRepository();

  const scraperService = new ScraperService(
    new ChainRepository(),
    new MarketRepository(),
    productRepository,
    new MarketProductRepository(),
    new ImageRepository(),
    new GeocoderService(),
  );

  // Start total timer
  const globalStartTime = performance.now();

  for (const scraper of scrapers) {
    await scraperService.runForMarket(scraper);
  }

  // Generate embeddings after all scraping completes
  await syncProductEmbeddings({
    embeddingService,
    productEmbeddingRepository,
    featureFlagService,
    logPrefix: "[scrape]",
  });

  // Calculate total seconds
  const totalDuration = ((performance.now() - globalStartTime) / 1000).toFixed(
    2,
  );

  await mongoose.disconnect();
  console.log(
    `[scrape] 🎉 All done in ${totalDuration} seconds. DB disconnected.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[scrape] Fatal error:", err);
  mongoose.disconnect();
  process.exit(1);
});
