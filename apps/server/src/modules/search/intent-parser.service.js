import { GoogleGenAI, Type } from "@google/genai";
import { parseSearchQuery, mealCacheKey } from "./query-rules.js";

// Cheapest first; the second is a fallback if the first is unavailable.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const MEMORY_CACHE_SIZE = 500;
const MAX_INGREDIENTS = 10;

const SYSTEM_PROMPT = `Split a Macedonian meal request into the groceries needed to make it.
Input is Macedonian in Cyrillic or Latin script.
- intent: "recipe" if the text names a dish or meal; otherwise "search" with no products.
- products: each grocery item once, in Macedonian Cyrillic, named the way Macedonian supermarkets label them (e.g. "тестенини", not "паста"; "бело сирење"; "мелено месо"). Skip water, salt and pepper.
Examples:
"sendvich so kaskaval i shunka" -> {"intent":"recipe","products":["леб","кашкавал","шунка"]}
"направи ми палачинки" -> {"intent":"recipe","products":["брашно","јајца","млеко","шеќер","путер"]}
"monster energy" -> {"intent":"search","products":[]}`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["recipe", "search"] },
    products: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["intent", "products"],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class IntentParserService {
  constructor(mealIntentRepository = null) {
    this.mealIntentRepository = mealIntentRepository;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.client = null;
      return;
    }
    this.client = new GoogleGenAI({ apiKey });
    this.cache = new Map();
    this.activeModel = MODELS[0];
  }

  isAvailable() {
    return this.client !== null;
  }

  async parseIntent(query) {
    const { priceSort } = parseSearchQuery(query);
    const withQuery = (meal) => ({ ...meal, searchTerms: query, priceSort });

    if (!this.client) return withQuery(this.#fallback());

    const key = mealCacheKey(query);
    const cached = this.cache.get(key) || (await this.mealIntentRepository?.findByKey(key));
    if (cached) {
      this.#remember(key, cached);
      return withQuery(this.#validate(cached));
    }

    const result = await this.#parseWithRetry(query);
    // Don't cache the fallback: a transient AI outage would otherwise pin this
    // query to a plain search.
    if (!result) return withQuery(this.#fallback());

    this.#remember(key, result);
    await this.mealIntentRepository?.save(key, result).catch((err) => {
      console.error("[IntentParser] Failed to save meal intent:", err.message);
    });
    return withQuery(result);
  }

  #remember(key, meal) {
    this.cache.set(key, meal);
    if (this.cache.size > MEMORY_CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async #parseWithRetry(query, maxRetries = 3) {
    const modelCandidates = [
      this.activeModel,
      ...MODELS.filter((m) => m !== this.activeModel),
    ];

    for (const model of modelCandidates) {
      const parsed = await this.#parseWithRetryForModel(query, model, maxRetries);
      if (parsed) {
        this.activeModel = model;
        return parsed;
      }
    }

    return null;
  }

  async #parseWithRetryForModel(query, model, maxRetries) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.models.generateContent({
          model,
          contents: query,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        });

        const text = response.text;
        const parsed = JSON.parse(text);
        return this.#validate(parsed);
      } catch (err) {
        if (this.#isModelUnavailableError(err)) {
          console.warn(`[IntentParser] Model ${model} unavailable, trying next model.`);
          return null;
        }

        if (attempt < maxRetries && this.#isTransientError(err)) {
          const wait = this.#getRetryDelayMs(err, attempt);
          console.log(
            `[IntentParser] API error, retrying in ${Math.round(wait / 1000)}s...`,
          );
          await sleep(wait);
          continue;
        }
        console.error(`[IntentParser] Failed to parse intent with model ${model}:`, err.message);
        return null;
      }
    }
    return null;
  }

  #validate(parsed) {
    const products = Array.isArray(parsed?.products)
      ? [...new Set(parsed.products.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()))]
      : [];
    return {
      intent: parsed?.intent === "recipe" && products.length ? "recipe" : "search",
      products: products.slice(0, MAX_INGREDIENTS),
    };
  }

  #fallback() {
    return { intent: "search", products: [] };
  }

  #isTransientError(err) {
    const status = err?.status;
    const message = String(err?.message || "").toUpperCase();
    const code = err?.code || err?.cause?.code;
    const networkCodes = ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"];

    return (
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("UNAVAILABLE") ||
      message.includes("FETCH FAILED") ||
      networkCodes.includes(code)
    );
  }

  #isModelUnavailableError(err) {
    const status = err?.status;
    const message = String(err?.message || "").toUpperCase();
    return status === 404 || message.includes("NO LONGER AVAILABLE") || message.includes("NOT_FOUND");
  }

  #getRetryDelayMs(err, attempt) {
    const retryInMatch = String(err?.message || "").match(/retry in ([\d.]+)s/i);
    if (retryInMatch) return Math.ceil(Number(retryInMatch[1]) * 1000);
    const base = Math.min(30_000, 2_000 * 2 ** attempt);
    const jitter = Math.floor(Math.random() * 500);
    return base + jitter;
  }
}
