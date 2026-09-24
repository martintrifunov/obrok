import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketService } from "./market.service.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";

const marketRepository = { findById: vi.fn(), delete: vi.fn() };
const marketProductRepository = {
  findProductIdsByMarket: vi.fn(),
  deleteByMarket: vi.fn(),
};
const orphanProductService = { removeOrphans: vi.fn() };

const makeSut = () =>
  new MarketService(marketRepository, {}, marketProductRepository, orphanProductService);

beforeEach(() => vi.clearAllMocks());

describe("MarketService.deleteMarket", () => {
  it("throws NotFoundError for an unknown market", async () => {
    marketRepository.findById.mockResolvedValue(null);
    await expect(makeSut().deleteMarket("m1")).rejects.toThrow(NotFoundError);
    expect(marketProductRepository.deleteByMarket).not.toHaveBeenCalled();
  });

  it("removes products left without prices after deleting the market's rows", async () => {
    const market = { _id: "m1" };
    marketRepository.findById.mockResolvedValue(market);
    marketProductRepository.findProductIdsByMarket.mockResolvedValue(["p1", "p2"]);
    const order = [];
    marketProductRepository.deleteByMarket.mockImplementation(async () => order.push("rows"));
    marketRepository.delete.mockImplementation(async () => order.push("market"));
    orphanProductService.removeOrphans.mockImplementation(async () => order.push("orphans"));

    await makeSut().deleteMarket("m1");

    expect(orphanProductService.removeOrphans).toHaveBeenCalledWith(["p1", "p2"]);
    expect(order).toEqual(["rows", "market", "orphans"]);
  });

  it("still deletes when no orphan service is wired", async () => {
    marketRepository.findById.mockResolvedValue({ _id: "m1" });
    marketProductRepository.findProductIdsByMarket.mockResolvedValue([]);
    const sut = new MarketService(marketRepository, {}, marketProductRepository);

    await sut.deleteMarket("m1");

    expect(marketRepository.delete).toHaveBeenCalled();
  });
});
