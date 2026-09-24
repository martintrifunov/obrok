import { BaseScraper } from "./base.scraper.js";
import { withParsedPrices } from "../utils/parsePrice.js";

const INDEX_URL = "https://kipper.mk/mk/marketet/";
const NAV_TIMEOUT_MS = Number.parseInt(
  process.env.SCRAPER_NAV_TIMEOUT_MS ?? "90000",
  10,
);
const LOAD_MORE_DELAY_MS = 1200;
const LOAD_MORE_MAX_CLICKS = 30;
const AJAX_PAGE_SIZE = 500;

export class KipperScraper extends BaseScraper {
  get chainName() {
    return "Kipper";
  }

  get chainImageKey() {
    return "kipper";
  }

  get geocodeSuffix() {
    return "Македонија";
  }

  /**
   * Kipper commonly returns: "4 April 2026 - 13:21".
   * Keep base parser fallback for DD.MM.YYYY / DD/MM/YYYY variants.
   */
  parseUpdateDate(raw) {
    if (!raw) return null;

    const match = raw.match(
      /(\d{1,2})\s+([A-Za-zА-Яа-яЃѓЅѕЈјЉљЊњЌќЏџ]+)\s+(\d{4})\s*[-–]\s*(\d{1,2}):(\d{2})/,
    );

    if (!match) {
      return super.parseUpdateDate(raw);
    }

    const [, day, monthNameRaw, year, hours, minutes] = match;
    const monthName = monthNameRaw.toLowerCase();

    const monthLookup = new Map([
      ["january", 0],
      ["february", 1],
      ["march", 2],
      ["april", 3],
      ["may", 4],
      ["june", 5],
      ["july", 6],
      ["august", 7],
      ["september", 8],
      ["october", 9],
      ["november", 10],
      ["december", 11],
      ["јануари", 0],
      ["февруари", 1],
      ["март", 2],
      ["април", 3],
      ["мај", 4],
      ["јуни", 5],
      ["јули", 6],
      ["август", 7],
      ["септември", 8],
      ["октомври", 9],
      ["ноември", 10],
      ["декември", 11],
    ]);

    const monthIndex = monthLookup.get(monthName);
    if (monthIndex === undefined) {
      return super.parseUpdateDate(raw);
    }

    return new Date(
      Number(year),
      monthIndex,
      Number(day),
      Number(hours),
      Number(minutes),
    );
  }

  async fetchMarkets(page) {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "mk-MK,mk;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    await page.goto(INDEX_URL, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });

    console.log(`[Kipper] Loaded index page: ${page.url()}`);

    let previousLinkCount = 0;
    for (let clickCount = 0; clickCount < LOAD_MORE_MAX_CLICKS; clickCount++) {
      const currentLinkCount = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h3 a[href]"))
          .filter((link) => /\/[a-z]{2}\/(?:kipper-|%d0%ba%d0%b8%d0%bf)/i.test(link.href))
          .length,
      );

      const clicked = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("a, button, span"))
          .find((element) => /load more/i.test(element.textContent || ""));

