import { describe, it, expect, vi, beforeEach } from "vitest";

const newPage = vi.hoisted(() => vi.fn());

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage,
      close: vi.fn().mockResolvedValue(),
    }),
  },
}));

const { ScraperService } = await import("./scraper.service.js");

const makePage = ({ closeFails = false } = {}) => ({
  setDefaultNavigationTimeout: vi.fn(),
  setDefaultTimeout: vi.fn(),
  setRequestInterception: vi.fn(),
  on: vi.fn(),
  close: closeFails
    ? vi.fn().mockRejectedValue(new Error("Target closed"))
    : vi.fn().mockResolvedValue(),
});

const markets = {
  "Store A": { _id: "mA", name: "Store A", location: [42, 21.4], lastScrapedUpdate: null },
  "Store B": { _id: "mB", name: "Store B", location: [42, 21.5], lastScrapedUpdate: null },
};

const makeSut = () => {
  const marketProduct = {
    bulkUpsert: vi.fn(),
    countSeenInLatestScrape: vi.fn().mockResolvedValue(0),
    deleteUnseenSince: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    backfillLastSeen: vi.fn().mockResolvedValue({ stamped: 0, adminOwned: 0 }),
  };
  const sut = new ScraperService(
    { findByName: vi.fn().mockResolvedValue({ _id: "c1" }), create: vi.fn() },
    {
      findByName: vi.fn(async (name) => markets[name]),
      create: vi.fn(),
      save: vi.fn(),
      findScrapedIds: vi.fn().mockResolvedValue([]),
    },
    {
      bulkUpsertProducts: vi.fn(async (ps) => new Map(ps.map((p) => [p.title, `p-${p.title}`]))),
      findAdminEditedIds: vi.fn().mockResolvedValue([]),
    },
    marketProduct,
    { findByTitle: vi.fn().mockResolvedValue({ _id: "img" }) },
    { geocode: vi.fn() },
  );
  return { sut, marketProduct };
};

const scraper = {
  constructor: { name: "TestScraper" },
  chainName: "Test",
  chainImageKey: "test",
  geocodeSuffix: "Македонија",
  fetchMarkets: vi.fn().mockResolvedValue([
    { name: "Store A", address: "", pricelistUrl: "a" },
    { name: "Store B", address: "", pricelistUrl: "b" },
  ]),
  fetchProducts: vi.fn().mockResolvedValue({
    upToDate: false,
    products: [{ title: "Леб", price: 40, category: "Општо" }],
    newUpdateDate: new Date(),
  }),
};

const savedMarkets = (marketProduct) =>
  marketProduct.bulkUpsert.mock.calls.map(([rows]) => rows[0].market);

beforeEach(() => {
  newPage.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ScraperService per-store isolation", () => {
  it("keeps scraping other stores when one store's tab fails to open", async () => {
    newPage
      .mockResolvedValueOnce(makePage()) // setup page for fetchMarkets
      .mockRejectedValueOnce(new Error("Protocol error: Target crashed")) // Store A
      .mockResolvedValueOnce(makePage()); // Store B
    const { sut, marketProduct } = makeSut();

    await expect(sut.runForMarket(scraper)).resolves.toBeUndefined();

    expect(savedMarkets(marketProduct)).toEqual(["mB"]);
  });

  it("ignores a failing page.close after a store is saved", async () => {
    newPage
      .mockResolvedValueOnce(makePage())
      .mockResolvedValueOnce(makePage({ closeFails: true }))
      .mockResolvedValueOnce(makePage());
    const { sut, marketProduct } = makeSut();

    await expect(sut.runForMarket(scraper)).resolves.toBeUndefined();

    expect(savedMarkets(marketProduct).sort()).toEqual(["mA", "mB"]);
  });
});
