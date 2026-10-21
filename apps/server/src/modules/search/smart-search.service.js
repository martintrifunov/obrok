import { haversineDistance } from "../../shared/utils/haversine.js";
import { calculateWeeklyBudget, getMondayOfWeek, getSaturdayOfWeek } from "../../shared/utils/obrokBudget.js";
import { buildWordStartMatcher } from "../../shared/utils/bilingualRegex.js";
import { parsePackSize } from "../../shared/utils/packSize.js";
import {
  todayInAppTimeZone,
  utcDateToLocalCalendarDate,
  utcRangeForCalendarDays,
} from "../../shared/utils/calendarDate.js";

// Used only when no result names the ingredient as a word (e.g. an unusual
// spelling); the hybrid ranking then decides, not the lowest price.
const FALLBACK_RESULTS = 3;
const MAX_MARKETS = 20;
// Within one store, only products this close to its best match for the
// ingredient compete on price, so a cheaper near-miss can't win.
const MARKET_BAND = 0.01;
// Packs under half or over double the usual size for an ingredient (portion
// packs, bulk sizes) don't compete on price per kilogram or litre.
const PACK_RANGE = [0.5, 2];

/**
 * The typical pack of an ingredient across all stores: the median size in its
 * most common unit. Null when too few titles carry a size (eggs, or a few egg
 * dyes among them), in which case package prices are compared as before.
 * @param {{ product?: { title?: string } }[]} candidates
 * @returns {{ amount: number, unit: "g" | "ml" } | null}
 */
export const usualPackSize = (candidates) => {
  const sizes = candidates.map((c) => parsePackSize(c.product?.title || "")).filter(Boolean);
  const packs = sizes.filter((size) => !size.byWeight);
  if (packs.length < 3 || sizes.length * 3 < candidates.length) return null;

  const grams = packs.filter((size) => size.unit === "g");
  const unit = grams.length * 2 >= packs.length ? "g" : "ml";
  const amounts = packs.filter((size) => size.unit === unit).map((size) => size.amount).sort((a, b) => a - b);
  return { amount: amounts[Math.floor(amounts.length / 2)], unit };
};

/**
 * Cheapest per kilogram or litre among packs near the usual size; package price
 * when no option has a comparable size. A price per kilogram counts as a 1 kg pack.
 * @template {{ price: number, product?: { title?: string } }} T
 * @param {T[]} options
 * @param {{ amount: number, unit: string } | null} usual
 * @returns {T}
 */
export const cheapestSensiblePack = (options, usual) => {
  const cheapest = (list, key) => list.reduce((a, b) => (key(b) < key(a) ? b : a));
  if (!usual) return cheapest(options, (o) => o.price);

  const [low, high] = PACK_RANGE.map((f) => f * usual.amount);
  const sized = [];
  const unknown = [];
  for (const option of options) {
    const size = parsePackSize(option.product?.title || "");
    if (!size) unknown.push(option);
    else if (size.unit === usual.unit && size.amount >= low && size.amount <= high) {
      sized.push({ option, perUnit: option.price / size.amount });
    }
  }
  if (sized.length) return cheapest(sized, (s) => s.perUnit).option;
  if (unknown.length) return cheapest(unknown, (o) => o.price);
  return cheapest(options, (o) => o.price);
};

// Stores of one chain usually share a pricelist; show a few, not twenty.
const MAX_MARKETS_PER_CHAIN = 3;

/**
 * @template {{ market: { _id?: any, chain?: any } }} T
 * @param {T[]} markets best first
 * @returns {T[]}
 */
export const limitPerChain = (markets) => {
  const perChain = new Map();
  return markets.filter(({ market }) => {
    const chain = String(market.chain?._id ?? market.chain ?? market._id);
    const count = perChain.get(chain) || 0;
    perChain.set(chain, count + 1);
    return count < MAX_MARKETS_PER_CHAIN;
  });
};

/**
 * @param {string} ingredient
 * @param {Array<{ product: { title?: string }, marketProducts: Array<{ price: number, market?: any }> }>} results
 */
export const pickIngredientCandidates = (ingredient, results) => {
  const matches = buildWordStartMatcher(ingredient);
  const strict = results.filter((r) => matches(r.product?.title || ""));
  if (strict.length) return { results: strict, strict: true };
  return { results: results.slice(0, FALLBACK_RESULTS), strict: false };
};

export class SmartSearchService {
  constructor(intentParserService, searchService, featureFlagService, publicHolidayService, analyticsService = null) {
    this.intentParserService = intentParserService;
    this.searchService = searchService;
    this.featureFlagService = featureFlagService;
    this.publicHolidayService = publicHolidayService;
    this.analyticsService = analyticsService;
  }

