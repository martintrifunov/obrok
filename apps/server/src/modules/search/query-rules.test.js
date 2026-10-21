import { describe, it, expect } from "vitest";
import { parseSearchQuery, mealCacheKey, buildVariantMatcher } from "./query-rules.js";

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

describe("buildVariantMatcher", () => {
  it.each([
    "МЛЕКО ЧОКОЛАДНО 0.2Л АЛПСКО",
    "МЛЕКО ЧОК . БЕЛЛА ФАРМ 200 МЛ",
    "MLEKO ^OKOLADNO 250ML IMLEK",
    "MLEKO MOJA KRAVICA 250ML ^OKO KOKO",
    "МЛЕКО МОЈА КРАВИЦА МИЛК ШЕЈК ЈАГОДА 0.235Л",
    "МЛЕКО ЗА КАФЕ 10% 10х10гр.",
  ])("treats %j as a variant of milk", (title) => {
    expect(buildVariantMatcher("mleko")(title)).toBe(true);
  });

  it.each(["МЛЕКО 3.5% 0.2Л АЛПСКО", "MLEKO 1L ZBREGOV 2.8% SO ^EP", "МЛЕКО БЕЗ ЛАКТОЗА 1.5% 1Л"])(
    "keeps plain milk %j",
    (title) => {
      expect(buildVariantMatcher("млеко")(title)).toBe(false);
    },
  );

  it("keeps the variant the query asks for", () => {
    expect(buildVariantMatcher("чоколадно млеко")("МЛЕКО ЧОКОЛАДНО 0.2Л АЛПСКО")).toBe(false);
  });

  it("leaves flavours alone for products they don't change", () => {
    expect(buildVariantMatcher("кекс")("КЕКС СЕНДВИЧ ВАНИЛА ПОЛНЕЊЕ МИЛОРД 176 Г")).toBe(false);
    expect(buildVariantMatcher("chokolada")("ЧОКОЛАДА ДОРИНА ЛЕШНИК 80ГР")).toBe(false);
  });

  it("treats things made for the product as accessories", () => {
    expect(buildVariantMatcher("jajca")("DEKORATIVNI NAVLAKI ZA JAJCA 1/8 KOLORKO")).toBe(true);
    expect(buildVariantMatcher("масло")("ШИШЕ СТАКЛЕНО 1л ЗА МАСЛО")).toBe(true);
    expect(buildVariantMatcher("jajca")("JAJCA \"L\" 6/1")).toBe(false);
  });

  it("doesn't take a purpose the query names for an accessory", () => {
    expect(buildVariantMatcher("масло за готвење")("МАСЛО ЗА ГОТВЕЊЕ 1Л")).toBe(false);
  });
});
