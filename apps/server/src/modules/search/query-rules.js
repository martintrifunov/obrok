import { transliterateLatinToCyrillic } from "../../shared/utils/bilingualRegex.js";

// Stems in Cyrillic and Latin, with the е/ef spellings people actually type.
const CHEAP = /^(нај|naj|по|po)?(евтин|ефтин|evtin|eftin)\p{L}*$|^(cheap\p{L}*|budget)$/u;
const EXPENSIVE = /^(нај|naj|по|po)?(скап|skap)\p{L}*$|^(expensive|luxury|premium)$/u;

// Words that carry no product meaning in a grocery query.
const FILLER = new Set([
  "кој", "која", "кое", "кои", "koj", "koja", "koe", "koi",
  "каде", "kade", "најди", "najdi", "барам", "baram", "сакам", "sakam",
  "има", "ima", "ли", "li", "ми", "mi", "е", "e",
  // "нај евтино" typed as two words.
  "нај", "naj",
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

// Variants that are a different product than the plain one, by the product the
// query names: chocolate milk or coffee creamer isn't what "cheapest milk" means.
// Matched on the Cyrillic spelling; "^" is Č in one chain's titles.
const VARIANTS = [
  {
    product: /(?<!\p{L})млек/u,
    variants: ["(?<!\\p{L})[ч^]ок(?:о|(?!\\p{L}))", "какао", "ванил", "јагод", "банан", "лешник", "шејк", "за кафе"],
  },
];

/**
 * Whether a title is a variant of what the query names (chocolate milk for
 * milk) or an accessory for it ("БОЈА ЗА ЈАЈЦА" for eggs). Variants the query
 * asks for ("чоколадно млеко") don't count.
 * @param {string} searchTerms
 * @returns {(title: string) => boolean}
 */
export const buildVariantMatcher = (searchTerms) => {
  const query = transliterateLatinToCyrillic(searchTerms);
  const variants = VARIANTS.filter((v) => v.product.test(query))
    .flatMap((v) => v.variants)
    .filter((v) => !new RegExp(v, "u").test(query));
  // "масло за готвење" names a purpose itself; "за готвење" in a title is no accessory then.
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter((w, i, all) => w.length >= 3 && all[i - 1] !== "за");
  const parts = [...variants, ...words.map((w) => `(?<!\\p{L})за ${w}`)];
  if (!parts.length) return () => false;
  const variant = new RegExp(parts.join("|"), "u");
  return (title) => variant.test(transliterateLatinToCyrillic(title || ""));
};

/**
 * Cache key shared by Latin and Cyrillic spellings of the same meal.
 * @param {string} query
 */
export const mealCacheKey = (query) =>
  transliterateLatinToCyrillic(
    (query || "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim(),
  );
