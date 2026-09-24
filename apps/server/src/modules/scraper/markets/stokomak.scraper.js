import { BaseScraper } from "./base.scraper.js";
import { extractProductsFromTable } from "../utils/table-evaluate.js";
import { withParsedPrices } from "../utils/parsePrice.js";

const INDEX_URL = "https://stokomak.proverkanaceni.mk/";

export class StokomakScraper extends BaseScraper {
  get chainName() {
    return "Stokomak";
  }

  get chainImageKey() {
    return "stokomak";
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
      const selects = Array.from(document.querySelectorAll("select"));
      const storeSelect = selects.find(
        (s) => s.name === "org" || s.options.length > 5,
      );

      if (!storeSelect) return [];

      return Array.from(storeSelect.options)
        .map((opt) => {
          const val = opt.value;
          if (!val || val.trim() === "") return null;

          let rawName = opt.textContent.trim();

          // Ensure it has the brand name for the Geocoder
          const name = rawName.toUpperCase().includes("СТОКОМАК")
            ? rawName
            : `СТОКОМАК ${rawName}`;

          return {
            name: name,
            address: rawName,
            pricelistUrl: `${baseUrl}?org=${val}&search=&perPage=100`,
          };
        })
        .filter(Boolean);
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
            /Датум и време на последно ажурирање[^:]*:\s*([^\n]+)/i,
          );
          return match ? match[1].trim() : null;
        });

        const pageUpdateDate = this.parseUpdateDate(pageUpdateString);
        if (previousUpdateString && pageUpdateDate && previousUpdateString.getTime() === pageUpdateDate.getTime()) {
          return { upToDate: true };
        }
        isFirstPage = false;
      }

      const pageProducts = withParsedPrices(
        await page.evaluate(extractProductsFromTable),
      );

      allProducts.push(...pageProducts);

      const nextUrl = await page.evaluate(() => {
        const nextLinks = Array.from(document.querySelectorAll("a")).filter(
          (a) =>
            a.textContent.trim() === "»" ||
            a.textContent.toLowerCase().includes("следно"),
        );
        return nextLinks.length > 0 ? nextLinks[0].href : null;
      });

      currentUrl = nextUrl;
    }

    return {
      upToDate: false,
      products: allProducts,
      newUpdateDate: this.parseUpdateDate(pageUpdateString),
    };
  }
}
