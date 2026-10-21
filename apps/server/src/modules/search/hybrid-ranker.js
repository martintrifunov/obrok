import { buildBilingualRegex, buildWordStartMatcher } from "../../shared/utils/bilingualRegex.js";

const KEYWORD_WEIGHT = 0.6;
const VECTOR_WEIGHT = 0.4;
// Vector hits this far below the best one are the unrelated tail.
const VECTOR_WINDOW = 0.1;
const MIN_SCORE = 0.2;
// Price sorting only reorders results at least this close to the best one.
const STRONG_SHARE = 0.8;

/**
 * Scores keyword matches by how well the title names the query.
 * @param {string} searchTerms
 */
export const buildKeywordScorer = (searchTerms) => {
  const phrase = buildBilingualRegex(searchTerms.trim());
  // A short inflected ending is fine ("МЛЕКОТО"); a longer word isn't ("МЛЕКОВИТА").
  const startsWith = phrase ? new RegExp(`^(?:${phrase})\\p{L}{0,2}(?!\\p{L})`, "iu") : null;
  const allWords = buildWordStartMatcher(searchTerms);

  /** @param {{ title?: string, category?: string }} product */
  return ({ title = "" }) => {
    const normalized = title.normalize("NFC").trim();
    if (startsWith?.test(normalized)) return 1;
    if (allWords(normalized)) return 0.8;
    // Matched as a substring, or only through the category.
    return 0.4;
  };
};

/**
 * @param {{ productId: string, score: number }[]} vectorHits cosine similarity, best first
 * @param {{ productId: string, score: number }[]} keywordHits keyword score in [0, 1]
 * @returns {{ productId: string, score: number }[]} best first
 */
export const fuseResults = (vectorHits, keywordHits) => {
  const scores = new Map();

  const top = vectorHits.reduce((best, h) => Math.max(best, h.score), -Infinity);
  const floor = top - VECTOR_WINDOW;
  for (const { productId, score } of vectorHits) {
    if (score < floor) continue;
    const relative = (score - floor) / VECTOR_WINDOW;
    scores.set(productId, VECTOR_WEIGHT * relative);
  }
  for (const { productId, score } of keywordHits) {
    scores.set(productId, (scores.get(productId) || 0) + KEYWORD_WEIGHT * score);
  }

  return [...scores.entries()]
    .map(([productId, score]) => ({ productId, score }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
};

/**
 * Sorts strong matches by price and keeps weaker ones after them, so "cheapest
 * milk" isn't led by a chocolate bar that mentions milk. Variants and accessories
 * (chocolate milk, egg dye) join the weaker ones too.
 * @template {{ score: number }} T
 * @param {T[]} results best first
 * @param {(result: T) => number} priceKey lower comes first
 * @param {(result: T) => boolean} [isVariant]
 * @returns {T[]}
 */
export const sortStrongByPrice = (results, priceKey, isVariant = () => false) => {
  if (!results.length) return results;
  const threshold = results[0].score * STRONG_SHARE;
  const strong = [];
  const rest = [];
  for (const r of results) (r.score >= threshold && !isVariant(r) ? strong : rest).push(r);
  return [...strong.sort((a, b) => priceKey(a) - priceKey(b)), ...rest];
};
