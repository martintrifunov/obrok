import { describe, it, expect, vi, beforeEach } from "vitest";
import { SuperKitGoScraper } from "./markets/superkitgo.scraper.js";

describe("SuperKitGoScraper", () => {
  let scraper;

  beforeEach(() => {
    scraper = new SuperKitGoScraper();
  });

  describe("chain metadata", () => {
    it("returns correct chain name", () => {
      expect(scraper.chainName).toBe("Super KIT-GO");
    });

    it("returns correct chain image key", () => {
      expect(scraper.chainImageKey).toBe("superkitgo");
    });

    it("returns correct geocode suffix", () => {
      expect(scraper.geocodeSuffix).toBe("Македонија");
    });
  });

  describe("parseUpdateDate with Super Kit-Go format", () => {
    it("parses YYYY-MM-DD HH:mm:ss format from API", () => {
      const result = scraper.parseUpdateDate("2026-04-03 06:08:15");
      expect(result).toEqual(new Date(2026, 3, 3, 6, 8));
    });

    it("parses YYYY-MM-DD HH:mm format without seconds", () => {
      const result = scraper.parseUpdateDate("2026-04-03 06:08");
      expect(result).toEqual(new Date(2026, 3, 3, 6, 8));
    });

    it("parses DD.MM.YYYY HH:mm format from page HTML", () => {
      const result = scraper.parseUpdateDate("03.04.2026 06:08");
      expect(result).toEqual(new Date(2026, 3, 3, 6, 8));
    });

    it("returns null for null input", () => {
      expect(scraper.parseUpdateDate(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(scraper.parseUpdateDate("")).toBeNull();
    });
  });

  describe("fetchProducts with mock fetch", () => {
    const makeApiResponse = (products, pagination, lastUpdate) => ({
      success: true,
      products,
      pagination: { page: 1, per_page: 1000, total: products.length, total_pages: 1, ...pagination },
      last_update: lastUpdate ?? "2026-04-03 06:08:15",
    });

    const makeProduct = (overrides = {}) => ({
      id: 1,
      market_id: 11,
      product_name: "TEST PRODUCT",
      prodazna_cena: "199.00",
      edinecna_cena: "199.00",
      opis: "Test Category",
      dostapnost: "1",
      redovna_cena: "199.00",
      cena_so_popust: "0 (0%)",
      popust_procent: 0,
      akcija_opis: "Nema Akcija",
      vreme_traenje: "NEMA DATUM",
      ...overrides,
    });

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("filters out unavailable products (dostapnost 0)", async () => {
      const apiData = makeApiResponse([
        makeProduct({ product_name: "AVAILABLE", dostapnost: "1", prodazna_cena: "100.00" }),
        makeProduct({ product_name: "UNAVAILABLE", dostapnost: "0", prodazna_cena: "50.00" }),
      ]);

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiData),
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.upToDate).toBe(false);
      expect(result.products).toHaveLength(1);
      expect(result.products[0].title).toBe("AVAILABLE");
    });

    it("keeps products regardless of upper price range", async () => {
      const apiData = makeApiResponse([
        makeProduct({ product_name: "CHEAP", dostapnost: "1", prodazna_cena: "100.00" }),
        makeProduct({ product_name: "EXPENSIVE", dostapnost: "1", prodazna_cena: "999.00" }),
      ]);

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiData),
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.products).toHaveLength(2);
      expect(result.products.map((product) => product.title)).toEqual(["CHEAP", "EXPENSIVE"]);
    });

    it("parses prices with thousands separators", async () => {
      const apiResponse = makeApiResponse([
        makeProduct({ product_name: "OIL 5L", prodazna_cena: "1.299,00" }),
      ]);
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.products[0].price).toBe(1299);
    });

    it("filters out products with zero price", async () => {
      const apiData = makeApiResponse([
        makeProduct({ product_name: "VALID", dostapnost: "1", prodazna_cena: "50.00" }),
        makeProduct({ product_name: "ZERO", dostapnost: "1", prodazna_cena: "0.00" }),
      ]);

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiData),
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.products).toHaveLength(1);
      expect(result.products[0].title).toBe("VALID");
    });

    it("uses category from opis field, defaults to Општо when empty", async () => {
      const apiData = makeApiResponse([
        makeProduct({ product_name: "WITH_CAT", dostapnost: "1", opis: "Dairy Products" }),
        makeProduct({ product_name: "NO_CAT", dostapnost: "1", opis: "" }),
      ]);

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiData),
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.products).toHaveLength(2);
      expect(result.products[0].category).toBe("Dairy Products");
      expect(result.products[1].category).toBe("Општо");
    });

    it("returns upToDate true when update date matches previous", async () => {
      const apiData = makeApiResponse([], {}, "03.04.2026 06:08");
      const previousDate = new Date(2026, 3, 3, 6, 8);

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiData),
      });

      const result = await scraper.fetchProducts(
        null,
        "https://www.superkitgo.mk/table.php?market=market11",
        previousDate,
      );
      expect(result.upToDate).toBe(true);
    });

    it("deduplicates products by title keeping latest", async () => {
      const apiData = makeApiResponse([
        makeProduct({ product_name: "DUPE", dostapnost: "1", prodazna_cena: "100.00" }),
        makeProduct({ product_name: "DUPE", dostapnost: "1", prodazna_cena: "120.00" }),
        makeProduct({ product_name: "UNIQUE", dostapnost: "1", prodazna_cena: "50.00" }),
      ]);

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(apiData),
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.products).toHaveLength(2);
      const dupe = result.products.find((p) => p.title === "DUPE");
      expect(dupe.price).toBe(120); // Latest wins
    });

    it("handles failed API response gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: "Server error" }),
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.upToDate).toBe(false);
      expect(result.products).toHaveLength(0);
    });

    it("paginates through multiple pages", async () => {
      const page1 = makeApiResponse(
        [makeProduct({ product_name: "P1", dostapnost: "1" })],
        { page: 1, total: 2, total_pages: 2 },
      );
      const page2 = makeApiResponse(
        [makeProduct({ product_name: "P2", dostapnost: "1" })],
        { page: 2, total: 2, total_pages: 2 },
      );

      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        callCount++;
        const data = callCount === 1 ? page1 : page2;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
        });
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.products).toHaveLength(2);
      expect(result.products.map((p) => p.title)).toEqual(["P1", "P2"]);
      expect(result.newUpdateDate).toBeInstanceOf(Date);
    });

    it("keeps partial products but withholds the update date when a later page fails", async () => {
      const page1 = makeApiResponse(
        [makeProduct({ product_name: "P1", dostapnost: "1" })],
        { page: 1, total: 2, total_pages: 2 },
      );

      let callCount = 0;
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        callCount++;
        const data = callCount === 1 ? page1 : { success: false };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      });

      const result = await scraper.fetchProducts(null, "https://www.superkitgo.mk/table.php?market=market11", null);
      expect(result.products.map((p) => p.title)).toEqual(["P1"]);
      expect(result.newUpdateDate).toBeUndefined();
    });
  });
});
