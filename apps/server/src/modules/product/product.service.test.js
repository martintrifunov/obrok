import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductService } from "./product.service.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { ValidationError } from "../../shared/errors/ValidationError.js";

vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: vi.fn(() => ({
        withTransaction: (fn) => fn(),
        endSession: vi.fn(),
      })),
    },
  };
});

const mockProductRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockMarketRepository = {
  findById: vi.fn(),
};

const mockImageRepository = {
  findById: vi.fn(),
};

const mockMarketProductRepository = {
  findByMarket: vi.fn(),
  create: vi.fn(),
  deleteByProduct: vi.fn(),
  findManualByProduct: vi.fn().mockResolvedValue([]),
  updateManualPrices: vi.fn(),
  deleteManualByMarkets: vi.fn(),
  findByProductAndMarkets: vi.fn().mockResolvedValue([]),
  insertManualPrices: vi.fn(),
};

const mockProductEmbeddingRepository = {
  deleteByProduct: vi.fn(),
};

const mockImageService = {
  deleteIfUnused: vi.fn(),
};

const makeSut = () =>
  new ProductService(
    mockProductRepository,
    mockMarketRepository,
    mockImageRepository,
    mockMarketProductRepository,
    mockProductEmbeddingRepository,
    mockImageService,
  );

beforeEach(() => vi.clearAllMocks());

