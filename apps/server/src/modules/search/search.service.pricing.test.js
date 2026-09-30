import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchService } from "./search.service.js";

// Catalog: "млеко 1" and "млеко 3" are sold somewhere; "млеко 2" lost its last
// price in the scraper's stale-price cleanup.
const products = [
  { _id: "p1", title: "Млеко 1" },
  { _id: "p2", title: "Млеко 2" },
  { _id: "p3", title: "Млеко 3" },
];
const priceRows = [
  { product: "p1", price: 60, market: { _id: "m1", name: "Vero" } },
  { product: "p3", price: 55, market: { _id: "m2", name: "KAM" } },
];
const pricedIds = new Set(priceRows.map((r) => r.product));

const repository = () => ({
  findMatching: vi.fn(async () => products),
  findTitleStartingWith: vi.fn(async () => products),
  findMatchingInMarket: vi.fn(async () => []),
  findMarketProductIds: vi.fn(async () => []),
  keepPriced: vi.fn(async (ids) => ids.map(String).filter((id) => pricedIds.has(id))),
  findPriceRanges: vi.fn(async () => new Map()),
  findForDisplay: vi.fn(async (ids) => ({
    products: products.filter((p) => ids.includes(p._id)),
    marketProducts: priceRows.filter((r) => ids.includes(r.product)),
  })),
});

describe("SearchService hides products without prices", () => {
  let embeddingService;
  let vectorIndex;
  let service;

  beforeEach(() => {
    embeddingService = {
      isAvailable: vi.fn().mockReturnValue(true),
      generateEmbedding: vi.fn().mockResolvedValue([1, 0]),
    };
    // The index knows every product, including the unpriced one.
    vectorIndex = {
      isReady: () => true,
      load: vi.fn(),
      search: vi.fn((_query, { productIds } = {}) => {
        const all = products.map((p, i) => ({ productId: p._id, score: 1 - i / 10 }));
        return productIds ? all.filter((h) => [...productIds].includes(h.productId)) : all;
      }),
    };
    service = new SearchService(
      repository(),
      embeddingService,
      vectorIndex,
      { isEnabled: vi.fn().mockResolvedValue(true) },
    );
  });

  it("returns only priced products and counts only them", async () => {
    const result = await service.searchProducts({ q: "млеко" });

    expect(result.data.map((r) => r.product._id).sort()).toEqual(["p1", "p3"]);
    expect(result.pagination.total).toBe(2);
    for (const r of result.data) expect(r.marketProducts.length).toBeGreaterThan(0);
  });

  it("drops unpriced products found by vector search", async () => {
    const result = await service.searchProducts({ q: "млеко" });

    expect(vectorIndex.search).toHaveBeenCalled();
    expect(result.data.map((r) => r.product._id)).not.toContain("p2");
  });

  it("keyword-only search also drops unpriced products", async () => {
    embeddingService.isAvailable.mockReturnValue(false);
    const result = await service.searchProducts({ q: "млеко" });

    expect(result.data.map((r) => r.product._id).sort()).toEqual(["p1", "p3"]);
    expect(result.pagination.total).toBe(2);
  });

  it("keeps only ingredient candidates close to the best priced match", async () => {
    // Index scores: p1 1.0, p2 0.9 (unpriced), p3 0.8.
    const candidates = await service.findIngredientCandidates("млеко");

    expect(candidates.map((r) => r.product._id)).toEqual(["p1"]);
    expect(candidates[0].marketProducts[0]).toMatchObject({ price: 60 });
  });
});
