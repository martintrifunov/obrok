import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { normalizeMarketName } from "./normalize-market-name.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Nominatim's usage policy allows at most 1 request per second.
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const NOMINATIM_RATE_LIMIT_BACKOFF_MS = 5000;

const COORDS_PATH = resolve(__dirname, "../../data/market-coordinates.json");

// City-center fallback coordinates [lat, lon] used only when all geocoding queries fail.
const CITY_FALLBACK_COORDS = {
  Скопје: [41.9981, 21.4254],
  Битола: [41.0317, 21.3347],
  Тетово: [42.0097, 20.9716],
  Куманово: [42.1322, 21.7144],
  Гевгелија: [41.1417, 22.5025],
  Велес: [41.7156, 21.7753],
  Штип: [41.7458, 22.1958],
  Струга: [41.1778, 20.6786],
  Охрид: [41.1172, 20.8016],
  Прилеп: [41.3451, 21.5550],
  Кавадарци: [41.4334, 22.0089],
  Кичево: [41.5127, 20.9586],
  Гостивар: [41.8000, 20.9167],
  Струмица: [41.4378, 22.6427],
  Кочани: [41.9164, 22.4128],
  Неготино: [41.4833, 22.0833],
  Виница: [41.8828, 22.5092],
  Берово: [41.7031, 22.8578],
  "Свети Николе": [41.8696, 21.9527],
  "Демир Хисар": [41.2217, 21.2031],
  Радовиш: [41.6383, 22.4678],
  Пробиштип: [41.9957, 22.1794],
  Делчево: [41.9664, 22.7746],
  "Крива Паланка": [42.2015, 22.3308],
  Дебар: [41.5244, 20.5242],
  Ресен: [41.0893, 21.0109],
  Валандово: [41.3174, 22.5600],
};

const CYR_TO_LAT = {
  А: "A",
  Б: "B",
  В: "V",
  Г: "G",
  Д: "D",
  Ѓ: "Gj",
  Е: "E",
  Ж: "Zh",
  З: "Z",
  Ѕ: "Dz",
  И: "I",
  Ј: "J",
  К: "K",
  Л: "L",
  Љ: "Lj",
  М: "M",
  Н: "N",
  Њ: "Nj",
  О: "O",
  П: "P",
  Р: "R",
  С: "S",
  Т: "T",
  Ќ: "Kj",
  У: "U",
  Ф: "F",
  Х: "H",
  Ц: "C",
  Ч: "Ch",
  Џ: "Dzh",
  Ш: "Sh",
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  ѓ: "gj",
  е: "e",
  ж: "zh",
  з: "z",
  ѕ: "dz",
  и: "i",
  ј: "j",
  к: "k",
  л: "l",
  љ: "lj",
  м: "m",
  н: "n",
  њ: "nj",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  ќ: "kj",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  џ: "dzh",
  ш: "sh",
};

function transliterate(text) {
  return (
    text
      ?.split("")
      .map((ch) => CYR_TO_LAT[ch] ?? ch)
      .join("") || ""
  );
}

export class GeocoderService {
  #staticCoords;

  #lastRequestAt = 0;

  /**
   * @param {{ sleep?: (ms: number) => Promise<void>, now?: () => number }} [options]
   *   Injectable clock for tests.
   */
  constructor({ sleep, now } = {}) {
    this.sleepFn = sleep ?? ((ms) => new Promise((res) => setTimeout(res, ms)));
    this.now = now ?? (() => Date.now());
    try {
      this.#staticCoords = JSON.parse(readFileSync(COORDS_PATH, "utf-8"));
      console.log(
        `[GeocoderService] Loaded ${Object.keys(this.#staticCoords).length} static coordinates.`,
      );
    } catch {
      this.#staticCoords = {};
      console.warn(
        "[GeocoderService] No market-coordinates.json found — static lookup disabled.",
      );
    }
  }

