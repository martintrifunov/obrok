import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../../../../.env") });

import mongoose from "mongoose";
import { EmbeddingService } from "../modules/search/embedding.service.js";
import { IntentParserService } from "../modules/search/intent-parser.service.js";
import { MealIntentRepository } from "../modules/search/meal-intent.repository.js";
import { ProductEmbeddingRepository } from "../modules/search/product-embedding.repository.js";
import { VectorIndex } from "../modules/search/vector-index.js";
import { SearchService } from "../modules/search/search.service.js";
import { SmartSearchService } from "../modules/search/smart-search.service.js";
import "../modules/market/market.model.js";
import "../modules/chain/chain.model.js";
import "../modules/image/image.model.js";
import { searchCases, ingredientCases, mealCases } from "./search-eval/cases.js";

const TOP_K = 5;
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith("--"));
const skipMeals = args.includes("--no-meals");
const jsonOut = args.find((a) => a.startsWith("--json="))?.slice("--json=".length);

const calls = { llm: 0, embedding: 0 };
const count = (obj, method, key) => {
  const original = obj[method].bind(obj);
  obj[method] = (...a) => {
    calls[key]++;
    return original(...a);
  };
};

const timed = async (fn) => {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
};

/**
 * @param {string} title
 * @param {{ expect: RegExp, forbid?: RegExp }} testCase
 */
const relevant = (title, { expect, forbid }) =>
  expect.test(title) && !(forbid && forbid.test(title));

const bestPrice = (result) =>
  result.marketProducts.length ? Math.min(...result.marketProducts.map((mp) => mp.price)) : Infinity;

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

async function evalSearch(searchService) {
  const rows = [];
  for (const c of searchCases) {
    if (only && !c.q.includes(only)) continue;
    const { value, ms } = await timed(() =>
      searchService.searchProducts({ q: c.q, page: 1, limit: 10 }),
    );
    const titles = value.data.slice(0, TOP_K).map((r) => r.product?.title || "");
    const hits = titles.filter((t) => relevant(t, c)).length;
    let priceOk = null;
    if (c.priceSort) {
      const page2 = await searchService.searchProducts({ q: c.q, page: 2, limit: 10 });
      const p1 = value.data.map(bestPrice);
      const p2 = page2.data.map(bestPrice);
      priceOk =
        value.priceSort === c.priceSort &&
        (c.priceSort === "asc"
          ? Math.max(...p1) <= Math.min(...p2)
          : Math.min(...p1) >= Math.max(...p2));
    }
    rows.push({ q: c.q, precision: titles.length ? hits / TOP_K : 0, priceOk, ms, titles });
  }
  return rows;
}

async function evalIngredients(smartSearchService) {
  const rows = [];
  for (const c of ingredientCases) {
    if (only && !c.name.includes(only)) continue;
    const { value, ms } = await timed(() => smartSearchService.findIngredient(c.name));
    const picks = [...value.offers.values()];
    const good = picks.filter((o) => relevant(o.product?.title || "", c)).length;
    const titles = [...new Set(picks.map((o) => o.product?.title || ""))];
    rows.push({
      q: c.name,
      precision: picks.length ? good / picks.length : 0,
      markets: picks.length,
      ms,
      titles: titles.filter((t) => !relevant(t, c)).slice(0, 4),
    });
  }
  return rows;
}

async function evalMeals(intentParserService) {
  const rows = [];
  for (const c of mealCases) {
    if (only && !c.q.includes(only)) continue;
    const { value, ms } = await timed(() => intentParserService.parseIntent(c.q));
    const products = value.products || [];
    const found = c.expect.filter((e) => products.some((p) => new RegExp(e, "i").test(p))).length;
    rows.push({
      q: c.q,
      precision: c.expect.length ? found / c.expect.length : 0,
      intentOk: value.intent === "recipe",
      ms,
      titles: products,
    });
  }
  return rows;
}

const pct = (x) => `${Math.round(x * 100)}%`;
const mean = (rows) => (rows.length ? rows.reduce((s, r) => s + r.precision, 0) / rows.length : 0);

/**
 * @param {string} label
 * @param {any[]} rows
 * @param {(row: any) => string} [extra]
 */
function report(label, rows, extra = () => "") {
  if (!rows.length) return;
  console.log(`\n## ${label}`);
  for (const r of rows) {
    const flag = r.precision === 1 && r.priceOk !== false && r.intentOk !== false ? "ok " : "BAD";
    console.log(`${flag} ${pct(r.precision).padStart(4)} ${String(r.ms).padStart(5)}ms  ${r.q}${extra(r)}`);
    if (flag === "BAD") console.log(`      ${r.titles.slice(0, TOP_K).join(" | ").slice(0, 220)}`);
  }
  const ms = rows.map((r) => r.ms);
  console.log(`=> precision ${pct(mean(rows))}, latency p50 ${percentile(ms, 50)}ms p90 ${percentile(ms, 90)}ms`);
}

async function main() {
  await mongoose.connect(process.env.DATABASE_URI || process.env.MONGO_URI_LOCAL);

  const embeddingService = new EmbeddingService();
  const intentParserService = new IntentParserService(
    args.includes("--no-meal-cache") ? null : new MealIntentRepository(),
  );
  count(embeddingService, "generateEmbedding", "embedding");
  if (intentParserService.client) count(intentParserService.client.models, "generateContent", "llm");

  const alwaysOn = { isEnabled: async () => true };
  const vectorIndex = new VectorIndex(new ProductEmbeddingRepository());
  await vectorIndex.load();

  const searchService = new SearchService(
    embeddingService,
    vectorIndex,
    alwaysOn,
  );
  const smartSearchService = new SmartSearchService(intentParserService, searchService, alwaysOn, null);

  const search = await evalSearch(searchService);
  const searchCalls = { ...calls };
  const ingredients = await evalIngredients(smartSearchService);
  const meals = skipMeals ? [] : await evalMeals(intentParserService);

  report("Product search (precision@5)", search, (r) =>
    r.priceOk === null ? "" : r.priceOk ? "  [price order ok]" : "  [PRICE ORDER WRONG]",
  );
  report("Meal ingredient picks (share of markets priced with a right product)", ingredients, (r) =>
    `  (${r.markets} markets)`,
  );
  report("Meal decomposition", meals, (r) => (r.intentOk ? "" : "  [NOT RECIPE]"));

  console.log(
    `\nAPI calls: product search ${searchCalls.llm} LLM + ${searchCalls.embedding} embedding for ${search.length} queries; ` +
      `total ${calls.llm} LLM, ${calls.embedding} embedding`,
  );

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ search, ingredients, meals, calls }, null, 2));
    console.log(`Saved ${jsonOut}`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
