import { haversineDistance } from "../../shared/utils/haversine.js";
import { calculateWeeklyBudget } from "../../shared/utils/obrokBudget.js";
import { buildWordStartMatcher } from "../../shared/utils/bilingualRegex.js";
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
    const budget = await this.#computeBudget();
    return {
      data: {
        weeklyBudget: budget.weeklyBudget,
        budgetInfo: {
          workDays: budget.budgetInfo.workDays,
          holidays: budget.budgetInfo.holidays,
          segments: budget.budgetInfo.segments,
        },
      },
    };
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

    const ingredients = await Promise.all(
      intent.products.map((name) => this.findIngredient(name)),
    );

    // Build a shopping list with match status: found means some market sells it.
    const shoppingList = ingredients.map(({ name, offers }) => ({
      name,
      found: offers.size > 0,
    }));

    // Structure: Map<marketId, { market, products: Map<productName, { product, price }> }>
    const marketMap = new Map();
    for (const { name, offers } of ingredients) {
      for (const [mid, offer] of offers) {
        if (!marketMap.has(mid)) {
          marketMap.set(mid, { market: offer.market, products: new Map() });
        }
        marketMap.get(mid).products.set(name, {
          product: offer.product,
          price: offer.price,
        });
      }
    }

    const hasUserLocation =
      lat !== undefined && lat !== null && lon !== undefined && lon !== null;

    // Score and rank markets
    const rankedMarkets = Array.from(marketMap.values()).map((entry) => {
      const matchCount = entry.products.size;
      const totalProducts = intent.products.length;
      const complete = matchCount === totalProducts;

      let totalPrice = 0;
      const productDetails = [];
      for (const [name, info] of entry.products) {
        totalPrice += info.price;
        productDetails.push({
          name,
          title: info.product?.title || name,
          price: info.price,
          image: info.product?.image || null,
        });
      }

      let distance = null;
      if (hasUserLocation && entry.market.location?.length === 2) {
        const [mLat, mLon] = entry.market.location;
        distance = Math.round(haversineDistance(lat, lon, mLat, mLon));
      }

      return {
        market: entry.market,
        matchCount,
        totalProducts,
        complete,
        totalPrice: Math.round(totalPrice),
        distance,
        products: productDetails,
        // Set below once the weekly budget is known.
        withinBudget: false,
        overBudgetAmount: 0,
      };
    });

    const { weeklyBudget, budgetInfo } = await this.#computeBudget();

    // Add budget fields to each market
    for (const m of rankedMarkets) {
      m.withinBudget = m.totalPrice <= weeklyBudget;
      m.overBudgetAmount = m.totalPrice > weeklyBudget
        ? m.totalPrice - weeklyBudget
        : 0;

      let runningTotal = 0;
      for (const p of m.products) {
        runningTotal += p.price;
        p.overflow = runningTotal > weeklyBudget;
      }
    }

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
        weeklyBudget,
        budgetInfo: {
          workDays: budgetInfo.workDays,
          holidays: budgetInfo.holidays,
          segments: budgetInfo.segments,
        },
      },
    };
  }

  /**
   * @param {string} name
   * @returns {Promise<{ name: string, strict: boolean, offers: Map<string, { market: any, product: any, price: number }> }>}
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

    const offers = new Map();
    for (const [mid, options] of byMarket) {
      offers.set(mid, this.#pickOffer(options, { strict, scored }));
    }
    return { name, strict, offers };
  }

  /**
   * @param {{ market: any, product: any, price: number, score: number }[]} options in rank order
   * @param {{ strict: boolean, scored: boolean }} mode
   */
  #pickOffer(options, { strict, scored }) {
    // Fallback results (no real match): keep the best-ranked, not the cheapest.
    if (!strict) return options[0];
    let eligible = options;
    if (scored) {
      const best = Math.max(...options.map((o) => o.score));
      eligible = options.filter((o) => o.score >= best - MARKET_BAND);
    }
    const { market, product, price } = eligible.reduce((a, b) => (b.price < a.price ? b : a));
    return { market, product, price };
  }

  async #ingredientCandidates(name) {
    const byVector = await this.searchService.findIngredientCandidates?.(name);
    if (byVector) return { results: byVector, strict: true, scored: true };

    // No vector index: word matches over the hybrid results.
    const result = await this.searchService.searchProducts({ q: name, page: 1, limit: 20 });
    return { ...pickIngredientCandidates(name, result.data), scored: false };
  }

  #getMondayOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (dow - 1));
    return d;
  }

  async #computeBudget() {
    const today = todayInAppTimeZone();
    const monday = this.#getMondayOfWeek(today);
    const saturday = new Date(monday);
    saturday.setDate(saturday.getDate() + 5);

    let holidayDates = [];
    if (this.publicHolidayService) {
      const { from, to } = utcRangeForCalendarDays(monday, saturday);
      const holidays = await this.publicHolidayService.getHolidaysByDateRange(from, to);
      holidayDates = holidays.map((h) => utcDateToLocalCalendarDate(new Date(h.date)));
    }

    const budgetInfo = calculateWeeklyBudget(today, holidayDates);
    return {
      weeklyBudget: budgetInfo.budget,
      budgetInfo,
    };
  }
}
