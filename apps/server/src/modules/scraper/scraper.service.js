import puppeteer from "puppeteer";

const DEFAULT_CONCURRENT_TABS = process.env.NODE_ENV === "production" ? "2" : "4";
const CONCURRENT_TABS = Number.parseInt(
  process.env.SCRAPER_CONCURRENT_TABS ?? DEFAULT_CONCURRENT_TABS,
  10,
);
const NAV_TIMEOUT_MS = Number.parseInt(
  process.env.SCRAPER_NAV_TIMEOUT_MS ?? "90000",
  10,
);
const PROTOCOL_TIMEOUT_MS = Number.parseInt(
  process.env.SCRAPER_PROTOCOL_TIMEOUT_MS ?? "180000",
  10,
);

// A store that suddenly lists far fewer products than before is more likely a
// broken parser or layout change than a real delisting, so don't delete then.
const MIN_RETAINED_RATIO = 0.5;

const isTransientScrapeError = (err) => {
  const message = err?.message ?? "";
  return (
    message.includes("Navigation timeout")
    || message.includes("Runtime.callFunctionOn timed out")
    || message.includes("net::ERR_ABORTED")
  );
};

export class ScraperService {
  constructor(
    chainRepository,
    marketRepository,
    productRepository,
    marketProductRepository,
    imageRepository,
    geocoderService,
    orphanProductService = null,
  ) {
    this.chainRepository = chainRepository;
    this.marketRepository = marketRepository;
    this.productRepository = productRepository;
    this.marketProductRepository = marketProductRepository;
    this.imageRepository = imageRepository;
    this.geocoderService = geocoderService;
    this.orphanProductService = orphanProductService;
    this.legacyPriceRowsBackfilled = false;
    this.orphanProductsSwept = false;
  }

  /** Idempotent; removes products that already have no prices (startup and first scrape). */
  async sweepOrphanProducts() {
    if (this.orphanProductsSwept || !this.orphanProductService) return;

    const removed = await this.orphanProductService.sweep();
    if (removed) {
      console.log(`[ScraperService] Removed ${removed} products with no prices left.`);
    }
    this.orphanProductsSwept = true;
  }

