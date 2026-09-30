import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrphanProductService } from "./orphan-product.service.js";

const productRepository = {
  findScraperMadeIds: vi.fn(),
  findUnpricedScraperMadeIds: vi.fn(),
  deleteScraperMadeByIds: vi.fn(),
};
const marketProductRepository = { findPricedProductIds: vi.fn() };
const productEmbeddingRepository = { deleteByProducts: vi.fn() };

const makeSut = () =>
  new OrphanProductService(productRepository, marketProductRepository, productEmbeddingRepository);

beforeEach(() => {
  vi.clearAllMocks();
  productRepository.deleteScraperMadeByIds.mockImplementation(async (ids) => ({
    deletedCount: ids.length,
  }));
});

describe("OrphanProductService.removeOrphans", () => {
  it("deletes unpriced scraper-made products and their embeddings", async () => {
    marketProductRepository.findPricedProductIds.mockResolvedValue(["p1"]);
    productRepository.findScraperMadeIds.mockResolvedValue(["p2"]);

    const removed = await makeSut().removeOrphans(["p1", "p2", "p3"]);

    expect(productRepository.findScraperMadeIds).toHaveBeenCalledWith(["p2", "p3"]);
    expect(productEmbeddingRepository.deleteByProducts).toHaveBeenCalledWith(["p2"]);
    expect(productRepository.deleteScraperMadeByIds).toHaveBeenCalledWith(["p2"]);
    expect(removed).toBe(1);
  });

  it("dedupes candidates, including ObjectId-like values", async () => {
    const id = { toString: () => "p1" };
    marketProductRepository.findPricedProductIds.mockResolvedValue([]);
    productRepository.findScraperMadeIds.mockResolvedValue([]);

    await makeSut().removeOrphans(["p1", id, "p1"]);

    expect(marketProductRepository.findPricedProductIds).toHaveBeenCalledWith(["p1"]);
  });

  it("keeps everything when all candidates are still priced", async () => {
    marketProductRepository.findPricedProductIds.mockResolvedValue(["p1", "p2"]);

    expect(await makeSut().removeOrphans(["p1", "p2"])).toBe(0);
    expect(productRepository.findScraperMadeIds).not.toHaveBeenCalled();
    expect(productRepository.deleteScraperMadeByIds).not.toHaveBeenCalled();
  });

  it("keeps admin-edited products even without prices", async () => {
    marketProductRepository.findPricedProductIds.mockResolvedValue([]);
    productRepository.findScraperMadeIds.mockResolvedValue([]);

    expect(await makeSut().removeOrphans(["admin-product"])).toBe(0);
    expect(productEmbeddingRepository.deleteByProducts).not.toHaveBeenCalled();
  });

  it("does nothing for no candidates", async () => {
    expect(await makeSut().removeOrphans([])).toBe(0);
    expect(marketProductRepository.findPricedProductIds).not.toHaveBeenCalled();
  });
});

describe("OrphanProductService.sweep", () => {
  it("removes existing unpriced scraper-made products", async () => {
    productRepository.findUnpricedScraperMadeIds.mockResolvedValue(["p9"]);
    marketProductRepository.findPricedProductIds.mockResolvedValue([]);
    productRepository.findScraperMadeIds.mockResolvedValue(["p9"]);

    expect(await makeSut().sweep()).toBe(1);
  });
});
