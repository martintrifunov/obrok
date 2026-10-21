// Pack sizes as written in product titles: "500ГР", "0,75Л", "1 ЛИТ", "250ML",
// "6Х0.5Л", and a bare "КГ" for goods sold by weight.

/** @type {{ pattern: string, unit: "g" | "ml", factor: number }[]} */
const UNITS = [
  { pattern: "кгр|кг|kgr|kg", unit: "g", factor: 1000 },
  { pattern: "гр|г|gr|g", unit: "g", factor: 1 },
  { pattern: "мл|ml", unit: "ml", factor: 1 },
  { pattern: "лит|л|lit|l", unit: "ml", factor: 1000 },
];
const UNIT_ALTERNATION = UNITS.map((u) => u.pattern).join("|");
// A unit must end the word: "500ГР." or "1Л" but not the "Л" in "1ЛЕБ".
const END = "(?![\\p{L}])";
const NUMBER = "(\\d+(?:[.,]\\d+)?)";

const MULTIPACK = new RegExp(`(\\d+)\\s*[xх*]\\s*${NUMBER}\\s*(${UNIT_ALTERNATION})\\.?${END}`, "iu");
const SINGLE = new RegExp(`${NUMBER}\\s*(${UNIT_ALTERNATION})\\.?${END}`, "giu");
const BY_WEIGHT = new RegExp(`(^|[\\s/])(кгр|кг|kgr|kg)\\.?${END}`, "iu");

const unitOf = (text) => {
  const lower = text.toLowerCase();
  return UNITS.find((u) => new RegExp(`^(?:${u.pattern})$`, "u").test(lower));
};

const toNumber = (text) => Number(text.replace(",", "."));

/**
 * @param {string} title
 * @returns {{ amount: number, unit: "g" | "ml", byWeight: boolean } | null}
 *   amount in grams or millilitres; byWeight when the price is per kilogram
 */
export const parsePackSize = (title) => {
  const text = (title || "").normalize("NFC");

  const multi = text.match(MULTIPACK);
  if (multi) {
    const unit = unitOf(multi[3]);
    const amount = Number(multi[1]) * toNumber(multi[2]) * unit.factor;
    if (amount > 0) return { amount, unit: unit.unit, byWeight: false };
  }

  // The last size wins: "МЛЕКО 3.2% 1Л" or "ЛЕБ 500Г 2 ПАРЧИЊА".
  const sizes = [...text.matchAll(SINGLE)];
  const last = sizes.at(-1);
  if (last) {
    const unit = unitOf(last[2]);
    const amount = toNumber(last[1]) * unit.factor;
    if (amount > 0) return { amount, unit: unit.unit, byWeight: false };
  }

  if (BY_WEIGHT.test(text)) return { amount: 1000, unit: "g", byWeight: true };
  return null;
};
