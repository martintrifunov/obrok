import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartSearchService } from "./smart-search.service.js";

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
});
