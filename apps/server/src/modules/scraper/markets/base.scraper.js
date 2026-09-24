/**
 * Abstract base class for all market scrapers.
 *
 * To add a new market, extend this class and implement:
 *   - get chainName()
 *   - get placeholderImageFilename()
 *   - get geocodeSuffix()        (optional override)
 *   - async fetchMarkets(page)
 *   - async fetchProducts(page, storeUrl, previousUpdate)
 *
 * ScraperService drives the orchestration — the scraper only
 * knows how to navigate and parse its own market's HTML.
 */

/**
 * A store location found on a chain's index page.
 * @typedef {object} ScrapedMarket
 * @property {string} name
 * @property {string} address
 * @property {string} pricelistUrl
 */

/**
 * A single product row parsed from a store's pricelist.
 * @typedef {object} ScrapedProduct
 * @property {string} title
 * @property {number} price
 * @property {string} category
 */

/**
 * Result of scraping one store. When `upToDate` is true the pricelist has not
 * changed since `previousUpdate` and `products` is omitted.
 * @typedef {object} FetchProductsResult
 * @property {boolean} upToDate
 * @property {ScrapedProduct[]} [products]
 * @property {Date | null} [newUpdateDate]
 */
export class BaseScraper {
  /**
   * The canonical chain name (e.g. "Vero", "Ramstore", "Stokomak").
   * Used by ScraperService to auto-create the Chain document.
   * @returns {string}
   */
  get chainName() {
    throw new Error(
      `${this.constructor.name} must implement chainName`,
    );
  }

  /**
   * Key used to look up the auto-seeded chain image by title.
   * Maps to Image.title = `chain-${chainImageKey}` in the database.
   * e.g. "vero", "ramstore"
   * @returns {string}
   */
  get chainImageKey() {
    throw new Error(
      `${this.constructor.name} must implement chainImageKey`,
    );
  }

  /**
   * Appended to the store name when building the Nominatim geocode query.
   * Override if the market operates in a different city/country.
   * @returns {string}
   */
  get geocodeSuffix() {
    return "Скопје, Македонија";
  }

  /**
   * Scrape the market's index page and return all store locations.
   *
   * @param {import('puppeteer').Page} _page - A Puppeteer page instance.
   * @returns {Promise<ScrapedMarket[]>}
   */
  async fetchMarkets(_page) {
    throw new Error(`${this.constructor.name} must implement fetchMarkets()`);
  }

  /**
   * Scrape a single store's pricelist page.
    * Must filter out unavailable products (Достапност = "Не")
    * and invalid or zero prices.
   *
   * @param {import('puppeteer').Page} _page - A Puppeteer page instance.
   * @param {string} _storeUrl - The URL of the store's pricelist.
   * @param {Date | null} [_previousUpdate] - The pricelist date from the last successful scrape.
   * @returns {Promise<FetchProductsResult>}
   */
  async fetchProducts(_page, _storeUrl, _previousUpdate) {
    throw new Error(`${this.constructor.name} must implement fetchProducts()`);
  }

  /**
   * Parse a pricelist "last updated" string such as "12.03.2026 9:30 PM".
   * @param {string | null | undefined} raw
   * @returns {Date | null}
   */
  parseUpdateDate(raw) {
    if (!raw) return null;
    const m = raw.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    const [, day, month, year, rawHours, minutes, ampm] = m;
    let hours = Number(rawHours);
    if (ampm?.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (ampm?.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hours, Number(minutes));
  }

  /**
   * Deduplicate an array of market entries by name, keeping the first occurrence.
   * @template {{ name: string }} T
   * @param {T[]} entries
   * @returns {T[]}
   */
  static deduplicateByName(entries) {
    const seen = new Map();
    for (const entry of entries) {
      if (!seen.has(entry.name)) seen.set(entry.name, entry);
    }
    return Array.from(seen.values());
  }
}
