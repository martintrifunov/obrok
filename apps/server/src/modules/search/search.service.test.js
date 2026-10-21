import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchService } from "./search.service.js";

const emptyRepository = () => ({
  findMatching: vi.fn().mockResolvedValue([]),
  findTitleStartingWith: vi.fn().mockResolvedValue([]),
  findMatchingInMarket: vi.fn().mockResolvedValue([]),
  findMarketProductIds: vi.fn().mockResolvedValue([]),
  keepPriced: vi.fn(async (ids) => ids.map(String)),
  findPriceRanges: vi.fn().mockResolvedValue(new Map()),
  findTitles: vi.fn().mockResolvedValue(new Map()),
  findForDisplay: vi.fn().mockResolvedValue({ products: [], marketProducts: [] }),
});

describe("SearchService", () => {
  let embeddingService;
  let vectorIndex;
  let featureFlagService;
  let service;

  beforeEach(() => {
    embeddingService = {
      isAvailable: vi.fn().mockReturnValue(true),
      generateEmbedding: vi.fn(),
    };
    vectorIndex = {
      isReady: vi.fn().mockReturnValue(true),
      load: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockReturnValue([]),
    };
    featureFlagService = { isEnabled: vi.fn() };
    service = new SearchService(emptyRepository(), embeddingService, vectorIndex, featureFlagService);
  });

  it("returns empty results when ai-search flag is disabled", async () => {
    featureFlagService.isEnabled.mockResolvedValue(false);

    const result = await service.search({ q: "test", page: 1, limit: 10 });
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
  });

  it("calls vector search with RETRIEVAL_QUERY task type", async () => {
    featureFlagService.isEnabled.mockResolvedValue(true);
    embeddingService.generateEmbedding.mockResolvedValue(new Array(768).fill(0));

    await service.search({ q: "леб", page: 1, limit: 10 });

    expect(embeddingService.generateEmbedding).toHaveBeenCalledWith("леб", "RETRIEVAL_QUERY");
  });

  it("embeds Latin queries in Cyrillic", async () => {
    featureFlagService.isEnabled.mockResolvedValue(true);
    embeddingService.generateEmbedding.mockResolvedValue([1, 0]);

    await service.search({ q: "najeftin kaskaval", page: 1, limit: 10 });

    expect(embeddingService.generateEmbedding).toHaveBeenCalledWith("каскавал", "RETRIEVAL_QUERY");
  });

  it("starts loading the index and answers keyword-only while it isn't ready", async () => {
    featureFlagService.isEnabled.mockResolvedValue(true);
    vectorIndex.isReady.mockReturnValue(false);

    await service.search({ q: "леб", page: 1, limit: 10 });

    expect(vectorIndex.load).toHaveBeenCalled();
    expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
  });

  it("falls back to keyword-only when embeddings unavailable", async () => {
    featureFlagService.isEnabled.mockResolvedValue(true);
    embeddingService.isAvailable.mockReturnValue(false);

    const result = await service.search({ q: "test", page: 1, limit: 10 });
    expect(result.data).toEqual([]);
    expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
  });
});
