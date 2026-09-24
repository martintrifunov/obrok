import cron from "node-cron";
import { syncProductEmbeddings } from "../search/product-embedding-sync.service.js";
import { createAllScrapers } from "./scraper.registry.js";
import { APP_TIME_ZONE } from "../../shared/utils/calendarDate.js";

/**
 * Initialises the scraper cron job.
 * Schedule: 03:00 Skopje time on Monday and Thursday (twice a week).
 *
 * @param {import('./scraper.service.js').ScraperService} scraperService
 * @param {import('../search/embedding.service.js').EmbeddingService} embeddingService
 * @param {import('../search/product-embedding.repository.js').ProductEmbeddingRepository} productEmbeddingRepository
 * @param {import('../product/product.repository.js').ProductRepository} productRepository
 * @param {import('../feature-flag/feature-flag.service.js').FeatureFlagService} featureFlagService
 */
export const startScraperCron = (
  scraperService,
  embeddingService,
  productEmbeddingRepository,
  productRepository,
  featureFlagService,
) => {
  const task = cron.schedule("0 3 * * 1,4", async () => {
    console.log("[ScraperCron] Starting scheduled scrape run...");

    const scrapers = createAllScrapers();

    for (const scraper of scrapers) {
      try {
        await scraperService.runForMarket(scraper);
      } catch (err) {
        console.error(
          `[ScraperCron] Fatal error for ${scraper.constructor.name}:`,
          err.message,
        );
      }
    }

    console.log("[ScraperCron] All markets done.");

    // Generate embeddings for any new/changed products after all scraping is complete.
    await syncProductEmbeddings({
      embeddingService,
      productEmbeddingRepository,
      featureFlagService,
      logPrefix: "[ScraperCron]",
    });
  }, { timezone: APP_TIME_ZONE });

  console.log(
    `[ScraperCron] Scheduled — runs at 03:00 ${APP_TIME_ZONE} every Monday and Thursday.`,
  );

  return task;
};
