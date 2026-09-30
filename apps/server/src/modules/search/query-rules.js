import { transliterateLatinToCyrillic } from "../../shared/utils/bilingualRegex.js";

// Stems in Cyrillic and Latin, with the е/ef spellings people actually type.
const CHEAP = /^(нај|naj|по|po)?(евтин|ефтин|evtin|eftin)\p{L}*$|^(cheap\p{L}*|budget)$/u;
const EXPENSIVE = /^(нај|naj|по|po)?(скап|skap)\p{L}*$|^(expensive|luxury|premium)$/u;

// Words that carry no product meaning in a grocery query.
const FILLER = new Set([
  "кој", "која", "кое", "кои", "koj", "koja", "koe", "koi",
  "каде", "kade", "најди", "najdi", "барам", "baram", "сакам", "sakam",
  "има", "ima", "ли", "li", "ми", "mi", "е", "e",
]);

const CYRILLIC = /\p{Script=Cyrillic}/u;

/**
 * @param {string} query
 * @returns {{ searchTerms: string, embeddingText: string, priceSort: "asc" | "desc" | null }}
 */
export const parseSearchQuery = (query) => {
  const tokens = (query || "").normalize("NFC").trim().split(/\s+/).filter(Boolean);

  let priceSort = null;
  const kept = [];
  for (const token of tokens) {
    const word = token.toLowerCase().replace(/[^\p{L}\p{N}%.,-]/gu, "");
    if (CHEAP.test(word)) priceSort = "asc";
    else if (EXPENSIVE.test(word)) priceSort = "desc";
    else if (word && !FILLER.has(word)) kept.push(word);
  }

  const searchTerms = kept.length ? kept.join(" ") : (query || "").trim();
  const embeddingText = !CYRILLIC.test(searchTerms)
    ? transliterateLatinToCyrillic(searchTerms)
    : searchTerms;

  return { searchTerms, embeddingText, priceSort };
};

/**
 * Cache key shared by Latin and Cyrillic spellings of the same meal.
 * @param {string} query
 */
export const mealCacheKey = (query) =>
  transliterateLatinToCyrillic(
    (query || "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim(),
  );
