import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartSearchService, pickIngredientCandidates } from "./smart-search.service.js";

const market = { _id: "m1", name: "Vero", location: [42.0, 21.4] };

const makeResult = (title, price) => ({
  product: { _id: title, title },
  marketProducts: [{ market, price }],
});

describe("SmartSearchService", () => {
  let intentParserService;
  let searchService;
  let featureFlagService;
  let publicHolidayService;
  let sut;

  beforeEach(() => {
    intentParserService = {
      isAvailable: vi.fn().mockReturnValue(true),
      parseIntent: vi.fn().mockResolvedValue({
        intent: "recipe",
        products: ["брашно", "млеко"],
        searchTerms: "палачинки",
        priceSort: "asc",
      }),
    };
    searchService = {
      search: vi.fn(),
      searchProducts: vi.fn(async ({ q }) => ({
        data: [makeResult(q === "брашно" ? "Брашно 1кг" : "Млеко 1л", q === "брашно" ? 60 : 70)],
      })),
    };
    // Only smart-search is on: it must not depend on the ai-search flag.
    featureFlagService = { isEnabled: vi.fn(async (key) => key === "smart-search") };
    publicHolidayService = { getHolidaysByDateRange: vi.fn().mockResolvedValue([]) };
    sut = new SmartSearchService(
      intentParserService,
      searchService,
      featureFlagService,
      publicHolidayService,
    );
  });

  it("searches ingredients without the ai-search gate or a second intent parse", async () => {
    const result = await sut.search({ q: "палачинки" });

    expect(searchService.search).not.toHaveBeenCalled();
    expect(searchService.searchProducts).toHaveBeenCalledTimes(2);
    for (const [args] of searchService.searchProducts.mock.calls) {
      expect(args.parseIntent).toBe(false);
    }
    expect(intentParserService.parseIntent).toHaveBeenCalledTimes(1);
    expect(result.data.shoppingList).toEqual([
      { name: "брашно", found: true },
      { name: "млеко", found: true },
    ]);
    expect(result.data.markets[0]).toMatchObject({ complete: true, totalPrice: 130 });
  });

  it("queries holidays with UTC bounds covering all of Saturday", async () => {
    await sut.getBudget();

    const [from, to] = publicHolidayService.getHolidaysByDateRange.mock.calls[0];
    expect(from.getUTCHours()).toBe(0);
    expect(to.getUTCHours()).toBe(23);
    expect(Math.round((to - from) / 86_400_000)).toBe(6);
  });

  describe("ingredient matching", () => {
    const vero = { _id: "m1", name: "Vero", location: [42.0, 21.4] };
    const offer = (title, price, market = vero) => ({
      product: { _id: title, title },
      marketProducts: [{ market, price }],
    });

    const runWith = async (products, resultsByIngredient) => {
      intentParserService.parseIntent.mockResolvedValue({
        intent: "recipe",
        products,
        searchTerms: products.join(" "),
        priceSort: "asc",
      });
      searchService.searchProducts.mockImplementation(async ({ q }) => ({
        data: resultsByIngredient[q] || [],
      }));
      return sut.search({ q: "meal" });
    };

    it("prices salt with salt, not cheaper salted sticks", async () => {
      const result = await runWith(["сол"], {
        сол: [offer("Солети стапчиња", 25), offer("Сол морска 1кг", 40)],
      });

      expect(result.data.markets[0].products).toEqual([
        expect.objectContaining({ name: "сол", title: "Сол морска 1кг", price: 40 }),
      ]);
    });

    it("does not treat 'без шеќер' (sugar-free) as sugar", async () => {
      const result = await runWith(["шеќер"], {
        шеќер: [offer("Бонбони без шеќер", 30), offer("Шеќер кристал 1кг", 55)],
      });

      expect(result.data.markets[0].products[0]).toMatchObject({ title: "Шеќер кристал 1кг" });
    });

    it("matches Latin titles for Cyrillic ingredients", async () => {
      const result = await runWith(["кашкавал"], {
        кашкавал: [offer("KASKAVAL BITOLA 400g", 300)],
      });

      expect(result.data.shoppingList[0].found).toBe(true);
      expect(result.data.markets[0].products[0]).toMatchObject({ price: 300 });
    });

    it("falls back to the best-ranked result, not the cheapest, without a word match", async () => {
      const picked = pickIngredientCandidates("путер", [
        { product: { title: "Маслен намаз" }, marketProducts: [] },
        { product: { title: "Маргарин" }, marketProducts: [] },
      ]);
      expect(picked.strict).toBe(false);

      const result = await runWith(["путер"], {
        путер: [offer("Маслен намаз 250г", 120), offer("Маргарин 250г", 60)],
      });
      expect(result.data.markets[0].products[0]).toMatchObject({ title: "Маслен намаз 250г" });
    });

    it("reports an ingredient as not found when no market sells a match", async () => {
      const result = await runWith(["шафран"], {
        шафран: [{ product: { _id: "x", title: "Шафран" }, marketProducts: [] }],
      });

      expect(result.data.shoppingList).toEqual([{ name: "шафран", found: false }]);
    });
  });
});
