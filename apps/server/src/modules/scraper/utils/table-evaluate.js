/**
 * Shared product-table extraction logic for Puppeteer page.evaluate().
 *
 * These functions are serialized and run in the browser context —
 * they must be self-contained (no imports, no closures over Node variables).
 */

/**
 * Extract products from an HTML table inside a Puppeteer page.
 *
 * @param {Object} opts
 * @param {string} [opts.tableSelector] - CSS selector for the table (default: auto-detect by "Назив" header)
 * @param {string} [opts.defaultCategory="Општо"] - Fallback category value
 * @param {string[]} [opts.titleKeywords]
 * @param {string[]} [opts.priceKeywords]
 * @param {string[]} [opts.categoryKeywords]
 * @param {string[]} [opts.availabilityKeywords]
 * @returns {Array<{title: string, priceText: string, category: string}>}
 *   Raw price text; parse it in Node with `withParsedPrices` (this runs in the
 *   browser and can't import the shared parser).
 */
export const extractProductsFromTable = (opts = {}) => {
  const {
    tableSelector,
    defaultCategory = "Општо",
    titleKeywords = ["назив", "име на артикал"],
    priceKeywords = ["продажна цена", "цена"],
    categoryKeywords = ["опис на стока", "опис на производ", "категорија"],
    availabilityKeywords = ["достапност во маркет", "достапност"],
  } = opts;

  let productTable;
  if (tableSelector) {
    productTable = document.querySelector(tableSelector);
  } else {
    productTable = Array.from(document.querySelectorAll("table")).find((t) =>
      Array.from(t.querySelectorAll("th")).some((th) =>
        titleKeywords.some((keyword) =>
          th.textContent.toLowerCase().includes(keyword),
        ),
      ),
    );
  }

  if (!productTable) return [];

  const headerRow = productTable.querySelector("thead tr, tr:first-child");
  if (!headerRow) return [];

  const headers = Array.from(headerRow.querySelectorAll("th, td")).map((th) =>
    th.textContent.toLowerCase().replace(/\n/g, " ").trim(),
  );

  const indexOf = (keywords) =>
    headers.findIndex((h) => keywords.some((k) => h.includes(k)));

  const colTitle = indexOf(titleKeywords);
  const colPrice = indexOf(priceKeywords);
  const colCategory = indexOf(categoryKeywords);
  const colAvailable = indexOf(availabilityKeywords);

  if (colTitle === -1 || colPrice === -1) return [];

  const dataRows = Array.from(
    productTable.querySelectorAll("tbody tr, tr"),
  ).slice(1);

  return dataRows.reduce((acc, row) => {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 2) return acc;

    if (
      colAvailable !== -1 &&
      cells[colAvailable]?.textContent.trim().toUpperCase() === "НЕ"
    ) return acc;

    const priceText = cells[colPrice]?.textContent.trim();
    if (!priceText) return acc;

    const title = cells[colTitle]?.textContent.trim();
    if (!title) return acc;

    const category = colCategory !== -1
      ? cells[colCategory]?.textContent.trim() || defaultCategory
      : defaultCategory;

    acc.push({ title, priceText, category });
    return acc;
  }, []);
};
