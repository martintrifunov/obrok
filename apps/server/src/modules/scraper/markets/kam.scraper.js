import { BaseScraper } from "./base.scraper.js";
import { parsePrice } from "../utils/parsePrice.js";
import { extractPdfTextItems } from "../utils/pdf-text-extractor.js";

const INDEX_URL = "https://kam.com.mk/ceni-vo-marketi.nspx";
const SHOP_LIST_PATH = "/ShopsWeb/LoadShopList";
const PDF_BASE = "https://kam.com.mk/";
const FETCH_TIMEOUT_MS = 60_000;
const FETCH_RETRIES = 3;
// Wrapped title and description lines sit up to ~19 units below the priced
// line; the next product starts ~37 units down.
const CONTINUATION_MAX_GAP = 24;

export class KamScraper extends BaseScraper {
  get chainName() {
    return "KAM";
  }

  get chainImageKey() {
    return "kam";
  }

  /**
   * @param {import('puppeteer').Page} page
   * @returns {Promise<import('./base.scraper.js').ScrapedMarket[]>}
   */
  async fetchMarkets(page) {
    // Navigate to trigger session cookies, then call the JSON API
    await page.goto(INDEX_URL, { waitUntil: "networkidle2" });

    const shops = await page.evaluate(async (apiPath) => {
      const res = await fetch(apiPath, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!res.ok) return [];

      const body = await res.text();
      try {
        const parsed = JSON.parse(body);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }, SHOP_LIST_PATH);

    const markets = [];
    for (const shop of shops) {
      if (!shop.ShopFiles?.length) continue;

      markets.push({
        name: `КАМ ${shop.Name}`.trim(),
        address: [shop.Address, shop.City].filter(Boolean).join(", "),
        pricelistUrl: `${PDF_BASE}${shop.ShopFiles[0].RelativePath}`,
      });
    }

    return BaseScraper.deduplicateByName(markets);
  }

  async #fetchPdf(url) {
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      } catch (err) {
        if (attempt < FETCH_RETRIES) {
          console.warn(
            `[KamScraper] PDF fetch attempt ${attempt}/${FETCH_RETRIES} failed: ${err.message}. Retrying...`,
          );
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * @param {import('puppeteer').Page} _page
   * @param {string} pdfUrl
   * @param {Date | null} [prevUpdateDate]
   * @returns {Promise<import('./base.scraper.js').FetchProductsResult>}
   */
  async fetchProducts(_page, pdfUrl, prevUpdateDate) {
    const pdfBuf = await this.#fetchPdf(pdfUrl);
    const items = extractPdfTextItems(pdfBuf);

    if (!items.length) {
      console.warn(`[KamScraper] No text items extracted from ${pdfUrl}`);
      return { upToDate: false, products: [] };
    }

    // Extract update date string from first-page text
    const firstPageText = items
      .filter((it) => it.page === 1)
      .map((it) => it.str)
      .join(" ");

    const updateMatch = firstPageText.match(
      /(\d{1,2}[./]\d{1,2}[./]\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i,
    );
    const newUpdateDate = this.parseUpdateDate(updateMatch?.[1] ?? null);

    if (
      prevUpdateDate &&
      newUpdateDate &&
      prevUpdateDate.getTime() === newUpdateDate.getTime()
    ) {
      return { upToDate: true };
    }

    const products = this.#parseProducts(items);
    return { upToDate: false, products, newUpdateDate };
  }

  #parseProducts(items) {
    const byPage = new Map();
    for (const it of items) {
      if (!byPage.has(it.page)) byPage.set(it.page, []);
      byPage.get(it.page).push(it);
    }

    const products = [];
    let colBounds = null;

    for (const [, pageItems] of byPage) {
      if (!colBounds) colBounds = this.#detectColumns(pageItems);
      if (!colBounds) continue;

      // A product's title and description wrap over several lines; only the
      // first carries the price. Rows without a price below a priced row are
      // its continuation, as long as they're within one product's height.
      let current = null;
      for (const row of this.#groupRows(pageItems)) {
        const cells = this.#readRow(row, colBounds);
        if (cells.price > 0) {
          if (current) products.push(this.#finishProduct(current));
          current = { ...cells, y: row[0].y };
        } else if (current && current.y - row[0].y <= CONTINUATION_MAX_GAP) {
          current.titleParts.push(cells.title);
          current.categoryParts.push(cells.category);
        } else if (current) {
          products.push(this.#finishProduct(current));
          current = null;
        }
      }
      if (current) products.push(this.#finishProduct(current));
    }

    return products.filter(Boolean);
  }

  #detectColumns(items) {
    const headers = [
      { key: "title", pattern: /назив|производ/i },
      { key: "price", pattern: /^продажна$/i },
      { key: "unitPrice", pattern: /^единична$/i },
      { key: "category", pattern: /^опис$/i },
      { key: "availability", pattern: /достапност/i },
    ];

    const xByKey = {};
    for (const { key, pattern } of headers) {
      const match = items.find((it) => pattern.test(it.str));
      if (match) xByKey[key] = match.x;
    }

    if (!xByKey.title || !xByKey.price || !xByKey.availability) return null;

    const sorted = Object.entries(xByKey).sort((a, b) => a[1] - b[1]);
    const ranges = {};
    for (let i = 0; i < sorted.length; i++) {
      const [key, startX] = sorted[i];
      ranges[key] = { startX, endX: i < sorted.length - 1 ? sorted[i + 1][1] : Infinity };
    }
    return ranges;
  }

  #groupRows(items) {
    if (!items.length) return [];
    const sorted = [...items].sort((a, b) => {
      const dy = b.y - a.y;
      if (Math.abs(dy) > 3) return dy;
      return a.x - b.x;
    });

    const rows = [[sorted[0]]];
    let rowY = sorted[0].y;
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].y - rowY) <= 3) {
        rows[rows.length - 1].push(sorted[i]);
      } else {
        rows.push([sorted[i]]);
        rowY = sorted[i].y;
      }
    }
    return rows;
  }

  #readRow(rowItems, cols) {
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);

    const collect = (key) =>
      sorted
        .filter((it) => cols[key] && it.x >= cols[key].startX && it.x < cols[key].endX)
        .map((it) => it.str)
        .join(" ")
        .trim();

    const title = collect("title");
    return {
      title,
      titleParts: [title],
      categoryParts: [collect("category")],
      category: collect("category"),
      price: parsePrice(collect("price")),
      // The column runs to the page edge and also picks up the promo price
      // columns, so only its first word is the "Да"/"Не" answer.
      available: collect("availability").split(/\s+/)[0].toUpperCase() !== "НЕ",
    };
  }

  #finishProduct({ titleParts, categoryParts, price, available }) {
    const join = (parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const title = join(titleParts);
    if (!title || title.length < 2) return null;
    // The column header ("Назив производ"); real titles can contain "производ".
    if (/^(назив|стока)(\s|$)/i.test(title)) return null;
    if (!available) return null;
    return { title, price, category: join(categoryParts) || "Општо" };
  }
}