        if (!button) return false;

        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      });

      if (!clicked) break;

      await new Promise((resolve) => setTimeout(resolve, LOAD_MORE_DELAY_MS));

      const nextLinkCount = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h3 a[href]"))
          .filter((link) => /\/[a-z]{2}\/(?:kipper-|%d0%ba%d0%b8%d0%bf)/i.test(link.href))
          .length,
      );

      if (nextLinkCount <= currentLinkCount || nextLinkCount === previousLinkCount) {
        break;
      }

      previousLinkCount = nextLinkCount;
    }

    // Extract name + URL pairs directly from the index page so we always
    // have the correct market name even if detail-page navigation is
    // geo-blocked or redirected on the VPS.
    const indexEntries = await page.evaluate(() => {
      const seen = new Set();
      return Array.from(document.querySelectorAll("h3 a[href]"))
        .filter((link) => /\/[a-z]{2}\/(?:kipper-|%d0%ba%d0%b8%d0%bf)/i.test(link.href))
        .reduce((acc, link) => {
          if (!seen.has(link.href)) {
            seen.add(link.href);
            acc.push({ name: link.textContent.trim(), url: link.href });
          }
          return acc;
        }, []);
    });

    console.log(`[Kipper] Found ${indexEntries.length} market URLs`);

    const markets = [];
    for (const { name, url } of indexEntries) {
      if (!name) continue;

      // Try to get the street address from the detail page; fall back to
      // empty address (geocoder will resolve from the market name/city).
      let address = "";
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        await page.waitForFunction(
          () => /Град:|Адреса:|Општина:/i.test(document.body.innerText),
          { timeout: 15_000 },
        ).catch(() => {});

        address = await page.evaluate(() => {
          const bodyText = document.body.innerText.replace(/\u00a0/g, " ");
          const hasMarketData = /Град:|Адреса:|Општина:/i.test(bodyText);
          if (!hasMarketData) return "";

          const extractField = (label) => {
            const match = bodyText.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
            return match ? match[1].trim() : "";
          };

          const city = extractField("Град");
          const addr = extractField("Адреса");
          return [addr, city].filter(Boolean).join(", ");
        });
      } catch {
        // detail page unreachable — continue with empty address
      }

      markets.push({ name, address, pricelistUrl: url });
    }

    return BaseScraper.deduplicateByName(markets);
  }

  async fetchProducts(page, storeUrl, previousUpdateString) {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "mk-MK,mk;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    // Hide the webdriver flag that bot-detection scripts look for
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
      window.chrome = { runtime: {} };
    });

    // Force Macedonian language via WPML cookie before navigating
    const domain = new URL(storeUrl).hostname;
    await page.setCookie({
      name: "wp-wpml_current_language",
      value: "mk",
      domain,
    });

    await page.goto(storeUrl, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });

    // Cloudflare Rocket Loader rewrites inline scripts into base64-encoded
    // data: URIs with a non-standard type, so the browser never executes
    // them.  If productsData wasn't set natively, decode it from the HTML.
    await page.evaluate(() => {
      if (window.productsData?.post_id) return;

      const scripts = document.querySelectorAll("script[src^='data:text/javascript;base64,']");
      for (const script of scripts) {
        try {
          const b64 = script.src.replace("data:text/javascript;base64,", "");
          const decoded = atob(b64);
          if (decoded.includes("productsData")) {
            // Execute the decoded script to set window.productsData
            const fn = new Function(decoded);
            fn();
            if (window.productsData?.post_id) break;
          }
        } catch { /* skip undecodable scripts */ }
      }
    });

    const landedUrl = page.url();
    const hasProductData = await page.evaluate(() => !!window.productsData?.post_id);
    console.log(
      `[Kipper] Product page: requested=${storeUrl} landed=${landedUrl} hasProductData=${hasProductData}`,
    );

    await page.waitForFunction(
      () => {
        const hasBootstrapData = !!window.productsData?.post_id;
        if (hasBootstrapData) return true;

        return /нема податоци|моментално сме под одржување/i.test(document.body.innerText);
      },
      { timeout: NAV_TIMEOUT_MS },
    ).catch(() => {});

    const pageUpdateString = await page.evaluate(() => {
      const match = document.body.innerText.match(
        /Датум и време на последно ажурирање на цените:\s*([^\n]+)/i,
      );
      return match ? match[1].trim() : null;
    });

    const pageUpdateDate = this.parseUpdateDate(pageUpdateString);
    if (previousUpdateString && pageUpdateDate && previousUpdateString.getTime() === pageUpdateDate.getTime()) {
      return { upToDate: true };
    }

    const allProducts = await page.evaluate(async (ajaxPageSize) => {
      const toText = (value) => {
        if (value === null || value === undefined) return "";
        if (typeof value === "string") {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = value;
          return (wrapper.textContent || "").replace(/\s+/g, " ").trim();
        }
        return String(value).replace(/\s+/g, " ").trim();
      };

      const postId = window.productsData?.post_id;
      if (!postId) return [];

      const buildBody = (start, draw) => {
        const body = new URLSearchParams();
        body.set("draw", String(draw));

        const columns = [
          ["product_name", true, true],
          ["product_price", true, false],
          ["product_type_alt", true, false],
          ["product_subgroup", true, true],
          ["product_status", true, false],
          ["product_price_normal", true, true],
          ["", true, false],
          ["", true, true],
          ["", true, false],
        ];

        columns.forEach(([name, searchable, orderable], idx) => {
          body.set(`columns[${idx}][data]`, name);
          body.set(`columns[${idx}][name]`, "");
          body.set(`columns[${idx}][searchable]`, searchable ? "true" : "false");
          body.set(`columns[${idx}][orderable]`, orderable ? "true" : "false");
          body.set(`columns[${idx}][search][value]`, "");
          body.set(`columns[${idx}][search][regex]`, "false");
        });

        body.set("order[0][column]", "0");
        body.set("order[0][dir]", "asc");
        body.set("order[0][name]", "");
        body.set("start", String(start));
        body.set("length", String(ajaxPageSize));
        body.set("search[value]", "");
        body.set("search[regex]", "false");
        body.set("action", "get_products_data");
        body.set("post_id", String(postId));

        return body;
      };

      const products = [];
      let start = 0;
      let draw = 1;
      let total = Number.POSITIVE_INFINITY;

      while (start < total) {
        const res = await fetch("https://kipper.mk/wp-admin/admin-ajax.php", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "application/json, text/plain, */*",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: buildBody(start, draw),
        });

        if (!res.ok) break;

        const payload = await res.json();
        const rows = Array.isArray(payload.data) ? payload.data : [];
        total = Number(payload.recordsFiltered || payload.recordsTotal || rows.length);

        if (!rows.length) break;

        for (const row of rows) {
          const title = toText(row.product_name);
          if (!title) continue;

          const availability = toText(row.product_status).toUpperCase();
          if (availability === "НЕ") continue;

          // Parsed in Node below: this runs in the browser and can't import the parser.
          const priceText = toText(row.product_price);
          if (!priceText) continue;

          const category =
            toText(row.product_subgroup) || toText(row.product_type_alt) || "Општо";

          products.push({ title, priceText, category });
        }

        start += rows.length;
        draw += 1;
      }

      return products;
    }, AJAX_PAGE_SIZE);

    const latestByTitle = new Map();
    for (const product of withParsedPrices(allProducts)) {
      latestByTitle.set(product.title, product);
    }

    return {
      upToDate: false,
      products: Array.from(latestByTitle.values()),
      newUpdateDate: pageUpdateDate,
    };
  }
}