import { describe, it, expect } from "vitest";
import { parseSearchQuery, mealCacheKey } from "./query-rules.js";

describe("parseSearchQuery", () => {
  it.each([
    ["najeftin kaskaval", "kaskaval", "asc"],
    ["Најевтино млеко!", "млеко", "asc"],
    ["поевтин сок", "сок", "asc"],
    ["najskapo vino", "vino", "desc"],
    ["најскапото вино", "вино", "desc"],
    ["koj e najeftiniot sok od portokal", "sok od portokal", "asc"],
  ])("reads price intent from %j", (query, searchTerms, priceSort) => {
    expect(parseSearchQuery(query)).toMatchObject({ searchTerms, priceSort });
  });

  it("keeps words that belong to product titles", () => {
    expect(parseSearchQuery("паста за заби")).toMatchObject({
      searchTerms: "паста за заби",
      priceSort: null,
    });
    expect(parseSearchQuery("храна за мачки").searchTerms).toBe("храна за мачки");
  });

  it("embeds Latin queries in Cyrillic and Cyrillic ones as typed", () => {
    expect(parseSearchQuery("sok od portokal").embeddingText).toBe("сок од портокал");
    expect(parseSearchQuery("kaškaval").embeddingText).toBe("кашкавал");
    expect(parseSearchQuery("млеко").embeddingText).toBe("млеко");
  });

  it("falls back to the query when only price words are left", () => {
    expect(parseSearchQuery("najeftino")).toMatchObject({ searchTerms: "najeftino", priceSort: "asc" });
  });
});

describe("mealCacheKey", () => {
  it("shares a key across case, punctuation and script", () => {
    expect(mealCacheKey("Palačinki!")).toBe(mealCacheKey("палачинки"));
    expect(mealCacheKey("  Pasta  so sirenje ")).toBe(mealCacheKey("паста со сирење"));
  });
});
