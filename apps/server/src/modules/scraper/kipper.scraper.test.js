import { beforeEach, describe, expect, it, vi } from "vitest";
import { KipperScraper } from "./markets/kipper.scraper.js";

describe("KipperScraper", () => {
  let scraper;

  beforeEach(() => {
    scraper = new KipperScraper();
  });

  it("returns correct chain metadata", () => {
    expect(scraper.chainName).toBe("Kipper");
    expect(scraper.chainImageKey).toBe("kipper");
    expect(scraper.geocodeSuffix).toBe("Македонија");
  });

  it("collects market details from market pages", async () => {
    const goto = vi.fn().mockResolvedValue(undefined);
    const waitForFunction = vi.fn().mockResolvedValue(undefined);
    const evaluate = vi.fn()
      .mockResolvedValueOnce(2)    // currentLinkCount
      .mockResolvedValueOnce(false) // clicked (breaks loop)
      .mockResolvedValueOnce([     // indexEntries from index page
        { name: "Киппер 163 - Тетово", url: "https://kipper.mk/mk/kipper-163-tetove/" },
        { name: "Киппер 162 - Свети Николе", url: "https://kipper.mk/mk/kipper-162-sveti-nikole/" },
      ])
      .mockResolvedValueOnce("Киро Ристоски бр.1 Тетово, Тетово")  // address for market 1
      .mockResolvedValueOnce("Маршал Тито бр.5, Свети Николе");     // address for market 2

    const page = { goto, waitForFunction, evaluate, setUserAgent: vi.fn(), setExtraHTTPHeaders: vi.fn(), url: vi.fn().mockReturnValue("https://kipper.mk/mk/marketet/") };

    const markets = await scraper.fetchMarkets(page);

    expect(markets).toEqual([
      {
        name: "Киппер 163 - Тетово",
        address: "Киро Ристоски бр.1 Тетово, Тетово",
        pricelistUrl: "https://kipper.mk/mk/kipper-163-tetove/",
      },
      {
        name: "Киппер 162 - Свети Николе",
        address: "Маршал Тито бр.5, Свети Николе",
        pricelistUrl: "https://kipper.mk/mk/kipper-162-sveti-nikole/",
      },
    ]);
  });

  it("returns upToDate when the detail page update date matches", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)  // Cloudflare Rocket Loader decode
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce("4 April 2026 - 13:21"),
      setUserAgent: vi.fn(),
      setExtraHTTPHeaders: vi.fn(),
      evaluateOnNewDocument: vi.fn(),
      setCookie: vi.fn(),
      url: vi.fn().mockReturnValue("https://kipper.mk/mk/kipper-163-tetove/"),
    };

    const result = await scraper.fetchProducts(
      page,
      "https://kipper.mk/mk/kipper-163-tetove/",
      new Date(2026, 3, 4, 13, 21),
    );

    expect(result).toEqual({ upToDate: true });
  });

  it("parses month-name update date format used by Kipper pages", () => {
    const result = scraper.parseUpdateDate("4 April 2026 - 13:21");
    expect(result).toEqual(new Date(2026, 3, 4, 13, 21));
  });

  it("keeps fallback parsing for DD.MM.YYYY HH:mm format", () => {
    const result = scraper.parseUpdateDate("03.04.2026 06:08");
    expect(result).toEqual(new Date(2026, 3, 3, 6, 8));
  });

  it("keeps available products including high-priced ones", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)  // Cloudflare Rocket Loader decode
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce("03.04.2026 06:08")
        .mockResolvedValueOnce([
          { title: "STANDARD", priceText: "120,00 ден", category: "Општо" },
          { title: "PREMIUM", priceText: "1.599,00 ден", category: "Специјално" },
          { title: "PREMIUM", priceText: "1.699,00 ден", category: "Специјално" },
        ]),
      setUserAgent: vi.fn(),
      setExtraHTTPHeaders: vi.fn(),
      evaluateOnNewDocument: vi.fn(),
      setCookie: vi.fn(),
      url: vi.fn().mockReturnValue("https://kipper.mk/mk/kipper-163-tetove/"),
    };

    const result = await scraper.fetchProducts(
      page,
      "https://kipper.mk/mk/kipper-163-tetove/",
      null,
    );

    expect(result.upToDate).toBe(false);
    expect(result.products).toEqual([
      { title: "STANDARD", price: 120, category: "Општо" },
      { title: "PREMIUM", price: 1699, category: "Специјално" },
    ]);
    expect(result.newUpdateDate).toEqual(new Date(2026, 3, 3, 6, 8));
  });
});