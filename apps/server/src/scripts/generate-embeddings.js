import "./load-env.js";
import mongoose from "mongoose";
import { EmbeddingService } from "../modules/search/embedding.service.js";
import { ProductEmbeddingRepository } from "../modules/search/product-embedding.repository.js";
import { syncProductEmbeddings } from "../modules/search/product-embedding-sync.service.js";
import { scriptMongoUri } from "../shared/utils/scriptMongoUri.js";

const main = async () => {
  const force =
    process.argv.includes("--force") ||
    process.env.npm_config_force === "true" ||
    process.env.npm_config_force === "1";
  const dbUri = scriptMongoUri();

  if (!dbUri) {
    console.error("Set DATABASE_URI or MONGO_URI_LOCAL in .env");
    process.exit(1);
  }

  const embeddingService = new EmbeddingService();
  if (!embeddingService.isAvailable()) {
    console.error("Set GEMINI_API_KEY in .env");
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log(`[Embeddings] Connected to MongoDB. Force mode: ${force ? "ON" : "OFF"}`);

  await syncProductEmbeddings({
    embeddingService,
    productEmbeddingRepository: new ProductEmbeddingRepository(),
    featureFlagService: null,
    force,
    logPrefix: "[Embeddings]",
  });

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
