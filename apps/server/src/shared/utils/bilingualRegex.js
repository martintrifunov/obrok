// Order matters: longer sequences must be replaced before their parts.
const latToCyrMap = {
  dzh: "џ",
  dž: "џ",
  nj: "њ",
  lj: "љ",
  dz: "ѕ",
  zh: "ж",
  sh: "ш",
  ch: "ч",
  gj: "ѓ",
  kj: "ќ",
  // Macedonian (and neighbouring) Latin letters with diacritics
  š: "ш",
  č: "ч",
  ć: "ќ",
  ž: "ж",
  ǵ: "ѓ",
  ģ: "ѓ",
  đ: "ѓ",
  ḱ: "ќ",
  a: "а",
  b: "б",
  c: "ц",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "ј",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "к",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "в",
  x: "кс",
  y: "и",
  z: "з",
};

// Diacritic letters written the way product titles commonly spell them:
// ASCII-folded ("kaskaval") and with digraphs ("kashkaval").
const FOLDED = {
  dž: "dz",
  š: "s",
  č: "c",
  ć: "c",
  ž: "z",
  ǵ: "g",
  ģ: "g",
  đ: "d",
  ḱ: "k",
};
const DIGRAPH = {
  dž: "dzh",
  š: "sh",
  č: "ch",
  ć: "kj",
  ž: "zh",
  ǵ: "gj",
  ģ: "gj",
  đ: "gj",
  ḱ: "kj",
};

const DIACRITIC_RE = /dž|[ščćžǵģđḱ]/g;

// Cyrillic to the two common Latin spellings in titles: digraphs ("kashkaval")
// and ASCII-folded ("kaskaval"). Letters with a single spelling are plain strings.
const CYR_TO_LAT = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: ["zh", "z"],
  з: "z",
  ѕ: "dz",
  и: "i",
  ј: "j",
  к: "k",
  л: "l",
  љ: "lj",
  м: "m",
  н: "n",
  њ: "nj",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: ["ch", "c"],
  ш: ["sh", "s"],
  ѓ: ["gj", "g"],
  ќ: ["kj", "k"],
  џ: ["dzh", "dz"],
};
const CYRILLIC_RE = /[\u0400-\u04FF]/;

const transliterateCyrillicToLatin = (text, variant) =>
  [...text]
    .map((ch) => {
      const lat = CYR_TO_LAT[ch];
      if (lat === undefined) return ch;
      return Array.isArray(lat) ? lat[variant] : lat;
    })
    .join("");

export const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalize = (text) => text.normalize("NFC").toLowerCase();

const transliterateLatinToCyrillic = (text) => {
  let cyrStr = normalize(text);
  for (const [lat, cyr] of Object.entries(latToCyrMap)) {
    cyrStr = cyrStr.split(lat).join(cyr);
  }
  return cyrStr;
};

/**
 * @param {string} text
 * @returns {string[]}
 */
const spellingVariants = (text) => {
  const variants = [text];
  const lower = normalize(text);
  if (DIACRITIC_RE.test(lower)) {
    variants.push(lower.replace(DIACRITIC_RE, (ch) => FOLDED[ch]));
    variants.push(lower.replace(DIACRITIC_RE, (ch) => DIGRAPH[ch]));
  }
  DIACRITIC_RE.lastIndex = 0;
  variants.push(transliterateLatinToCyrillic(text));
  if (CYRILLIC_RE.test(lower)) {
    variants.push(transliterateCyrillicToLatin(lower, 0));
    variants.push(transliterateCyrillicToLatin(lower, 1));
  }
  return [...new Set(variants)];
};

// Plain ASCII input is ambiguous: "kaskaval" may be a folded "kaškaval" (кашкавал).
// Each lossy letter matches every letter it could stand for, in both scripts.
const ASCII_RE = /^\p{ASCII}*$/u;
const LATIN_AMBIGUOUS = { s: "[sš]", c: "[cčć]", z: "[zž]", g: "[gǵ]", k: "[kḱ]" };
const CYRILLIC_AMBIGUOUS = { с: "[сш]", ц: "[цчќ]", з: "[зж]", г: "[гѓ]", к: "[кќ]" };

const widen = (escaped, table) =>
  [...escaped].map((ch) => table[ch.toLowerCase()] ?? ch).join("");

export const buildBilingualRegex = (text) => {
  if (!text) return null;
  const variants = spellingVariants(text).map(escapeRegExp);
  if (!ASCII_RE.test(text)) return variants.join("|");

  // ASCII input yields exactly [as typed, Cyrillic transliteration].
  const [latin, cyrillic] = variants;
  return [widen(latin, LATIN_AMBIGUOUS), widen(cyrillic, CYRILLIC_AMBIGUOUS)].join("|");
};

export const buildBilingualTokenRegexes = (text) => {
  if (!text) return [];
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => buildBilingualRegex(token))
    .filter(Boolean);
};

// Inflected forms differ in the ending ("шунка"/"шунки", "домат"/"домати").
const MAX_EXTRA_LETTERS = 2;
const TRAILING_VOWEL = /[аеиоуaeiou]$/u;

const stem = (token) => {
  const lower = normalize(token);
  return lower.length >= 5 ? lower.replace(TRAILING_VOWEL, "") : lower;
};

/**
 * @param {string} text
 * @returns {(title: string) => boolean}
 */
export const buildWordStartMatcher = (text) => {
  const tokens = (text || "").split(/\s+/).filter(Boolean);
  if (!tokens.length) return () => false;

  const patterns = tokens.map(
    (token) =>
      new RegExp(
        `(?<![\\p{L}\\p{N}])(?<!(?:без|bez)\\s+)(?:${buildBilingualRegex(stem(token))})\\p{L}{0,${MAX_EXTRA_LETTERS}}(?!\\p{L})`,
        "iu",
      ),
  );
  return (title) => {
    const normalized = (title || "").normalize("NFC");
    return patterns.every((re) => re.test(normalized));
  };
};
