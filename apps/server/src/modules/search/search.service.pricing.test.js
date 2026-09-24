import { describe, it, expect, vi, beforeEach } from "vitest";

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

const chain = (result) => {
  const q = {
    select: () => q,
    limit: () => q,
    populate: () => q,
    lean: () => q,
    exec: () => Promise.resolve(result),
  };
  return q;
};

const idsIn = (filter) => (filter?.$in || []).map(String);

vi.mock("../product/product.model.js", () => ({
  ProductModel: {
    find: vi.fn((query) =>
      query._id
        ? chain(products.filter((p) => idsIn(query._id).includes(p._id)))
        : chain(products.map(({ _id }) => ({ _id }))),
    ),
  },
}));

vi.mock("../product/market-product.model.js", () => ({
  MarketProductModel: {
    distinct: vi.fn(async (_field, { product }) =>
      [...new Set(priceRows.map((r) => r.product))].filter((id) => idsIn(product).includes(id)),
    ),
    find: vi.fn((query) =>
      chain(priceRows.filter((r) => idsIn(query.product).includes(r.product))),
    ),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

// A constructor can't return a primitive, so box the id; String() unboxes it.
vi.mock("mongoose", () => ({
  default: {
    Types: {
      ObjectId: function ObjectId(id) {
        return new String(id);
      },
    },
  },
}));

const { SearchService } = await import("./search.service.js");

describe("SearchService hides products without prices", () => {
  let embeddingService;
  let productEmbeddingRepository;
  let service;

  beforeEach(() => {
    embeddingService = {
      isAvailable: vi.fn().mockReturnValue(true),
      generateEmbedding: vi.fn().mockResolvedValue([1, 0]),
    };
    productEmbeddingRepository = {
      findByProducts: vi.fn(async (ids) =>
        ids.map((id) => ({ product: id, embedding: [1, 0] })),
      ),
    };
    service = new SearchService(
      embeddingService,
      productEmbeddingRepository,
      { isEnabled: vi.fn().mockResolvedValue(true) },
    );
  });

  it("returns only priced products and counts only them", async () => {
    const result = await service.searchProducts({ q: "млеко", parseIntent: false });

    expect(result.data.map((r) => r.product._id).sort()).toEqual(["p1", "p3"]);
    expect(result.pagination.total).toBe(2);
    for (const r of result.data) expect(r.marketProducts.length).toBeGreaterThan(0);
  });

  it("never loads embeddings for unpriced products", async () => {
    await service.searchProducts({ q: "млеко", parseIntent: false });

    const [candidates] = productEmbeddingRepository.findByProducts.mock.calls[0];
    expect(candidates.map(String).sort()).toEqual(["p1", "p3"]);
  });

  it("keyword-only search also drops unpriced products", async () => {
    embeddingService.isAvailable.mockReturnValue(false);
    const result = await service.searchProducts({ q: "млеко", parseIntent: false });

    expect(result.data.map((r) => r.product._id).sort()).toEqual(["p1", "p3"]);
    expect(result.pagination.total).toBe(2);
  });
});
