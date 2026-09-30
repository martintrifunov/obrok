/**
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
 * @param {Array<{ title: string, priceText: string, category: string }>} rows
 * @returns {Array<{ title: string, price: number, category: string }>}
 */
export const withParsedPrices = (rows) =>
  rows.reduce((acc, { title, priceText, category }) => {
    const price = parsePrice(priceText);
    if (price > 0) acc.push({ title, price, category });
    return acc;
  }, []);
