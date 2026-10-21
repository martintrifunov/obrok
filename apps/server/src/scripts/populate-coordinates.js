/**
 * Populate market-coordinates.json using Google Geocoding API (with Nominatim fallback).
 *
 * Usage:
 *   node src/scripts/populate-coordinates.js [--force] [chain]
 *
 * Preferred provider: Google Geocoding API (set GOOGLE_MAPS_API_KEY).
 * Fallback provider: OpenStreetMap Nominatim.
 * Will NOT overwrite existing entries unless --force is passed.
 * Post-processing spreads duplicate coordinates via small jitter (~30 m).
 *
 * Examples:
 *   node src/scripts/populate-coordinates.js          # all chains
 *   node src/scripts/populate-coordinates.js vero     # only Vero
 *   node src/scripts/populate-coordinates.js --force  # re-geocode everything
 */
import "./load-env.js";
import path from "path";
import fs from "fs";
import puppeteer from "puppeteer";

import {
  createScraper,
  SCRAPER_KEYS,
} from "../modules/scraper/scraper.registry.js";
import { normalizeMarketName } from "../modules/scraper/normalize-market-name.js";

const COORDS_PATH = path.resolve(import.meta.dirname, "../data/market-coordinates.json");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY?.trim();

// Macedonian Cyrillic → Latin transliteration (multi-char digraphs first)
const CYR_TO_LAT = [
  ["Љ", "Lj"], ["Њ", "Nj"], ["Џ", "Dzh"], ["Ѓ", "Gj"], ["Ќ", "Kj"],
  ["Ѕ", "Dz"], ["Ж", "Zh"], ["Ч", "Ch"], ["Ш", "Sh"],
  ["љ", "lj"], ["њ", "nj"], ["џ", "dzh"], ["ѓ", "gj"], ["ќ", "kj"],
  ["ѕ", "dz"], ["ж", "zh"], ["ч", "ch"], ["ш", "sh"],
  ["А", "A"], ["Б", "B"], ["В", "V"], ["Г", "G"], ["Д", "D"], ["Е", "E"],
  ["З", "Z"], ["И", "I"], ["Ј", "J"], ["К", "K"], ["Л", "L"], ["М", "M"],
  ["Н", "N"], ["О", "O"], ["П", "P"], ["Р", "R"], ["С", "S"], ["Т", "T"],
  ["У", "U"], ["Ф", "F"], ["Х", "H"], ["Ц", "C"],
  ["а", "a"], ["б", "b"], ["в", "v"], ["г", "g"], ["д", "d"], ["е", "e"],
  ["з", "z"], ["и", "i"], ["ј", "j"], ["к", "k"], ["л", "l"], ["м", "m"],
  ["н", "n"], ["о", "o"], ["п", "p"], ["р", "r"], ["с", "s"], ["т", "t"],
  ["у", "u"], ["ф", "f"], ["х", "h"], ["ц", "c"],
];

const transliterate = (text) => {
  let result = text;
  result = result.replace(/Бул\./g, "Bulevar").replace(/бул\./g, "bulevar");
  result = result.replace(/Ул\./g, "Ulica").replace(/ул\./g, "ulica");
  result = result.replace(/бр\.\s*/g, "");
  for (const [cyr, lat] of CYR_TO_LAT) {
    result = result.replaceAll(cyr, lat);
  }
  return result;
};

