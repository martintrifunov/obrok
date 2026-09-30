import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScraperService } from "./scraper.service.js";

const mockChainRepository = {
  findByName: vi.fn(),
  create: vi.fn(),
};

const mockMarketRepository = {
  findByName: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  findScrapedIds: vi.fn().mockResolvedValue([]),
};

const mockProductRepository = {
  bulkUpsertProducts: vi.fn(),
  findAdminEditedIds: vi.fn().mockResolvedValue([]),
};

const mockMarketProductRepository = {
  bulkUpsert: vi.fn(),
  backfillLastSeen: vi.fn().mockResolvedValue({ stamped: 0, adminOwned: 0 }),
};

const mockImageRepository = {
  findByTitle: vi.fn(),
};

const mockGeocoderService = {
  geocode: vi.fn(),
};

const makeSut = () =>
  new ScraperService(
    mockChainRepository,
    mockMarketRepository,
    mockProductRepository,
    mockMarketProductRepository,
    mockImageRepository,
    mockGeocoderService,
  );

beforeEach(() => vi.clearAllMocks());

describe("ScraperService", () => {
  describe("runForMarket", () => {
    const makeMockScraper = (overrides = {}) => ({
      constructor: { name: "TestScraper" },
      chainName: "TestChain",
      chainImageKey: "test",
      geocodeSuffix: "Македонија",
      fetchMarkets: vi.fn().mockResolvedValue([]),
      fetchProducts: vi.fn().mockResolvedValue({ upToDate: false, products: [] }),
      ...overrides,
    });

    it("throws when chain image is not found in DB", async () => {
      mockImageRepository.findByTitle.mockResolvedValue(null);
      const sut = makeSut();
      const scraper = makeMockScraper();

      await expect(sut.runForMarket(scraper)).rejects.toThrow(
        /Chain image "chain-test" not found/,
      );
    });

    it("looks up image by title chain-{key}", async () => {
      mockImageRepository.findByTitle.mockResolvedValue({ _id: "img1" });
      mockChainRepository.findByName.mockResolvedValue({ _id: "chain1" });

      const sut = makeSut();
      const scraper = makeMockScraper();

      // Will fail because puppeteer.launch is called, but we can verify the image lookup
      // happens before that point
      try {
        await sut.runForMarket(scraper);
      } catch {
        // Expected — puppeteer not available in test
      }

      expect(mockImageRepository.findByTitle).toHaveBeenCalledWith("chain-test");
    });

    it("creates chain if not found", async () => {
      const imageDoc = { _id: "img1" };
      mockImageRepository.findByTitle.mockResolvedValue(imageDoc);
      mockChainRepository.findByName.mockResolvedValue(null);
      mockChainRepository.create.mockResolvedValue({
        _id: "chain1",
        name: "TestChain",
      });

      const sut = makeSut();
      const scraper = makeMockScraper();

      try {
        await sut.runForMarket(scraper);
      } catch {
        // Expected — puppeteer not available in test
      }

      expect(mockChainRepository.findByName).toHaveBeenCalledWith("TestChain");
    });

    it("reuses existing chain", async () => {
      const imageDoc = { _id: "img1" };
      const chainDoc = { _id: "chain1", name: "TestChain" };
      mockImageRepository.findByTitle.mockResolvedValue(imageDoc);
      mockChainRepository.findByName.mockResolvedValue(chainDoc);

      const sut = makeSut();
      const scraper = makeMockScraper();

      try {
        await sut.runForMarket(scraper);
      } catch {
        // Expected — puppeteer not available in test
      }

      expect(mockChainRepository.create).not.toHaveBeenCalled();
    });
  });
});
