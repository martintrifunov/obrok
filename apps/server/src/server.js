import "dotenv/config";
import app from "./app.js";
import mongoose from "mongoose";
import { startScraperCron } from "./modules/scraper/scraper.cron.js";
import { startAnalyticsCron } from "./modules/analytics/analytics.cron.js";
import { seedAdminUser } from "./infrastructure/database/seed.js";
import { seedChainImages } from "./infrastructure/database/seed-chain-images.js";
import { seedFeatureFlags } from "./infrastructure/database/seed-feature-flags.js";
import { scraperService, analyticsService, embeddingService, productEmbeddingRepository, vectorIndex, featureFlagService, reportService } from "./container.js";

const PORT = process.env.PORT || 5000;
// Docker sends SIGKILL 10s after SIGTERM; finish before that.
const SHUTDOWN_TIMEOUT_MS = 8000;

const registerShutdown = (server, cronTasks) => {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);

    cronTasks.forEach((task) => task.stop());
    setTimeout(() => {
      console.error("Graceful shutdown timed out, forcing exit.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

const prepareVectorIndex = async () => {
  // Refresh even if the startup load fails; a later search loads it lazily.
  vectorIndex.startAutoRefresh();
  const packed = await productEmbeddingRepository.packLegacyEmbeddings();
  if (packed) console.log(`[VectorIndex] Packed ${packed} legacy embeddings.`);
  if (await featureFlagService.isEnabled("ai-search")) await vectorIndex.load();
};

const start = async () => {
  await mongoose.connect(process.env.DATABASE_URI);
  console.log("Connected to MongoDB");

  await seedAdminUser();
  await seedChainImages();
  await seedFeatureFlags();

  // Price rows created before lastSeenAt existed need it before admins can edit them.
  await scraperService.backfillLegacyPriceRows();
  await scraperService.sweepOrphanProducts();

  const aborted = await reportService.abortInterruptedJobs();
  if (aborted > 0) console.log(`Marked ${aborted} interrupted report job(s) as aborted.`);
  await reportService.cleanupStaleReports();

  const cronTasks = [
    startScraperCron(scraperService, embeddingService, productEmbeddingRepository, featureFlagService, vectorIndex),
    startAnalyticsCron(analyticsService),
  ];

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  // Search works keyword-only until the index is ready.
  prepareVectorIndex().catch((err) => console.error("[VectorIndex] Startup load failed:", err));
  registerShutdown(server, cronTasks);
};

// A failed seed used to leave the process alive but never listening, so
// Docker's restart policy never kicked in. Exit so it does.
start().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
