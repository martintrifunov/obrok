import { describe, it, expect } from "vitest";
import { BaseScraper } from "./markets/base.scraper.js";

describe("BaseScraper", () => {
  describe("parseUpdateDate", () => {
    const scraper = new (class extends BaseScraper {
      get chainName() { return "Test"; }
      get chainImageKey() { return "test"; }
      async fetchMarkets() { return []; }
      async fetchProducts() { return { upToDate: false, products: [] }; }
    })();

    it("parses DD.MM.YYYY HH:mm format", () => {
      const result = scraper.parseUpdateDate("28.03.2026 14:30");
      expect(result).toEqual(new Date(2026, 2, 28, 14, 30));
    });

    it("parses DD/MM/YYYY HH:mm format", () => {
      const result = scraper.parseUpdateDate("15/01/2026 09:00");
      expect(result).toEqual(new Date(2026, 0, 15, 9, 0));
    });

    it("handles PM time correctly", () => {
      const result = scraper.parseUpdateDate("28.03.2026 2:30 PM");
      expect(result).toEqual(new Date(2026, 2, 28, 14, 30));
    });

    it("handles AM time correctly", () => {
      const result = scraper.parseUpdateDate("28.03.2026 9:15 AM");
      expect(result).toEqual(new Date(2026, 2, 28, 9, 15));
    });

    it("handles 12 PM as noon", () => {
      const result = scraper.parseUpdateDate("01.06.2026 12:00 PM");
      expect(result).toEqual(new Date(2026, 5, 1, 12, 0));
    });

    it("keeps PM when the time has seconds", () => {
      const result = scraper.parseUpdateDate("12.03.2026 9:30:15 PM");
      expect(result).toEqual(new Date(2026, 2, 12, 21, 30, 15));
    });

    it("parses seconds without AM/PM", () => {
      const result = scraper.parseUpdateDate("12.03.2026 21:30:15");
      expect(result).toEqual(new Date(2026, 2, 12, 21, 30, 15));
    });

    it("tells a morning and evening pricelist on the same day apart", () => {
      const am = scraper.parseUpdateDate("12.03.2026 9:30:15 AM");
      const pm = scraper.parseUpdateDate("12.03.2026 9:30:15 PM");
      expect(am.getTime()).not.toBe(pm.getTime());
    });

    it("handles 12 AM as midnight", () => {
      const result = scraper.parseUpdateDate("01.06.2026 12:00 AM");
      expect(result).toEqual(new Date(2026, 5, 1, 0, 0));
    });

    it("returns null for null input", () => {
      expect(scraper.parseUpdateDate(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(scraper.parseUpdateDate("")).toBeNull();
    });

    it("returns null for non-date string", () => {
      expect(scraper.parseUpdateDate("not a date")).toBeNull();
    });

    it("parses date with surrounding text", () => {
      const result = scraper.parseUpdateDate(
        "Последно ажурирање: 28.03.2026 14:30 some trailing text",
      );
      expect(result).toEqual(new Date(2026, 2, 28, 14, 30));
    });

    it("handles single-digit day and month", () => {
      const result = scraper.parseUpdateDate("5.3.2026 8:05");
      expect(result).toEqual(new Date(2026, 2, 5, 8, 5));
    });
  });

  describe("deduplicateByName", () => {
    it("removes duplicates keeping first occurrence", () => {
      const entries = [
        { name: "ВЕРО 1", url: "a" },
        { name: "ВЕРО 2", url: "b" },
        { name: "ВЕРО 1", url: "c" },
      ];
      const result = BaseScraper.deduplicateByName(entries);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "ВЕРО 1", url: "a" });
      expect(result[1]).toEqual({ name: "ВЕРО 2", url: "b" });
    });

    it("returns empty array for empty input", () => {
      expect(BaseScraper.deduplicateByName([])).toEqual([]);
    });

    it("returns same array when no duplicates", () => {
      const entries = [{ name: "A" }, { name: "B" }, { name: "C" }];
      expect(BaseScraper.deduplicateByName(entries)).toEqual(entries);
    });
  });
});