  async getBudget() {
    return { data: await this.#computeBudget() };
  }

  async search({ q, lat, lon, budgetOnly, analytics = null }) {
    const isEnabled = await this.featureFlagService.isEnabled("smart-search");
    if (!isEnabled) {
      return { data: null, error: "Smart search is not enabled." };
    }

    await this.analyticsService?.trackFeatureUsage({
      visitorId: analytics?.visitorId,
      userId: analytics?.userId,
      feature: "smart-search",
      path: analytics?.path,
    });

    if (!this.intentParserService.isAvailable()) {
      return { data: null, error: "AI service is not configured." };
    }

    const intent = await this.intentParserService.parseIntent(q);

    // For simple search intents, fall back to the regular search
    if (intent.intent !== "recipe" || intent.products.length === 0) {
      return { data: null, redirect: true, intent };
    }

    const [ingredients, budget] = await Promise.all([
      Promise.all(intent.products.map((name) => this.findIngredient(name))),
      this.#computeBudget(),
    ]);
    const { weeklyBudget } = budget;

    // Found means some market sells it.
    const shoppingList = ingredients.map(({ name, offers }) => ({
      name,
      found: offers.size > 0,
    }));

    /** @type {Map<string, { market: any, products: any[] }>} */
    const byMarket = new Map();
    for (const { name, offers } of ingredients) {
      for (const [mid, { market, product, price }] of offers) {
        if (!byMarket.has(mid)) byMarket.set(mid, { market, products: [] });
        byMarket.get(mid).products.push({
          name,
          title: product?.title || name,
          price,
          image: product?.image || null,
        });
      }
    }

    const hasUserLocation = lat != null && lon != null;
    const totalProducts = intent.products.length;

    const rankedMarkets = [...byMarket.values()].map(({ market, products }) => {
      let runningTotal = 0;
      for (const p of products) {
        runningTotal += p.price;
        p.overflow = runningTotal > weeklyBudget;
      }
      const totalPrice = Math.round(runningTotal);

      let distance = null;
      if (hasUserLocation && market.location?.length === 2) {
        const [mLat, mLon] = market.location;
        distance = Math.round(haversineDistance(lat, lon, mLat, mLon));
      }

      return {
        market,
        matchCount: products.length,
        totalProducts,
        complete: products.length === totalProducts,
        totalPrice,
        distance,
        products,
        withinBudget: totalPrice <= weeklyBudget,
        overBudgetAmount: Math.max(0, totalPrice - weeklyBudget),
      };
    });

    // Sort: complete first → within-budget first → matchCount → distance → price
    rankedMarkets.sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1;
      if (a.withinBudget !== b.withinBudget) return a.withinBudget ? -1 : 1;
      if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      if (a.distance !== null && b.distance !== null) {
        if (a.distance !== b.distance) return a.distance - b.distance;
      }
      return a.totalPrice - b.totalPrice;
    });

    // Filter to within-budget only if requested
    const filteredMarkets = budgetOnly
      ? rankedMarkets.filter((m) => m.withinBudget)
      : rankedMarkets;

    // Find the nearest complete-match market for routing suggestion
    const nearestComplete =
      hasUserLocation &&
      filteredMarkets.find((m) => m.complete && m.distance !== null);

    return {
      data: {
        shoppingList,
        markets: limitPerChain(filteredMarkets).slice(0, MAX_MARKETS),
        nearestMarket: nearestComplete || null,
        query: q,
        priceSort: intent.priceSort || "asc",
        ...budget,
      },
    };
  }

  /**
   * @param {string} name
   * @returns {Promise<{ name: string, strict: boolean, usual: { amount: number, unit: string } | null, offers: Map<string, { market: any, product: any, price: number }> }>}
   */
  async findIngredient(name) {
    const { results, strict, scored } = await this.#ingredientCandidates(name);

    /** @type {Map<string, { market: any, product: any, price: number, score: number }[]>} */
    const byMarket = new Map();
    for (const candidate of results) {
      for (const mp of candidate.marketProducts) {
        if (!mp.market?._id) continue;
        const mid = mp.market._id.toString();
        if (!byMarket.has(mid)) byMarket.set(mid, []);
        byMarket.get(mid).push({
          market: mp.market,
          product: candidate.product,
          price: mp.price,
          score: candidate.score ?? 0,
        });
      }
    }

    const usual = scored ? usualPackSize(results) : null;
    const offers = new Map();
    for (const [mid, options] of byMarket) {
      offers.set(mid, this.#pickOffer(options, { strict, scored, usual }));
    }
    return { name, strict, usual, offers };
  }

  /**
   * @param {{ market: any, product: any, price: number, score: number }[]} options in rank order
   * @param {{ strict: boolean, scored: boolean, usual: { amount: number, unit: string } | null }} mode
   */
  #pickOffer(options, { strict, scored, usual }) {
    // Fallback results (no real match): keep the best-ranked, not the cheapest.
    if (!strict) return options[0];
    let eligible = options;
    if (scored) {
      const best = Math.max(...options.map((o) => o.score));
      eligible = options.filter((o) => o.score >= best - MARKET_BAND);
    }
    const { market, product, price } = cheapestSensiblePack(eligible, usual);
    return { market, product, price };
  }

  async #ingredientCandidates(name) {
    const byVector = await this.searchService.findIngredientCandidates(name);
    if (byVector) return { results: byVector, strict: true, scored: true };

    // No vector index: word matches over the hybrid results.
    const result = await this.searchService.searchProducts({ q: name, page: 1, limit: 20 });
    return { ...pickIngredientCandidates(name, result.data), scored: false };
  }

  async #computeBudget() {
    const today = todayInAppTimeZone();

    let holidayDates = [];
    if (this.publicHolidayService) {
      const { from, to } = utcRangeForCalendarDays(getMondayOfWeek(today), getSaturdayOfWeek(today));
      const holidays = await this.publicHolidayService.getHolidaysByDateRange(from, to);
      holidayDates = holidays.map((h) => utcDateToLocalCalendarDate(new Date(h.date)));
    }

    const { budget, workDays, holidays, segments } = calculateWeeklyBudget(today, holidayDates);
    return { weeklyBudget: budget, budgetInfo: { workDays, holidays, segments } };
  }
}
