/**
 * Parses a scraped price string that may use either "." or "," as the decimal
 * separator, with or without thousands separators ("1.299,00 ден", "1,299.00",
 * "1 299,00", "89,90"). Returns NaN when no price can be read.
 *
 * - Both "." and "," present: the last one is the decimal separator.
 * - One kind, repeated ("1.234.567"): thousands separators.
 * - One kind, once: a 3-digit fraction is a thousands group ("2.450" = 2450),
 *   since MKD grocery prices don't have 3 decimals; otherwise it's decimal.
 *
 * @param {unknown} raw
 * @returns {number}
 */
export const parsePrice = (raw) => {
  if (raw === null || raw === undefined) return NaN;
  // Keep only digits and separators; spaces (incl. NBSP) are thousands separators.
  const s = String(raw).replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return NaN;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  let normalized;
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? "." : ",";
    const parts = s.split(sep);
    const fraction = parts[parts.length - 1];
    const isThousands = parts.length > 2 || (fraction.length === 3 && parts[0].length > 0);
    normalized = isThousands ? parts.join("") : `${parts[0]}.${fraction}`;
  } else {
    normalized = s;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : NaN;
};

/**
 * Converts rows extracted in the browser (which can't import this module) from
 * raw `priceText` to a numeric `price`, dropping rows without a positive price.
 *
 * @param {Array<{ title: string, priceText: string, category: string }>} rows
 * @returns {Array<{ title: string, price: number, category: string }>}
 */
export const withParsedPrices = (rows) =>
  rows.reduce((acc, { title, priceText, category }) => {
    const price = parsePrice(priceText);
    if (price > 0) acc.push({ title, price, category });
    return acc;
  }, []);