describe("ProductService", () => {
  describe("getAllProducts", () => {
    it("returns paginated data", async () => {
      mockProductRepository.findAll.mockResolvedValue({
        docs: [{ title: "Pizza" }],
        total: 1,
      });
      const sut = makeSut();
      const result = await sut.getAllProducts({ page: 1, limit: 10 });
      expect(result.data).toEqual([{ title: "Pizza" }]);
      expect(result.pagination).toMatchObject({ total: 1, page: 1, limit: 10 });
    });

    it("returns null pagination when limit is 0", async () => {
      mockProductRepository.findAll.mockResolvedValue({
        docs: [],
        total: null,
      });
      const sut = makeSut();
      const result = await sut.getAllProducts({ page: 1, limit: 0 });
      expect(result.pagination).toBeNull();
    });

    it("passes filter parameters correctly to the repository", async () => {
      mockProductRepository.findAll.mockResolvedValue({ docs: [], total: 0 });
      const sut = makeSut();
      await sut.getAllProducts({
        page: 1,
        limit: 10,
        title: "Pizza",
      });

      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        filter: { title: "Pizza" },
      });
    });

    it("delegates to marketProductRepository when marketId is given", async () => {
      mockMarketProductRepository.findByMarket.mockResolvedValue({
        docs: [{ title: "Bread" }],
        total: 1,
      });
      const sut = makeSut();
      const result = await sut.getAllProducts({
        page: 1,
        limit: 10,
        marketId: "m1",
      });
      expect(result.data).toEqual([{ title: "Bread" }]);
      expect(mockMarketProductRepository.findByMarket).toHaveBeenCalledWith({
        marketId: "m1",
        page: 1,
        limit: 10,
        filter: {},
      });
    });
  });

  describe("getProductById", () => {
    it("returns product if found", async () => {
      const product = { _id: "p1", title: "Pizza" };
      mockProductRepository.findById.mockResolvedValue(product);
      const sut = makeSut();
      const result = await sut.getProductById("p1");
      expect(result).toEqual(product);
    });

    it("throws NotFoundError if product does not exist", async () => {
      mockProductRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.getProductById("p1")).rejects.toThrow(NotFoundError);
    });
  });

  describe("createProduct", () => {
    it("throws NotFoundError if market does not exist", async () => {
      mockMarketRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(
        sut.createProduct({ title: "Pizza", market: "m1", price: 100 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError if image does not exist", async () => {
      mockImageRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(
        sut.createProduct({ title: "Pizza", image: "badImg" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("creates product without market", async () => {
      const created = { _id: "p1", title: "Pizza" };
      mockProductRepository.create.mockResolvedValue(created);
      const sut = makeSut();
      const result = await sut.createProduct({
        title: "Pizza",
        description: "Desc",
      });
      expect(result).toEqual(created);
      expect(mockProductRepository.create).toHaveBeenCalledWith({
        title: "Pizza",
        description: "Desc",
        category: undefined,
        image: null,
      });
    });

    it("creates product with market and price", async () => {
      mockMarketRepository.findById.mockResolvedValue({ _id: "m1" });
      const created = { _id: "p1", title: "Pizza" };
      mockProductRepository.create.mockResolvedValue(created);
      const sut = makeSut();
      const result = await sut.createProduct({
        title: "Pizza",
        market: "m1",
        price: 100,
      });
      expect(result).toEqual(created);
      expect(mockMarketProductRepository.create).toHaveBeenCalledWith({
        market: "m1",
        product: "p1",
        price: 100,
      });
    });
  });

  describe("updateProduct", () => {
    it("throws NotFoundError if product does not exist", async () => {
      mockProductRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.updateProduct("p1", { title: "New" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("updates fields and saves", async () => {
      const product = {
        _id: "p1",
        title: "Old",
        description: "Desc",
      };
      mockProductRepository.findById.mockResolvedValue(product);
      mockProductRepository.save.mockResolvedValue({
        ...product,
        title: "New",
      });
      const sut = makeSut();
      await sut.updateProduct("p1", { title: "New" });
      expect(product.title).toBe("New");
      expect(mockProductRepository.save).toHaveBeenCalledWith(product);
    });

    it("updates and removes hand-added prices", async () => {
      const product = { _id: "p1", title: "Old" };
      mockProductRepository.findById.mockResolvedValue(product);
      mockProductRepository.save.mockResolvedValue(product);
      mockMarketProductRepository.findManualByProduct.mockResolvedValue([
        { market: "m1" },
        { market: "m2" },
      ]);
      const sut = makeSut();

      await sut.updateProduct("p1", {
        prices: [{ market: "m1", price: 99 }],
        removedMarkets: ["m2"],
      });

      expect(mockMarketProductRepository.findManualByProduct).toHaveBeenCalledWith("p1", ["m1", "m2"]);
      expect(mockMarketProductRepository.updateManualPrices).toHaveBeenCalledWith("p1", [
        { market: "m1", price: 99 },
      ]);
      expect(mockMarketProductRepository.deleteManualByMarkets).toHaveBeenCalledWith("p1", ["m2"]);
    });

    describe("addedPrices", () => {
      const product = () => ({ _id: "p1", title: "Old" });

      it("inserts hand-added prices at new markets", async () => {
        const p = product();
        mockProductRepository.findById.mockResolvedValue(p);
        mockProductRepository.save.mockResolvedValue(p);
        mockMarketRepository.findById.mockResolvedValue({ _id: "m9" });
        mockMarketProductRepository.findByProductAndMarkets.mockResolvedValue([]);
        const sut = makeSut();

        await sut.updateProduct("p1", { addedPrices: [{ market: "m9", price: 50 }] });

        expect(mockMarketProductRepository.findByProductAndMarkets).toHaveBeenCalledWith("p1", ["m9"]);
        expect(mockMarketProductRepository.insertManualPrices).toHaveBeenCalledWith("p1", [
          { market: "m9", price: 50 },
        ]);
      });

      it("rejects a market the product already has a price at, saving nothing", async () => {
        const p = product();
        mockProductRepository.findById.mockResolvedValue(p);
        mockMarketRepository.findById.mockResolvedValue({ _id: "m9" });
        mockMarketProductRepository.findByProductAndMarkets.mockResolvedValue([{ market: "m9" }]);
        const sut = makeSut();

        await expect(
          sut.updateProduct("p1", { title: "New", addedPrices: [{ market: "m9", price: 50 }] }),
        ).rejects.toThrow(ValidationError);
        expect(mockProductRepository.save).not.toHaveBeenCalled();
        expect(mockMarketProductRepository.insertManualPrices).not.toHaveBeenCalled();
      });

      it("rejects a market that no longer exists", async () => {
        mockProductRepository.findById.mockResolvedValue(product());
        mockMarketRepository.findById.mockResolvedValue(null);
        const sut = makeSut();

        await expect(
          sut.updateProduct("p1", { addedPrices: [{ market: "gone", price: 50 }] }),
        ).rejects.toThrow(ValidationError);
        expect(mockMarketProductRepository.insertManualPrices).not.toHaveBeenCalled();
      });

      it("rejects adding a market that is also being changed or removed", async () => {
        mockProductRepository.findById.mockResolvedValue(product());
        mockMarketProductRepository.findManualByProduct.mockResolvedValue([{ market: "m1" }]);
        const sut = makeSut();

        await expect(
          sut.updateProduct("p1", {
            removedMarkets: ["m1"],
            addedPrices: [{ market: "m1", price: 50 }],
          }),
        ).rejects.toThrow(ValidationError);
        expect(mockProductRepository.save).not.toHaveBeenCalled();
      });
    });

    it("rejects changes to scraped prices without saving anything", async () => {
      const product = { _id: "p1", title: "Old" };
      mockProductRepository.findById.mockResolvedValue(product);
      mockMarketProductRepository.findManualByProduct.mockResolvedValue([{ market: "m1" }]);
      const sut = makeSut();

      await expect(
        sut.updateProduct("p1", {
          title: "New",
          prices: [{ market: "m1", price: 99 }, { market: "scraped", price: 1 }],
        }),
      ).rejects.toThrow(ValidationError);
      expect(mockProductRepository.save).not.toHaveBeenCalled();
      expect(mockMarketProductRepository.updateManualPrices).not.toHaveBeenCalled();
      expect(product.title).toBe("Old");
    });

    it("clears the image when image is null", async () => {
      const product = { _id: "p1", title: "Old", image: "img1" };
      mockProductRepository.findById.mockResolvedValue(product);
      mockProductRepository.save.mockResolvedValue(product);
      const sut = makeSut();
      await sut.updateProduct("p1", { image: null });
      expect(product.image).toBeNull();
      expect(mockImageRepository.findById).not.toHaveBeenCalled();
    });

    it("keeps the image when image is omitted", async () => {
      const product = { _id: "p1", title: "Old", image: "img1" };
      mockProductRepository.findById.mockResolvedValue(product);
      mockProductRepository.save.mockResolvedValue(product);
      const sut = makeSut();
      await sut.updateProduct("p1", { title: "New" });
      expect(product.image).toBe("img1");
    });

    it("throws NotFoundError if new image does not exist", async () => {
      const product = { _id: "p1", title: "Old" };
      mockProductRepository.findById.mockResolvedValue(product);
      mockImageRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(
        sut.updateProduct("p1", { image: "badImg" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteProduct", () => {
    it("throws NotFoundError if product does not exist", async () => {
      mockProductRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.deleteProduct("p1")).rejects.toThrow(NotFoundError);
    });

    it("deletes market products and product", async () => {
      const product = { _id: "p1", title: "Pizza" };
      mockProductRepository.findById.mockResolvedValue(product);
      mockMarketProductRepository.deleteByProduct.mockResolvedValue(null);
      mockProductEmbeddingRepository.deleteByProduct.mockResolvedValue(null);
      mockProductRepository.delete.mockResolvedValue(null);
      const sut = makeSut();
      await sut.deleteProduct("p1");
      expect(mockMarketProductRepository.deleteByProduct).toHaveBeenCalledWith("p1");
      expect(mockProductEmbeddingRepository.deleteByProduct).toHaveBeenCalledWith("p1");
      expect(mockProductRepository.delete).toHaveBeenCalledWith(product);
    });

    it("cleans up the product's image after deleting it", async () => {
      mockProductRepository.findById.mockResolvedValue({ _id: "p1", image: { _id: "img1" } });
      const sut = makeSut();

      await sut.deleteProduct("p1");

      expect(mockImageService.deleteIfUnused).toHaveBeenCalledWith("img1");
    });
  });
});
