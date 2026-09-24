import { BaseScraper } from "./base.scraper.js";

const CENOVNIK_URL = "https://www.superkitgo.mk/cenovnik.html";
const MARKETI_URL = "https://www.superkitgo.mk/marketi.html";
const TABLE_API_BASE = "https://www.superkitgo.mk/table.php";
const PER_PAGE = 1000;
const FETCH_TIMEOUT_MS = 60_000;

export class SuperKitGoScraper extends BaseScraper {
  get chainName() {
    return "Super KIT-GO";
  }

  get chainImageKey() {
    return "superkitgo";
  }

  get geocodeSuffix() {
    return "Македонија";
  }

  /**
   * Override base parser to also handle YYYY-MM-DD HH:mm:ss format
   * returned by the Super Kit-Go JSON API.
   */
  parseUpdateDate(raw) {
    if (!raw) return null;

    // Try API format first: YYYY-MM-DD HH:mm:ss
    const apiMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (apiMatch) {
      const [, year, month, day, hours, minutes] = apiMatch;
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
    }

    // Fall back to base DD.MM.YYYY HH:mm parser
    return super.parseUpdateDate(raw);
  }

  /**
   * Discover markets from cenovnik.html (market numbers + type filter)
   * joined with marketi.html (full addresses).
   * Only returns markets tagged type === "super" (СУПЕР КИТ-ГО).
   *
   * @param {import('puppeteer').Page} page
   * @returns {Promise<import('./base.scraper.js').ScrapedMarket[]>}
   */
  async fetchMarkets(page) {
    // --- Step 1: Get market list with numbers and types from cenovnik ---
    await page.goto(CENOVNIK_URL, { waitUntil: "domcontentloaded" });

    const cenovnikMarkets = await page.evaluate(() => {
      const script = document.body.innerHTML;
      const match = script.match(/const\s+markets\s*=\s*(\[[\s\S]*?\]);/);
      if (!match) return [];
      try {
        // The array uses JS object syntax (unquoted keys), so we eval it safely
        // by extracting the literal from the already-loaded page context.
        return (0, eval)(match[1]);
      } catch {
        return [];
      }
    });

    const superMarkets = cenovnikMarkets.filter((m) => m.type === "super");

    // --- Step 2: Get full addresses from marketi.html ---
    await page.goto(MARKETI_URL, { waitUntil: "domcontentloaded" });

    const storesData = await page.evaluate(() => {
      const script = document.body.innerHTML;
      const match = script.match(/const\s+storesData\s*=\s*(\[[\s\S]*?\]);/);
      if (!match) return [];
      try {
        return (0, eval)(match[1]);
      } catch {
        return [];
      }
    });

    // Build a lookup from market number (extracted from name like "Super KIT-GO br.11 Gevgelija")
    // to address data. The storesData uses a sequential id, but stores include
    // the market branch number in their name field.
    const addressByNumber = new Map();
    for (const store of storesData) {
      if (store.type !== "superkitgo") continue;
      const brMatch = store.name.match(/br\.?\s*(\d+)/i);
      if (brMatch) {
        addressByNumber.set(Number(brMatch[1]), {
          address: store.address,
          city: store.city,
        });
      }
    }

    const entries = superMarkets.map((m) => {
      const addrInfo = addressByNumber.get(m.number);
      const address = addrInfo
        ? `${addrInfo.address}, ${addrInfo.city}`
        : m.city;

      return {
        name: `СУПЕР КИТ-ГО ${m.name}`.trim(),
        address,
        pricelistUrl: `${TABLE_API_BASE}?market=market${m.number}`,
      };
    });

    return BaseScraper.deduplicateByName(entries);
  }

  /**
   * Scrape products from a market's pricelist via the JSON API.
   * The table.php page exposes an ajax=1 endpoint that returns JSON,
   * completely bypassing any client-side anti-devtools JS.
   *
   * @param {import('puppeteer').Page} _page
   * @param {string} storeUrl
   * @param {Date | null} [previousUpdateString]
   * @returns {Promise<import('./base.scraper.js').FetchProductsResult>}
   */
  async fetchProducts(_page, storeUrl, previousUpdateString) {
    // Fetch first page to get update date and pagination info
    const firstPageData = await this.#fetchPage(storeUrl, 1);
    if (!firstPageData?.success) {
      console.warn(`[SuperKitGoScraper] Failed to load ${storeUrl}`);
      return { upToDate: false, products: [] };
    }

    const newUpdateDate = this.parseUpdateDate(firstPageData.last_update);
    if (
      previousUpdateString &&
      newUpdateDate &&
      previousUpdateString.getTime() === newUpdateDate.getTime()
    ) {
      return { upToDate: true };
    }

    const totalPages = firstPageData.pagination?.total_pages ?? 1;
    const allProducts = this.#extractProducts(firstPageData.products);

    // Fetch remaining pages sequentially to be respectful to the server
    for (let p = 2; p <= totalPages; p++) {
      const pageData = await this.#fetchPage(storeUrl, p);
      if (!pageData?.success || !pageData.products?.length) break;
      allProducts.push(...this.#extractProducts(pageData.products));
    }

    // Deduplicate by title, keeping latest occurrence
    const latestByTitle = new Map();
    for (const product of allProducts) {
      latestByTitle.set(product.title, product);
    }

    return {
      upToDate: false,
      products: Array.from(latestByTitle.values()),
      newUpdateDate,
    };
  }

  async #fetchPage(storeUrl, pageNum) {
    const url = `${storeUrl}&ajax=1&page=${pageNum}&per_page=${PER_PAGE}&search=&category=&discount=0`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { "User-Agent": "StudentObrok/1.0" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        if (attempt < 3) {
          console.warn(
            `[SuperKitGoScraper] Page ${pageNum} attempt ${attempt}/3 failed: ${err.message}. Retrying...`,
          );
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        } else {
          console.error(
            `[SuperKitGoScraper] Page ${pageNum} failed after 3 attempts: ${err.message}`,
          );
          return null;
        }
      }
    }
  }

  /**
   * Extract products from a JSON response page.
    * Filters: only available (dostapnost === "1") and valid positive prices.
   */
  #extractProducts(products) {
    if (!products?.length) return [];

    return products.reduce((acc, p) => {
      // Only include available products (dostapnost "1" = ДА)
      if (String(p.dostapnost) !== "1") return acc;

      const rawPrice = String(p.prodazna_cena).replace(",", ".").replace(/[^\d.]/g, "");
      const price = parseFloat(rawPrice);
  if (isNaN(price) || price <= 0) return acc;

      const title = (p.product_name || "").trim();
      if (!title) return acc;

      const category = (p.opis || "").trim() || "Општо";

      acc.push({ title, price, category });
      return acc;
    }, []);
  }
}
