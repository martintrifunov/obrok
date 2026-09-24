import { BaseScraper } from "./base.scraper.js";
import { extractProductsFromTable } from "../utils/table-evaluate.js";

const INDEX_URL = "https://pricelist.vero.com.mk/";

export class VeroScraper extends BaseScraper {
  get chainName() {
    return "Vero";
  }

  get chainImageKey() {
    return "vero";
  }

  get geocodeSuffix() {
    return "Македонија";
  }

  /**
   * @param {import('puppeteer').Page} page
   * @returns {Promise<import('./base.scraper.js').ScrapedMarket[]>}
   */
  async fetchMarkets(page) {
    await page.goto(INDEX_URL, { waitUntil: "domcontentloaded" });

    const entries = await page.evaluate((baseUrl) => {
      const storePattern = /^\d+_\d+\.html$/;

      return Array.from(document.querySelectorAll("a[href]"))
        .filter((a) => storePattern.test(a.getAttribute("href")))
        .map((a) => {
          const name = a.textContent.trim();

          const td = a.closest("td");
          const rawAddress = td
            ? td.innerText.replace(name, "").replace(/\n/g, " ").trim()
            : "";

          const address = rawAddress
            .split("–")
            .map((s) => s.trim())
            .join(", ");

          return {
            name,
            address,
            pricelistUrl: baseUrl + a.getAttribute("href"),
          };
        })
        .filter((e) => e.name.length > 0);
    }, INDEX_URL);

    return BaseScraper.deduplicateByName(entries);
  }

  /**
   * @param {import('puppeteer').Page} page
   * @param {string} storeUrl
   * @param {Date | null} [previousUpdateString]
   * @returns {Promise<import('./base.scraper.js').FetchProductsResult>}
   */
  async fetchProducts(page, storeUrl, previousUpdateString) {
    const allProducts = [];
    let currentUrl = storeUrl;
    let pageUpdateString = null;
    let isFirstPage = true;

    while (currentUrl) {
      await page.goto(currentUrl, { waitUntil: "domcontentloaded" });

      if (isFirstPage) {
        pageUpdateString = await page.evaluate(() => {
          const match = document.body.innerText.match(
            /Последно ажурирање:\s*([^\n]+)/,
          );
          return match ? match[1].trim() : null;
        });

        const pageUpdateDate = this.parseUpdateDate(pageUpdateString);
        if (previousUpdateString && pageUpdateDate && previousUpdateString.getTime() === pageUpdateDate.getTime()) {
          return { upToDate: true };
        }
        isFirstPage = false;
      }

      const pageProducts = await page.evaluate(extractProductsFromTable);

      allProducts.push(...pageProducts);

      const nextUrl = await page.evaluate((current) => {
        const match = current.match(/(\d+)_(\d+)\.html$/);
        if (!match) return null;

        const storeId = match[1];
        const nextPage = parseInt(match[2], 10) + 1;
        const nextHref = `${storeId}_${nextPage}.html`;

        const link = Array.from(
          /** @type {NodeListOf<HTMLAnchorElement>} */ (
            document.querySelectorAll("a[href]")
          ),
        ).find(
          (a) => a.getAttribute("href") === nextHref,
        );

        return link ? link.href : null;
      }, currentUrl);

      currentUrl = nextUrl;
    }

    return {
      upToDate: false,
      products: allProducts,
      newUpdateDate: this.parseUpdateDate(pageUpdateString),
    };
  }
}
