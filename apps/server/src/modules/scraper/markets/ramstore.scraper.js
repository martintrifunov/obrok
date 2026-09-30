import { BaseScraper } from "./base.scraper.js";
import { extractProductsFromTable } from "../utils/table-evaluate.js";
import { withParsedPrices } from "../utils/parsePrice.js";

const INDEX_URL = "https://ramstore.com.mk/marketi/";
const NAV_TIMEOUT_MS = Number.parseInt(
  process.env.SCRAPER_NAV_TIMEOUT_MS ?? "90000",
  10,
);
const PAGINATION_WAIT_TIMEOUT_MS = Number.parseInt(
  process.env.SCRAPER_PAGINATION_WAIT_TIMEOUT_MS ?? "15000",
  10,
);
const UPDATE_TEXT_WAIT_TIMEOUT_MS = Number.parseInt(
  process.env.SCRAPER_UPDATE_TEXT_WAIT_TIMEOUT_MS ?? "12000",
  10,
);

export class RamstoreScraper extends BaseScraper {
  get chainName() {
    return "Ramstore";
  }

  get chainImageKey() {
    return "ramstore";
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

    const entries = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button")).filter(
        (btn) => btn.getAttribute("onclick")?.includes("location.href="),
      );

      return buttons
        .map((btn) => {
          const hrefMatch = btn
            .getAttribute("onclick")
            .match(/location\.href='([^']+)'/);
          if (!hrefMatch) return null;

          const pricelistUrl = hrefMatch[1];
          let parent = btn.parentElement;
          let name = "UNKNOWN";
          let address = "";

          for (let i = 0; i < 5; i++) {
            if (!parent) break;

            const heading = parent.querySelector("h2, h3, h4");
            if (
              heading &&
              heading.textContent.toLowerCase().includes("рамстор")
            ) {
              name = heading.textContent
                .replace(/РАМСТОРЕ/gi, "РАМСТОР")
                .trim();

              const p = Array.from(
                parent.querySelectorAll("p, span, div"),
              ).find((el) => el.textContent.includes("Адреса:"));

              if (p) {
                address = p.textContent
                  .replace(/Адреса:/i, "")
                  .replace(/\n/g, " ")
                  .trim();
              }
              break;
            }
            parent = parent.parentElement;
          }

          return { name, address, pricelistUrl };
        })
        .filter((e) => e && e.name !== "UNKNOWN");
    });

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

    try {
      await page.goto(storeUrl, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (err) {
      console.warn(
        `[RamstoreScraper] Slow navigation for ${storeUrl}, retrying with domcontentloaded: ${err.message}`,
      );
      await page.goto(storeUrl, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
    }

    // Wait for the table first — the page needs JS to render both the table
    // and the update text, so by the time the table is ready the update string
    // is usually present too. Use the full nav timeout here because heavy
    // markets (e.g. СИТИ МОЛ) need a long time for JS to build the table
    // after domcontentloaded.
    await page.waitForSelector("table.dataTable, table", {
      timeout: NAV_TIMEOUT_MS,
    });

    let pageUpdateString = await this.#readUpdateString(page);

    if (!pageUpdateString) {
      try {
        await page.waitForFunction(
          () =>
            /Датум и време на последно ажурирање на цените:\s*([^\n]+)/i.test(
              document.body.innerText,
            ),
          { timeout: UPDATE_TEXT_WAIT_TIMEOUT_MS },
        );
        pageUpdateString = await this.#readUpdateString(page);
      } catch {
        // Update text never appeared; keep the value read before waiting.
      }
    }

    const pageUpdateDate = this.parseUpdateDate(pageUpdateString);
    if (previousUpdateString && pageUpdateDate && previousUpdateString.getTime() === pageUpdateDate.getTime()) {
      return { upToDate: true };
    }

    // Fast path: read DataTables data directly instead of clicking through pages.
    const fastPath = await page.evaluate(() => {
      const table = document.querySelector("table.dataTable, table");
      if (!table) return { supported: false, products: [] };

      const jQuery = /** @type {any} */ (window).jQuery;
      const hasDataTable = !!jQuery?.fn?.DataTable;
      if (!hasDataTable) return { supported: false, products: [] };

      const dt = jQuery(table).DataTable();
      if (!dt) return { supported: false, products: [] };

      const headerRow = table.querySelector("thead tr, tr:first-child");
      if (!headerRow) return { supported: false, products: [] };

      const headers = Array.from(headerRow.querySelectorAll("th, td")).map(
        (th) => th.textContent.toLowerCase().replace(/\n/g, " ").trim(),
      );

      const indexOf = (keywords) =>
        headers.findIndex((h) => keywords.some((k) => h.includes(k)));
      const colTitle = indexOf(["назив", "име на артикал"]);
      const colPrice = indexOf(["продажна цена"]);
      const colCategory = indexOf(["опис на производ", "опис на стока"]);
      const colAvailable = indexOf(["достапност во маркет", "достапност"]);

      if (colTitle === -1 || colPrice === -1) {
        return { supported: false, products: [] };
      }

      const asText = (value) => {
        if (value === null || value === undefined) return "";
        if (typeof value === "string") {
          const div = document.createElement("div");
          div.innerHTML = value;
          return (div.textContent || "").trim();
        }
        return String(value).trim();
      };

      const rows = dt.rows({ search: "applied" }).data().toArray();
      const products = [];

      for (const row of rows) {
        const cells = Array.isArray(row) ? row : Object.values(row || {});
        if (!cells.length) continue;

        if (
          colAvailable !== -1 &&
          asText(cells[colAvailable]).toUpperCase() === "НЕ"
        ) {
          continue;
        }

        const priceText = asText(cells[colPrice]);
        if (!priceText) continue;

        const title = asText(cells[colTitle]);
        if (!title) continue;

        const category =
          colCategory !== -1 ? asText(cells[colCategory]) || "Општо" : "Општо";

        products.push({ title, priceText, category });
      }

      return { supported: true, products };
    });

    if (fastPath.supported) {
      // Keep the latest seen price per title to avoid unnecessary duplicate writes.
      const latestByTitle = new Map();
      for (const p of withParsedPrices(fastPath.products)) {
        latestByTitle.set(p.title, p);
      }
      allProducts.push(...latestByTitle.values());

      return {
        upToDate: false,
        products: allProducts,
        newUpdateDate: pageUpdateDate,
      };
    }

    await page.evaluate(() => {
      const select = /** @type {HTMLSelectElement | null} */ (
        document.querySelector('select[name$="_length"]')
      );
      if (select) {
        select.value = "100";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await new Promise((r) => setTimeout(r, 1000));

    let hasNextPage = true;
    let pageCount = 1;

    while (hasNextPage) {
      const products = withParsedPrices(
        await page.evaluate(extractProductsFromTable, {
          tableSelector: "table.dataTable, table",
        }),
      );

      const paginationState = await page.evaluate(() => {
        const nextBtn = document.querySelector(".paginate_button.next");
        return {
          hasNextBtn: nextBtn && !nextBtn.classList.contains("disabled"),
          info:
            /** @type {HTMLElement | null} */ (
              document.querySelector(".dataTables_info")
            )?.innerText || "",
        };
      });

      allProducts.push(...products);
      hasNextPage = paginationState.hasNextBtn;

      if (hasNextPage) {
        await page.evaluate((oldInfo, maxWaitMs) => {
          return new Promise((resolve) => {
            /** @type {HTMLElement} */ (
              document.querySelector(".paginate_button.next")
            ).click();
            const startedAt = Date.now();
            const check = setInterval(() => {
              const newInfo =
                /** @type {HTMLElement | null} */ (
                  document.querySelector(".dataTables_info")
                )?.innerText || "";
              if (newInfo !== oldInfo || Date.now() - startedAt > maxWaitMs) {
                clearInterval(check);
                resolve(undefined);
              }
            }, 50);
          });
        }, paginationState.info, PAGINATION_WAIT_TIMEOUT_MS);

        pageCount++;
        if (pageCount % 10 === 0)
          console.log(`[RamstoreScraper] Reached page ${pageCount}...`);
      }
    }

    // Fallback path can also produce duplicate titles from repeated pages.
    // Keep latest seen price per title before persisting.
    const latestByTitle = new Map();
    for (const p of allProducts) {
      latestByTitle.set(p.title, p);
    }

    return {
      upToDate: false,
      products: Array.from(latestByTitle.values()),
      newUpdateDate: pageUpdateDate,
    };
  }

  async #readUpdateString(page) {
    return page.evaluate(() => {
      const match = document.body.innerText.match(
        /Датум и време на последно ажурирање на цените:\s*([^\n]+)/i,
      );
      return match ? match[1].trim() : null;
    });
  }
}