const CITY_FALLBACK = {
  "Скопје": [41.9981, 21.4254], "Битола": [41.0317, 21.3347],
  "Тетово": [42.0097, 20.9716], "Куманово": [42.1322, 21.7144],
  "Велес": [41.7156, 21.7753], "Штип": [41.7458, 22.1958],
  "Охрид": [41.1172, 20.8016], "Прилеп": [41.3451, 21.5550],
  "Кичево": [41.5127, 20.9586], "Гостивар": [41.8000, 20.9167],
  "Струмица": [41.4378, 22.6427], "Гевгелија": [41.1417, 22.5025],
  "Кавадарци": [41.4334, 22.0089], "Струга": [41.1778, 20.6786],
  "Кочани": [41.9164, 22.4128], "Неготино": [41.4833, 22.0833],
  "Радовиш": [41.6383, 22.4678], "Ресен": [41.0893, 21.0109],
  "Виница": [41.8828, 22.5092], "Берово": [41.7031, 22.8578],
  "Свети Николе": [41.8696, 21.9527], "Демир Хисар": [41.2217, 21.2031],
  "Пробиштип": [41.9957, 22.1794], "Делчево": [41.9664, 22.7746],
  "Крива Паланка": [42.2015, 22.3308], "Дебар": [41.5244, 20.5242],
  "Валандово": [41.3174, 22.5600],
};

const CITY_ALIASES = {
  "Скопје": ["Skopje"],
  "Битола": ["Bitola"],
  "Тетово": ["Tetovo"],
  "Куманово": ["Kumanovo"],
  "Велес": ["Veles"],
  "Штип": ["Stip", "Shtip"],
  "Охрид": ["Ohrid"],
  "Прилеп": ["Prilep"],
  "Кичево": ["Kicevo", "Kichevo"],
  "Гостивар": ["Gostivar"],
  "Струмица": ["Strumica"],
  "Гевгелија": ["Gevgelija"],
  "Кавадарци": ["Kavadarci"],
  "Струга": ["Struga"],
  "Кочани": ["Kocani", "Kochani"],
  "Неготино": ["Negotino"],
  "Радовиш": ["Radovis"],
  "Ресен": ["Resen"],
  "Виница": ["Vinica"],
  "Берово": ["Berovo"],
  "Свети Николе": ["Sveti Nikole"],
  "Демир Хисар": ["Demir Hisar"],
  "Пробиштип": ["Probistip", "Probishtip"],
  "Делчево": ["Delcevo", "Delchevo"],
  "Крива Паланка": ["Kriva Palanka"],
  "Дебар": ["Debar"],
  "Валандово": ["Valandovo"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsWholeWord = (text, term) => {
  if (!text || !term) return false;
  const pattern = new RegExp(
    `(^|[^\\p{L}])${escapeRegex(term.toLowerCase())}($|[^\\p{L}])`,
    "u",
  );
  return pattern.test(text.toLowerCase());
};

const normalizeAddress = (value = "") =>
  value
    .replace(/[’']/g, "")
    .replace(/\b(Бул\.?|Ул\.?|ул\.?|бул\.?|улица|булевар)\b/gi, " ")
    .replace(/\bбр\.?\s*/gi, " ")
    .replace(/\bbb\b/gi, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/[–-].*$/, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();

const stripTrailingCity = (address, city) => {
  if (!city) return address;

  const aliases = [city, ...(CITY_ALIASES[city] || [])]
    .slice()
    .sort((a, b) => b.length - a.length);

  let out = address;
  for (const alias of aliases) {
    out = out.replace(new RegExp(`,?\\s*${escapeRegex(alias)}\\s*$`, "i"), "");
  }

  return out.replace(/,+$/, "").trim();
};

const resultMatchesCity = (result, city) => {
  if (!city) return true;

  const aliases = [city, ...(CITY_ALIASES[city] || [])].map((s) => s.toLowerCase());
  const fields = [
    result?.display_name || "",
    ...(result?.address ? Object.values(result.address) : []),
  ]
    .join(" ")
    .toLowerCase();

  return aliases.some((alias) => fields.includes(alias));
};

const resultMatchesCityGoogle = (result, city) => {
  if (!city) return true;

  const aliases = [city, ...(CITY_ALIASES[city] || []), transliterate(city)].map((s) =>
    s.toLowerCase(),
  );

  const fields = [
    result?.formatted_address || "",
    ...((result?.address_components || []).map((part) => part?.long_name || "")),
  ]
    .join(" ")
    .toLowerCase();

  return aliases.some((alias) => containsWholeWord(fields, alias));
};

const loadCoords = () => {
  try {
    return JSON.parse(fs.readFileSync(COORDS_PATH, "utf-8"));
  } catch {
    return {};
  }
};

const saveCoords = (coords) => {
  fs.writeFileSync(COORDS_PATH, JSON.stringify(coords, null, 2) + "\n", "utf-8");
};

const nominatimSearch = async (query, city) => {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "3");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "mk");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "obrok-coords/1.0" },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;

  const match = data.find((candidate) => resultMatchesCity(candidate, city));
  if (!match) return null;

  return [parseFloat(match.lat), parseFloat(match.lon)];
};

const googleGeocodeSearch = async (query, city) => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  url.searchParams.set("region", "mk");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK" || !Array.isArray(data.results) || !data.results.length) {
    return null;
  }

  const match = data.results.find((candidate) => resultMatchesCityGoogle(candidate, city));
  if (!match?.geometry?.location) return null;

  return [parseFloat(match.geometry.location.lat), parseFloat(match.geometry.location.lng)];
};

