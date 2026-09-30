import { GoogleGenAI } from "@google/genai";

const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

const SYSTEM_PROMPT = `You are a query intent parser for a Macedonian grocery price comparison app.
Analyze the user query and return structured JSON.

Rules:
- "searchTerms": the cleaned query with price/intent modifiers removed. Keep only product names.
- "priceSort": "asc" if user wants cheapest/најефтин/najeftin/поевтино/поевтин/budget/евтин/evtin, "desc" if most expensive/најскап/najskap/поскапо/скап/skap/luxury/premium, null otherwise.
- "intent": "recipe" if user describes a meal, dish, or says they want to eat something (сакам да јадам/sakam da jadam/направи ми/napravi mi). "search" for simple product lookups.
- "products": only for "recipe" intent — array of individual ingredient/product names decomposed from the meal description. Each should be a single grocery item in Macedonian Cyrillic. For example "sendvich so kaskaval i shunka" → ["леб", "кашкавал", "шунка"]. Think about what ingredients are needed.

Handle both Cyrillic and Latin Macedonian text. Transliterate Latin to Cyrillic for product names in output.

Examples:
- "najeftin kaskaval" → {"searchTerms":"кашкавал","priceSort":"asc","intent":"search","products":[]}
- "најскапо млеко" → {"searchTerms":"млеко","priceSort":"desc","intent":"search","products":[]}
- "kaskaval" → {"searchTerms":"кашкавал","priceSort":null,"intent":"search","products":[]}
- "sakam da jadam sendvich so kaskaval i shunka" → {"searchTerms":"сендвич кашкавал шунка","priceSort":"asc","intent":"recipe","products":["леб","кашкавал","шунка"]}
- "направи ми палачинки" → {"searchTerms":"палачинки","priceSort":"asc","intent":"recipe","products":["брашно","јајца","млеко","шеќер","путер"]}
- "monster energy" → {"searchTerms":"monster energy","priceSort":null,"intent":"search","products":[]}

Always return valid JSON matching this exact schema. For recipe intent, default priceSort to "asc" (cheapest) unless user explicitly asks for expensive.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class IntentParserService {
  constructor() {
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
    if (!this.client) {
      return this.#fallback(query);
    }

    const cacheKey = query.trim().toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return cached.value;
    }

    const result = await this.#parseWithRetry(query);
    // Don't cache the fallback: a transient AI outage would otherwise pin this
    // query to a plain search for the whole cache window.
    if (!result) return this.#fallback(query);

    this.cache.set(cacheKey, { value: result, ts: Date.now() });
    if (this.cache.size > 500) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }

    return result;
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
            temperature: 0,
          },
        });

        const text = response.text;
        const parsed = JSON.parse(text);
        return this.#validate(parsed, query);
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

  #validate(parsed, originalQuery) {
    return {
      searchTerms:
        typeof parsed.searchTerms === "string" && parsed.searchTerms.trim()
          ? parsed.searchTerms.trim()
          : originalQuery,
      priceSort:
        parsed.priceSort === "asc" || parsed.priceSort === "desc"
          ? parsed.priceSort
          : null,
      intent:
        parsed.intent === "recipe" || parsed.intent === "search"
          ? parsed.intent
          : "search",
      products: Array.isArray(parsed.products)
        ? [...new Set(parsed.products.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()))]
        : [],
    };
  }

  #fallback(query) {
    return {
      searchTerms: query,
      priceSort: null,
      intent: "search",
      products: [],
    };
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