  async geocode(storeName, suffix, address) {
    // --- Tier 1: Static JSON lookup ---
    const key = normalizeMarketName(storeName);
    if (this.#staticCoords[key]) {
      console.log(`[GeocoderService] ✅ Static lookup hit for "${key}".`);
      return this.#staticCoords[key];
    }

    // --- Tier 2: Nominatim fallback ---
    console.log(
      `[GeocoderService] Static miss for "${key}", trying Nominatim...`,
    );

    const city = this.#getCity(address) || "";

    const cleanAddress = address
      // Strip street/number prefixes only as whole words ("бр" must not eat "Брегалница").
      ?.replace(/(?<!\p{L})(?:бул|ул|бр)(?:\.|(?!\p{L}))/giu, "")
      .split("–")[0]
      .trim();

    const queries = [
      `${cleanAddress}, ${city}, ${suffix}`,
      `${storeName}, ${city}, ${suffix}`,
      `${transliterate(cleanAddress)}, ${transliterate(city)}, North Macedonia`,
      `${city}, ${suffix}`,
    ].filter((q) => q.length > 10);

    for (const q of queries) {
      console.log(`[GeocoderService] Querying: "${q}"`);
      const result = await this.#search(q);

      if (result) {
        console.log(`[GeocoderService] ✅ Found match via: "${q}"`);
        return [result.lat, result.lon];
      }
    }

    const cityFallback = this.#fallbackFromCity(city, key);
    if (cityFallback) {
      console.warn(
        `[GeocoderService] ⚠️ Using city-center fallback for "${key}" (${city}).`,
      );
      return cityFallback;
    }

    // --- No usable match ---
    console.warn(
      `[GeocoderService] ❌ All queries failed for "${key}". ` +
        "Add coordinates manually to market-coordinates.json.",
    );
    return null;
  }

  #getCity(address) {
    if (!address) return null;
    const cityAliases = [
      ["Скопје", "Skopje"],
      ["Битола", "Bitola"],
      ["Тетово", "Tetovo"],
      ["Куманово", "Kumanovo"],
      ["Гевгелија", "Gevgelija"],
      ["Велес", "Veles"],
      ["Штип", "Stip", "Shtip"],
      ["Струга", "Struga"],
      ["Охрид", "Ohrid"],
      ["Прилеп", "Prilep"],
      ["Кавадарци", "Kavadarci"],
      ["Кичево", "Kicevo", "Kichevo"],
      ["Гостивар", "Gostivar"],
      ["Струмица", "Strumica"],
      ["Кочани", "Kocani", "Kochani"],
      ["Неготино", "Negotino"],
      ["Виница", "Vinica"],
      ["Берово", "Berovo"],
      ["Свети Николе", "Sveti Nikole"],
      ["Демир Хисар", "Demir Hisar"],
      ["Радовиш", "Radovis"],
      ["Пробиштип", "Probistip", "Probishtip"],
      ["Делчево", "Delcevo", "Delchevo"],
      ["Крива Паланка", "Kriva Palanka"],
      ["Дебар", "Debar"],
      ["Ресен", "Resen"],
      ["Валандово", "Valandovo"],
    ];

    const normalized = address.toLowerCase();
    for (const [canonical, ...aliases] of cityAliases) {
      if (
        aliases.some((alias) => normalized.includes(alias.toLowerCase())) ||
        normalized.includes(canonical.toLowerCase())
      ) {
        return canonical;
      }
    }
    return null;
  }

  /** Waits until at least NOMINATIM_MIN_INTERVAL_MS have passed since the last request. */
  async #throttle() {
    const wait = this.#lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - this.now();
    if (wait > 0) await this.sleepFn(wait);
    this.#lastRequestAt = this.now();
  }

  async #search(query, { retriedAfterRateLimit = false } = {}) {
    try {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "mk"); // Lock to Macedonia

      await this.#throttle();
      const response = await fetch(url.toString(), {
        headers: { "User-Agent": "StudentObrok/1.0" },
      });

      if (!response.ok) {
        // Not a "no match": log it so a blocked or failing geocoder is visible.
        console.warn(
          `[GeocoderService] Nominatim returned HTTP ${response.status} for "${query}".`,
        );
        if (response.status === 429 && !retriedAfterRateLimit) {
          await this.sleepFn(NOMINATIM_RATE_LIMIT_BACKOFF_MS);
          return this.#search(query, { retriedAfterRateLimit: true });
        }
        return null;
      }

      const results = await response.json();
      return results.length > 0
        ? { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) }
        : null;
    } catch (err) {
      console.warn(`[GeocoderService] Nominatim request failed for "${query}": ${err.message}`);
      return null;
    }
  }

  #fallbackFromCity(city, key) {
    const center = city ? CITY_FALLBACK_COORDS[city] : null;
    if (!center) return null;

    // Deterministic offset so multiple markets in one city don't stack exactly.
    const hash = this.#hashString(key);
    const angle = ((hash % 360) * Math.PI) / 180;
    const radiusMeters = 80 + (hash % 170); // 80m..249m from city center
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLon =
      111_320 * Math.cos((center[0] * Math.PI) / 180) || 111_320;

    const dLat = (radiusMeters * Math.cos(angle)) / metersPerDegreeLat;
    const dLon = (radiusMeters * Math.sin(angle)) / metersPerDegreeLon;

    return [center[0] + dLat, center[1] + dLon];
  }

  #hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }
}