const extractCity = (address) => {
  if (!address) return null;

  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates = [
    parts.at(-1),
    parts.length > 1 ? parts.slice(-2).join(" ") : null,
    address,
  ].filter(Boolean);

  for (const candidate of candidates) {
    for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
      const names = [city, ...aliases];
      if (names.some((name) => containsWholeWord(candidate, name))) {
        return city;
      }
    }
  }

  return null;
};

const buildQueries = (market, chainName) => {
  const rawAddress = market.address || market.name || "";
  const city = extractCity(`${market.name || ""}, ${rawAddress}`);

  const cleanAddress = normalizeAddress(rawAddress);
  const addressNoCity = stripTrailingCity(cleanAddress, city);

  const branchLabel = normalizeAddress(
    (market.name || "").replace(/^СУПЕР\s+КИТ-ГО\s*/i, ""),
  );

  const cityLatin = city ? transliterate(city) : "";
  const addressLatin = transliterate(addressNoCity || cleanAddress);
  const branchLatin = transliterate(branchLabel);
  const isSuperKitGo = /kit-go/i.test(chainName);

  const querySet = new Set([
    cityLatin ? `${addressLatin}, ${cityLatin}, North Macedonia` : null,
    `${addressLatin}, North Macedonia`,
    `${chainName} ${cityLatin || addressLatin}, North Macedonia`,
    cityLatin ? `${cityLatin}, North Macedonia` : null,
  ]);

  if (isSuperKitGo) {
    querySet.add(branchLatin ? `${branchLatin}, ${cityLatin}, North Macedonia` : null);
    querySet.add(
      branchLatin ? `Super Kit-Go ${branchLatin}, ${cityLatin}, North Macedonia` : null,
    );
    querySet.add(
      cityLatin && branchLatin
        ? `Super Kit-Go ${branchLatin} ${cityLatin}, North Macedonia`
        : null,
    );
  }

  return [...querySet].filter((q) => q && q.length > 10 && !q.includes(", ,"));
};

const geocodeMarket = async (market, chainName) => {
  const queries = buildQueries(market, chainName);
  const city = extractCity(`${market.name || ""}, ${market.address || ""}`);

  for (const q of queries) {
    const googleResult = await googleGeocodeSearch(q, city);
    if (googleResult) return { coords: googleResult, query: q, provider: "google" };

    const nominatimResult = await nominatimSearch(q, city);
    if (nominatimResult) {
      return { coords: nominatimResult, query: q, provider: "nominatim" };
    }

    await sleep(1100);
  }

  // City-center fallback
  if (city && CITY_FALLBACK[city]) {
    return { coords: CITY_FALLBACK[city], fallback: true, query: city };
  }

  return null;
};