  async #removeOrphanProducts(name, candidates) {
    if (!this.orphanProductService || !candidates.size) return;
    try {
      const removed = await this.orphanProductService.removeOrphans(candidates);
      if (removed) {
        console.log(`[Scraper] 🧹 [${name}] Removed ${removed} products no store sells anymore.`);
      }
    } catch (err) {
      console.error(`[Scraper] [${name}] Orphan product cleanup failed:`, err.message);
    }
  }

  /** Idempotent; runs at startup and before the first scrape in standalone scripts. */
  async backfillLegacyPriceRows() {
    if (this.legacyPriceRowsBackfilled) return;

    const [scrapedMarketIds, adminProductIds] = await Promise.all([
      this.marketRepository.findScrapedIds(),
      this.productRepository.findAdminEditedIds(),
    ]);
    const { stamped, adminOwned } = await this.marketProductRepository.backfillLastSeen({
      scrapedMarketIds,
      adminProductIds,
    });
    if (stamped || adminOwned) {
      console.log(
        `[ScraperService] Backfilled lastSeenAt: ${stamped} scraper-owned, ${adminOwned} admin-owned price rows.`,
      );
    }
    this.legacyPriceRowsBackfilled = true;
  }

  async #removeStalePrices({
    name,
    marketDoc,
    seenCount,
    previousCount,
    seenAt,
    complete,
    orphanCandidates,
  }) {
    if (!complete) {
      console.warn(`[Scraper] ⚠️  [${name}] Incomplete scrape; keeping unseen prices.`);
      return;
    }
    if (previousCount > 0 && seenCount < previousCount * MIN_RETAINED_RATIO) {
      console.warn(
        `[Scraper] ⚠️  [${name}] Saw ${seenCount} products, down from ${previousCount} last scrape; keeping unseen prices in case the scrape is broken.`,
      );
      return;
    }

    const unseenProducts = await this.marketProductRepository.findUnseenProductIds(
      marketDoc._id,
      seenAt,
    );
    const { deletedCount } = await this.marketProductRepository.deleteUnseenSince(
      marketDoc._id,
      seenAt,
    );
    unseenProducts.forEach((id) => orphanCandidates.add(id));
    if (deletedCount) {
      console.log(`[Scraper] 🧹 [${name}] Removed ${deletedCount} delisted or unavailable prices.`);
    }
  }

  async runForMarket(scraper) {
    const startTime = performance.now();
    await this.backfillLegacyPriceRows();
    await this.sweepOrphanProducts();
    console.log(`\n[ScraperService] 🚀 Starting ${scraper.constructor.name}`);
    console.log(
      `[ScraperService] Settings: concurrency=${CONCURRENT_TABS}, navTimeout=${NAV_TIMEOUT_MS}ms, protocolTimeout=${PROTOCOL_TIMEOUT_MS}ms`,
    );

    const chainImageTitle = `chain-${scraper.chainImageKey}`;
    const placeholderImage = await this.imageRepository.findByTitle(
      chainImageTitle,
    );
    if (!placeholderImage) {
      throw new Error(
        `Chain image "${chainImageTitle}" not found in DB. ` +
        `Place a ${scraper.chainImageKey}.png in src/data/chain-images/ and restart the server.`,
      );
    }

    const chainDoc = await this.#ensureChainExists(
      scraper.chainName,
      placeholderImage,
    );

    const browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: PROTOCOL_TIMEOUT_MS,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });

    // Products that lost a price this run. Removed only after every store of the
    // chain is done: tabs run in parallel, and another store may be about to
    // price a product that looks unpriced mid-run.
    const orphanCandidates = new Set();

    try {
      const setupPage = await browser.newPage();
      await this.#optimizePage(setupPage);
      const markets = await scraper.fetchMarkets(setupPage);
      await setupPage.close();

      // Phase 1: Sequential Market Setup
      const readyMarkets = [];
      for (const m of markets) {
        const marketDoc = await this.#ensureMarketExists(
          m.name,
          m.address,
          scraper,
          chainDoc,
        );
        if (marketDoc) {
          readyMarkets.push({ ...m, marketDoc });
        }
      }

      // Phase 2: Multithreaded Scrape
      for (let i = 0; i < readyMarkets.length; i += CONCURRENT_TABS) {
        const batch = readyMarkets.slice(i, i + CONCURRENT_TABS);
        await Promise.all(
          batch.map((m) =>
            this.#scrapeAndSaveStore(m, scraper, browser, orphanCandidates),
          ),
        );
      }
    } finally {
      await browser.close();
      await this.#removeOrphanProducts(scraper.chainName, orphanCandidates);
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(
        `\n[ScraperService] ✅ Finished ${scraper.constructor.name} in ${duration}s`,
      );
    }
  }

  async #optimizePage(page) {
    await page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    await page.setDefaultTimeout(NAV_TIMEOUT_MS);
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  async #ensureChainExists(chainName, placeholderImage) {
    let chain = await this.chainRepository.findByName(chainName);
    if (chain) return chain;

    return this.chainRepository.create({
      name: chainName,
      image: placeholderImage._id,
    });
  }

  async #ensureMarketExists(name, address, scraper, chainDoc) {
    let market = await this.marketRepository.findByName(name);
    if (market) return market;

    const location = await this.geocoderService.geocode(
      name,
      scraper.geocodeSuffix,
      address,
    );

    if (!location) {
      console.warn(
        `[ScraperService] ⚠️  Skipping market "${name}" — no coordinates available.`,
      );
      return null;
    }

    return this.marketRepository.create({
      name,
      location,
      chain: chainDoc._id,
    });
  }

  async #scrapeAndSaveStore(marketData, scraper, browser, orphanCandidates) {
    const { name, pricelistUrl, marketDoc } = marketData;
    const tabStartTime = performance.now();
    let page = null;

    // Everything per store stays inside the try: a crashed tab (newPage, setup,
    // or close failing) must only skip this store, not reject the whole batch.
    try {
      page = await browser.newPage();
      await this.#optimizePage(page);

      let result;
      let lastError;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          result = await scraper.fetchProducts(
            page,
            pricelistUrl,
            marketDoc.lastScrapedUpdate,
          );
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 2 || !isTransientScrapeError(err)) {
            throw err;
          }

          console.warn(
            `[ScraperService] Retry ${attempt}/1 for [${name}] after transient error: ${err.message}`,
          );

          await page.close().catch(() => {});
          page = await browser.newPage();
          await this.#optimizePage(page);
        }
      }

      if (lastError) {
        throw lastError;
      }

      if (result.upToDate) {
        const tabDuration = ((performance.now() - tabStartTime) / 1000).toFixed(
          2,
        );
        console.log(
          `[Scraper] ⚡ [${name}] No changes detected. Skipped in ${tabDuration}s.`,
        );
        return;
      }

      const rawProducts = result.products;
      if (!rawProducts || !rawProducts.length) {
        console.warn(`[Scraper] ⚠️  [${name}] Returned 0 products.`);
        return;
      }

      const productsData = rawProducts.map(({ title, category }) => ({
        title,
        category,
      }));

      const productIdMap = await this.#safeProductUpsert(productsData);

      const marketProducts = rawProducts
        .filter(({ title }) => productIdMap.has(title))
        .map(({ title, price }) => ({
          market: marketDoc._id,
          product: productIdMap.get(title),
          price,
        }));

      const seenAt = new Date();
      const previousCount = await this.marketProductRepository.countSeenInLatestScrape(
        marketDoc._id,
      );
      await this.marketProductRepository.bulkUpsert(marketProducts, { seenAt });
      await this.#removeStalePrices({
        name,
        marketDoc,
        seenCount: marketProducts.length,
        previousCount,
        seenAt,
        complete: result.complete !== false,
        orphanCandidates,
      });

      if (result.newUpdateDate) {
        marketDoc.lastScrapedUpdate = result.newUpdateDate;
        await this.marketRepository.save(marketDoc);
      }

      const tabDuration = ((performance.now() - tabStartTime) / 1000).toFixed(
        2,
      );
      console.log(
        `[Scraper] ✅ [${name}] Scraped ${rawProducts.length} items in ${tabDuration}s`,
      );
    } catch (err) {
      console.error(`[ScraperService] Error in [${name}]:`, err.message);
    } finally {
      await page?.close().catch(() => {});
    }
  }

  async #safeProductUpsert(productsData, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.productRepository.bulkUpsertProducts(productsData);
      } catch (err) {
        if (err.code === 11000 && attempt < retries) {
          await new Promise((res) => setTimeout(res, 500 * attempt));
          continue;
        }
        throw err;
      }
    }
  }
}
