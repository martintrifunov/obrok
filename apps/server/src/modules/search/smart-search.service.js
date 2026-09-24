import { haversineDistance } from "../../shared/utils/haversine.js";
import { calculateWeeklyBudget } from "../../shared/utils/obrokBudget.js";

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

    // Search for each product in parallel
    const productSearches = await Promise.all(
      intent.products.map(async (productName) => {
        const result = await this.searchService.searchProducts({
          q: productName,
          page: 1,
          limit: 20,
          parseIntent: false,
        });
        return { name: productName, results: result.data };
      }),
    );

    // Build a shopping list with match status
    const shoppingList = productSearches.map((ps) => ({
      name: ps.name,
      found: ps.results.length > 0,
    }));

    // Collect all markets that carry at least one product
    // Structure: Map<marketId, { market, products: Map<productName, { product, price }> }>
    const marketMap = new Map();

    for (const ps of productSearches) {
      for (const result of ps.results) {
        for (const mp of result.marketProducts) {
          if (!mp.market?._id) continue;
          const mid = mp.market._id.toString();

          if (!marketMap.has(mid)) {
            marketMap.set(mid, {
              market: mp.market,
              products: new Map(),
            });
          }

          const entry = marketMap.get(mid);
          const existing = entry.products.get(ps.name);

          // Keep the cheapest option per product per market
          if (!existing || mp.price < existing.price) {
            entry.products.set(ps.name, {
              product: result.product,
              price: mp.price,
            });
          }
        }
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
        markets: filteredMarkets.slice(0, 20),
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

  #getMondayOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (dow - 1));
    return d;
  }

  async #computeBudget() {
    const now = new Date();
    const monday = this.#getMondayOfWeek(now);
    const saturday = new Date(monday);
    saturday.setDate(saturday.getDate() + 5);

    let holidayDates = [];
    if (this.publicHolidayService) {
      const holidays = await this.publicHolidayService.getHolidaysByDateRange(monday, saturday);
      holidayDates = holidays.map((h) => h.date);
    }

    const budgetInfo = calculateWeeklyBudget(now, holidayDates);
    return {
      weeklyBudget: budgetInfo.budget,
      budgetInfo,
    };
  }
}