const jitterDuplicates = (coords) => {
  const JITTER_RADIUS = 0.0003; // ~30 m
  const byCoord = {};

  for (const [key, val] of Object.entries(coords)) {
    const ck = val[0].toFixed(7) + "," + val[1].toFixed(7);
    (byCoord[ck] ??= []).push(key);
  }

  let jittered = 0;
  for (const group of Object.values(byCoord)) {
    if (group.length < 2) continue;
    const [baseLat, baseLng] = coords[group[0]];
    for (let i = 0; i < group.length; i++) {
      const angle = (2 * Math.PI * i) / group.length;
      coords[group[i]] = [
        +(baseLat + JITTER_RADIUS * Math.cos(angle)).toFixed(7),
        +(baseLng + JITTER_RADIUS * Math.sin(angle)).toFixed(7),
      ];
      jittered++;
    }
  }

  return jittered;
};

const main = async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const target = args.find((a) => a !== "--force")?.toLowerCase();

  if (target && !SCRAPER_KEYS.includes(target)) {
    console.error(
      `[populate] Unknown chain "${target}". Available: ${SCRAPER_KEYS.join(", ")}`,
    );
    process.exit(1);
  }

  const chainKeys = target ? [target] : SCRAPER_KEYS;
  const coords = loadCoords();
  const successes = [];
  const failures = [];
  const skipped = [];

  if (GOOGLE_MAPS_API_KEY) {
    console.log("[populate] Geocoder provider: Google (Nominatim fallback enabled).");
  } else {
    console.warn(
      "[populate] GOOGLE_MAPS_API_KEY is not set. Falling back to Nominatim only.",
    );
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const chainKey of chainKeys) {
      const scraper = createScraper(chainKey);
      console.log(`\n[populate] Fetching markets for ${chainKey}...`);

      const page = await browser.newPage();
      let markets;
      try {
        markets = await scraper.fetchMarkets(page);
      } catch (err) {
        console.error(`[populate] Failed to fetch markets for ${chainKey}:`, err.message);
        await page.close();
        continue;
      }
      await page.close();

      console.log(`[populate] Found ${markets.length} markets for ${chainKey}.`);

      for (const market of markets) {
        const key = normalizeMarketName(market.name);

        if (coords[key] && !force) {
          skipped.push(key);
          continue;
        }

        const result = await geocodeMarket(market, scraper.chainName);

        if (result) {
          coords[key] = result.coords;
          saveCoords(coords);
          successes.push(key);
          const tag = result.fallback ? "⚠️  city-center fallback" : "✅";
          const via = result.fallback
            ? result.query
            : `${result.query} (${result.provider || "city-fallback"})`;
          console.log(`  ${tag} ${key}: [${result.coords}] via "${via}"`);
        } else {
          failures.push(key);
          console.log(`  ❌ ${key}: No result`);
        }

        await sleep(1100);
      }
    }
  } finally {
    await browser.close();
  }

  // Spread markets sharing identical coordinates in a small circle
  const jittered = jitterDuplicates(coords);
  if (jittered > 0) {
    saveCoords(coords);
    console.log(`\n[populate] Jittered ${jittered} markets sharing duplicate coordinates.`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("[populate] DONE");
  console.log(`  ✅ Geocoded: ${successes.length}`);
  console.log(`  ⏭  Skipped (already in JSON): ${skipped.length}`);
  console.log(`  ❌ Failed: ${failures.length}`);

  if (failures.length > 0) {
    console.log("\nFailed markets (add manually to market-coordinates.json):");
    for (const key of failures) {
      console.log(`  "${key}": [LAT, LON],`);
    }
  }

  console.log(`\nCoordinates file: ${COORDS_PATH}`);
  console.log(`Total entries: ${Object.keys(coords).length}`);
};

main().catch((err) => {
  console.error("[populate] Fatal error:", err);
  process.exit(1);
});
