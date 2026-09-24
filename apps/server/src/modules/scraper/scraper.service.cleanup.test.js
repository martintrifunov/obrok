import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("puppeteer", () => {
  const page = {
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    setRequestInterception: vi.fn(),
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(),
  };
  return {
    default: {
      launch: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue(page),
        close: vi.fn().mockResolvedValue(),
      }),
    },
  };
});

const { ScraperService } = await import("./scraper.service.js");

const marketDoc = { _id: "m1", name: "Vero 1", location: [42, 21.4], lastScrapedUpdate: null };

const makeRepos = ({ previousCount }) => ({
  chain: { findByName: vi.fn().mockResolvedValue({ _id: "c1" }), create: vi.fn() },
  market: {
    findByName: vi.fn().mockResolvedValue(marketDoc),
    create: vi.fn(),
    save: vi.fn(),
    findScrapedIds: vi.fn().mockResolvedValue(["m1"]),
  },
  product: {
    bulkUpsertProducts: vi.fn(async (products) => new Map(products.map((p) => [p.title, `p-${p.title}`]))),
    findAdminEditedIds: vi.fn().mockResolvedValue(["admin-product"]),
  },
  marketProduct: {
    bulkUpsert: vi.fn(),
    countSeenInLatestScrape: vi.fn().mockResolvedValue(previousCount),
    deleteUnseenSince: vi.fn().mockResolvedValue({ deletedCount: 3 }),
    backfillLastSeen: vi.fn().mockResolvedValue({ stamped: 0, adminOwned: 0 }),
  },
  image: { findByTitle: vi.fn().mockResolvedValue({ _id: "img" }) },
  geocoder: { geocode: vi.fn() },
});

const products = (n) =>
  Array.from({ length: n }, (_, i) => ({ title: `P${i}`, price: 10 + i, category: "Општо" }));

const makeScraper = (result) => ({
  constructor: { name: "TestScraper" },
  chainName: "Vero",
  chainImageKey: "vero",
  geocodeSuffix: "Македонија",
  fetchMarkets: vi.fn().mockResolvedValue([{ name: "Vero 1", address: "", pricelistUrl: "u" }]),
  fetchProducts: vi.fn().mockResolvedValue(result),
});

const run = async ({ previousCount, result }) => {
  const repos = makeRepos({ previousCount });
  const sut = new ScraperService(
    repos.chain,
    repos.market,
    repos.product,
    repos.marketProduct,
    repos.image,
    repos.geocoder,
  );
  await sut.runForMarket(makeScraper(result));
  return { repos, sut };
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("ScraperService stale price cleanup", () => {
  it("stamps seen rows and deletes the store's unseen ones after a complete scrape", async () => {
    const { repos } = await run({
      previousCount: 10,
      result: { upToDate: false, products: products(8), newUpdateDate: new Date() },
    });

    const [, { seenAt }] = repos.marketProduct.bulkUpsert.mock.calls[0];
    expect(seenAt).toBeInstanceOf(Date);
    expect(repos.marketProduct.deleteUnseenSince).toHaveBeenCalledWith("m1", seenAt);
  });

  it("keeps unseen rows when the scraper reports an incomplete run", async () => {
    const { repos } = await run({
      previousCount: 10,
      result: { upToDate: false, products: products(8), complete: false },
    });

    expect(repos.marketProduct.bulkUpsert).toHaveBeenCalled();
    expect(repos.marketProduct.deleteUnseenSince).not.toHaveBeenCalled();
  });

  it("keeps unseen rows when the store shrank by more than half since the last scrape", async () => {
    const { repos } = await run({
      previousCount: 900,
      result: { upToDate: false, products: products(40), newUpdateDate: new Date() },
    });

    expect(repos.marketProduct.deleteUnseenSince).not.toHaveBeenCalled();
  });

  it("cleans up a store's first scrape, when nothing was known before", async () => {
    const { repos } = await run({
      previousCount: 0,
      result: { upToDate: false, products: products(5), newUpdateDate: new Date() },
    });

    expect(repos.marketProduct.deleteUnseenSince).toHaveBeenCalled();
  });

  it("does nothing when the pricelist is unchanged", async () => {
    const { repos } = await run({ previousCount: 10, result: { upToDate: true } });

    expect(repos.marketProduct.bulkUpsert).not.toHaveBeenCalled();
    expect(repos.marketProduct.deleteUnseenSince).not.toHaveBeenCalled();
  });

  it("backfills legacy rows once per process, excluding admin-edited products", async () => {
    const { repos, sut } = await run({
      previousCount: 10,
      result: { upToDate: true },
    });
    await sut.runForMarket(makeScraper({ upToDate: true }));

    expect(repos.marketProduct.backfillLastSeen).toHaveBeenCalledTimes(1);
    expect(repos.marketProduct.backfillLastSeen).toHaveBeenCalledWith({
      scrapedMarketIds: ["m1"],
      adminProductIds: ["admin-product"],
    });
  });
});
