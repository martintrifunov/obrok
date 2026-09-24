import "dotenv/config";
import app from "./app.js";
import connectDB from "./infrastructure/database/connectDB.js";
import mongoose from "mongoose";
import { startScraperCron } from "./modules/scraper/scraper.cron.js";
import { startAnalyticsCron } from "./modules/analytics/analytics.cron.js";
import { seedChainImages } from "./infrastructure/database/seed-chain-images.js";
import { seedFeatureFlags } from "./infrastructure/database/seed-feature-flags.js";
import { scraperService, analyticsService, embeddingService, productEmbeddingRepository, productRepository, featureFlagService, reportService } from "./container.js";

const PORT = process.env.PORT || 5000;
// Docker sends SIGKILL 10s after SIGTERM; finish before that.
const SHUTDOWN_TIMEOUT_MS = 8000;

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

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

const start = async () => {
  await connectDB();
  console.log("Connected to MongoDB");

  await seedChainImages();
  await seedFeatureFlags();

  const aborted = await reportService.abortInterruptedJobs();
  if (aborted > 0) console.log(`Marked ${aborted} interrupted report job(s) as aborted.`);

  const cronTasks = [
    startScraperCron(scraperService, embeddingService, productEmbeddingRepository, productRepository, featureFlagService),
    startAnalyticsCron(analyticsService),
  ];

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  registerShutdown(server, cronTasks);
};

// A failed seed used to leave the process alive but never listening, so
// Docker's restart policy never kicked in. Exit so it does.
start().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
