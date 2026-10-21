import { VeroScraper } from "./markets/vero.scraper.js";
import { RamstoreScraper } from "./markets/ramstore.scraper.js";
import { StokomakScraper } from "./markets/stokomak.scraper.js";
import { KamScraper } from "./markets/kam.scraper.js";
import { SuperKitGoScraper } from "./markets/superkitgo.scraper.js";

const SCRAPERS = {
  vero: VeroScraper,
  ramstore: RamstoreScraper,
  stokomak: StokomakScraper,
  kam: KamScraper,
  superkitgo: SuperKitGoScraper,
};

export const SCRAPER_KEYS = Object.keys(SCRAPERS);

export const createScraper = (key) => (SCRAPERS[key] ? new SCRAPERS[key]() : null);

export const createAllScrapers = () => SCRAPER_KEYS.map(createScraper);
