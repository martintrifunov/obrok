import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SmartSearchService,
  pickIngredientCandidates,
  limitPerChain,
  usualPackSize,
  cheapestSensiblePack,
} from "./smart-search.service.js";

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

  describe("with vector search", () => {
    it("prices an ingredient with the vector candidates, cheapest per market", async () => {
      intentParserService.parseIntent.mockResolvedValue({
        intent: "recipe",
        products: ["тестенини"],
        priceSort: "asc",
      });
      searchService.findIngredientCandidates = vi.fn(async () => [
        makeResult("Фусили 500г", 90),
        makeResult("Шпагети 500г", 70),
      ]);

      const result = await sut.search({ q: "паста" });

      expect(searchService.searchProducts).not.toHaveBeenCalled();
      expect(result.data.markets[0].products[0]).toMatchObject({ title: "Шпагети 500г", price: 70 });
    });

    it("lets only a store's closest matches compete on price", async () => {
      intentParserService.parseIntent.mockResolvedValue({
        intent: "recipe",
        products: ["бело сирење"],
        priceSort: "asc",
      });
      searchService.findIngredientCandidates = vi.fn(async () => [
        { ...makeResult("Бело сирење кравјо 1кг", 390), score: 0.82 },
        { ...makeResult("Посен намаз бело 200г", 119), score: 0.8 },
      ]);

      const result = await sut.search({ q: "сирење" });

      expect(result.data.markets[0].products[0]).toMatchObject({ title: "Бело сирење кравјо 1кг" });
    });

    it("falls back to word matching when vector search is unavailable", async () => {
      searchService.findIngredientCandidates = vi.fn(async () => null);

      await sut.search({ q: "палачинки" });

      expect(searchService.searchProducts).toHaveBeenCalledTimes(2);
    });
  });
});

describe("limitPerChain", () => {
  it("keeps at most three stores per chain, in order", () => {
    const store = (id, chain) => ({ market: { _id: id, chain: { _id: chain } } });
    const markets = [
      store("v1", "vero"), store("v2", "vero"), store("k1", "kam"),
      store("v3", "vero"), store("v4", "vero"), store("k2", "kam"),
    ];

    expect(limitPerChain(markets).map((m) => m.market._id)).toEqual(["v1", "v2", "k1", "v3", "k2"]);
  });
});

describe("pack sizes", () => {
  const option = (title, price) => ({ product: { title }, price });

  it("finds the usual pack in the most common unit", () => {
    const usual = usualPackSize(
      ["МЛЕКО 1Л", "МЛЕКО 1 Л", "МЛЕКО 0.5Л", "МЛЕКО ЗА КАФЕ 10х10гр.", "МЛЕКО 1L", "МЛЕКО РЕФУС КГ"].map((title) => ({
        product: { title },
      })),
    );

    expect(usual).toEqual({ amount: 1000, unit: "ml" });
  });

  it("has no usual pack when few titles carry a size", () => {
    expect(usualPackSize([{ product: { title: "КОМПИР КГ" } }, { product: { title: "КОМПИР МЛАД" } }])).toBeNull();
  });

  it("ignores the few sized odd ones among unsized products", () => {
    const titles = ["БОЈА ЗА ЈАЈЦА 6 ГР", "БОЈА ЗА ЈАЈЦА 5 ГР", "ЧОКОЛАДНИ ЈАЈЦА 120 ГР"];
    for (let i = 0; i < 10; i++) titles.push(`ЈАЈЦА М 10/1 ФАРМА ${i}`);

    expect(usualPackSize(titles.map((title) => ({ product: { title } })))).toBeNull();
  });

  it("prices loose produce per kilogram against bagged packs", () => {
    const picked = cheapestSensiblePack(
      [option("КОМПИР МРЕЖА 2КГ", 90), option("КОМПИР 1КГ ПАКУВАН", 50), option("КОМПИР МЛАД КГ", 40)],
      { amount: 1000, unit: "g" },
    );

    expect(picked.product.title).toBe("КОМПИР МЛАД КГ");
  });

  it("prices milk with a carton, not cheaper coffee creamer portions", () => {
    const picked = cheapestSensiblePack(
      [option("МЛЕКО СВЕЖО 3.2% 1 Л", 71), option("МЛЕКО ЗА КАФЕ 10% 10х10гр.", 45), option("МЛЕКО 0.5Л", 40)],
      { amount: 1000, unit: "ml" },
    );

    expect(picked.product.title).toBe("МЛЕКО СВЕЖО 3.2% 1 Л");
  });

  it("compares normal packs per kilogram, skipping bulk and tiny ones", () => {
    const picked = cheapestSensiblePack(
      [
        option("КАШКАВАЛ ДИМЕН 300ГР", 169),
        option("КАШКАВАЛ ОВЧИ МЛАД 350гр.", 219),
        option("КАШКАВАЛ ТОСТ 100ГР", 77),
        option("КАШКАВАЛ КРАВЈИ кгр МИЛКАНО", 419),
      ],
      { amount: 400, unit: "g" },
    );

    expect(picked.product.title).toBe("КАШКАВАЛ ДИМЕН 300ГР");
  });

  it("falls back to package price when no option has a comparable size", () => {
    const picked = cheapestSensiblePack(
      [option("ЈАЈЦА 10/1", 99), option("ЈАЈЦА ОД", 92)],
      { amount: 400, unit: "g" },
    );

    expect(picked.product.title).toBe("ЈАЈЦА ОД");
  });
});
