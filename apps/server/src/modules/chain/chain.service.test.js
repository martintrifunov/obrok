import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChainService } from "./chain.service.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";

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

const mockChainRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockImageRepository = {
  findById: vi.fn(),
};

const mockMarketRepository = {
  findByChain: vi.fn(),
  findAllForReport: vi.fn(),
  delete: vi.fn(),
};

const mockMarketProductRepository = {
  deleteByMarket: vi.fn(),
};

const makeSut = () =>
  new ChainService(
    mockChainRepository,
    mockImageRepository,
    mockMarketRepository,
    mockMarketProductRepository,
  );

beforeEach(() => vi.clearAllMocks());

describe("ChainService", () => {
  describe("getAllChains", () => {
    it("returns paginated data", async () => {
      mockChainRepository.findAll.mockResolvedValue({
        docs: [{ name: "Chain A" }],
        total: 1,
      });
      const sut = makeSut();
      const result = await sut.getAllChains({ page: 1, limit: 10 });
      expect(result.data).toEqual([{ name: "Chain A" }]);
      expect(result.pagination).toMatchObject({ total: 1, page: 1, limit: 10 });
    });

    it("returns null pagination when limit is 0", async () => {
      mockChainRepository.findAll.mockResolvedValue({
        docs: [{ name: "Chain A" }],
        total: null,
      });
      const sut = makeSut();
      const result = await sut.getAllChains({ page: 1, limit: 0 });
      expect(result.pagination).toBeNull();
    });
  });

  describe("getChainById", () => {
    it("returns chain if found", async () => {
      const chain = { _id: "abc123", name: "Chain A" };
      mockChainRepository.findById.mockResolvedValue(chain);
      const sut = makeSut();
      const result = await sut.getChainById("abc123");
      expect(result).toEqual(chain);
    });

    it("throws NotFoundError if chain does not exist", async () => {
      mockChainRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.getChainById("abc123")).rejects.toThrow(NotFoundError);
    });
  });

  describe("createChain", () => {
    it("throws NotFoundError if image does not exist", async () => {
      mockImageRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(
        sut.createChain({
          name: "Chain A",
          image: "imgId",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("creates and returns chain if image exists", async () => {
      mockImageRepository.findById.mockResolvedValue({ _id: "imgId" });
      const created = { _id: "v1", name: "Chain A" };
      mockChainRepository.create.mockResolvedValue(created);
      const sut = makeSut();
      const result = await sut.createChain({
        name: "Chain A",
        image: "imgId",
      });
      expect(result).toEqual(created);
      expect(mockChainRepository.create).toHaveBeenCalledWith({
        name: "Chain A",
        image: "imgId",
      });
    });
  });

  describe("updateChain", () => {
    it("throws NotFoundError if chain does not exist", async () => {
      mockChainRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(
        sut.updateChain("v1", { name: "New Name" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("updates fields and saves", async () => {
      const chain = {
        _id: "v1",
        name: "Old",
        save: vi.fn(),
      };
      mockChainRepository.findById.mockResolvedValue(chain);
      mockChainRepository.save.mockResolvedValue({ ...chain, name: "New" });
      const sut = makeSut();
      await sut.updateChain("v1", { name: "New" });
      expect(chain.name).toBe("New");
      expect(mockChainRepository.save).toHaveBeenCalledWith(chain);
    });

    it("throws NotFoundError if new image does not exist", async () => {
      const chain = { _id: "v1", name: "Old" };
      mockChainRepository.findById.mockResolvedValue(chain);
      mockImageRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(
        sut.updateChain("v1", { image: "badImgId" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteChain", () => {
    it("throws NotFoundError if chain does not exist", async () => {
      mockChainRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.deleteChain("v1")).rejects.toThrow(NotFoundError);
    });

    it("deletes markets, market products, and chain", async () => {
      const chain = { _id: "v1", name: "Chain A" };
      const markets = [
        { _id: "m1", name: "Market 1" },
        { _id: "m2", name: "Market 2" },
      ];
      mockChainRepository.findById.mockResolvedValue(chain);
      mockMarketRepository.findByChain.mockResolvedValue(markets);
      mockMarketProductRepository.deleteByMarket.mockResolvedValue(null);
      mockMarketRepository.delete.mockResolvedValue(null);
      mockChainRepository.delete.mockResolvedValue(null);
      const sut = makeSut();
      await sut.deleteChain("v1");
      expect(mockMarketRepository.findByChain).toHaveBeenCalledWith("v1");
      expect(mockMarketProductRepository.deleteByMarket).toHaveBeenCalledTimes(2);
      expect(mockMarketRepository.delete).toHaveBeenCalledTimes(2);
      expect(mockChainRepository.delete).toHaveBeenCalledWith(chain);
    });
  });
});
