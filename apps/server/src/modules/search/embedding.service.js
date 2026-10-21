import { GoogleGenAI } from "@google/genai";
import { isTransientError, retryDelayMs } from "../../shared/ai/gemini-errors.js";

const MODEL = "gemini-embedding-2";
const DIMENSIONS = 768;
const CHUNK_SIZE = 20;
const QUERY_CACHE_SIZE = 2000;
// A search waits on its query embedding; on failure it falls back to keywords, so retry once, quickly.
const QUERY_RETRIES = 1;
const MAX_RETRY_DELAY_MS = 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class EmbeddingService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.client = null;
      return;
    }
    this.client = new GoogleGenAI({ apiKey });
    this.queryCache = new Map();
  }

  isAvailable() {
    return this.client !== null;
  }

  /** Embeds a search query; repeated queries come from the cache. */
  async generateEmbedding(text) {
    if (!this.client) throw new Error("GEMINI_API_KEY not configured.");

    const key = text.trim().toLowerCase();
    const cached = this.queryCache.get(key);
    if (cached) {
      // Re-insert so the Map's order tracks recent use.
      this.queryCache.delete(key);
      this.queryCache.set(key, cached);
      return cached;
    }
    const embedding = await this.#embedWithRetry(`task: search result | query: ${text}`, QUERY_RETRIES);
    this.queryCache.set(key, embedding);
    if (this.queryCache.size > QUERY_CACHE_SIZE) {
      this.queryCache.delete(this.queryCache.keys().next().value);
    }
    return embedding;
  }

  // Queries and documents are worded differently, as Gemini's retrieval tuning expects.
  async #embedWithRetry(prompt, maxRetries = 8) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.client.models.embedContent({
          model: MODEL,
          contents: prompt,
          config: { outputDimensionality: DIMENSIONS },
        });
        return result.embeddings[0].values;
      } catch (err) {
        if (attempt < maxRetries && isTransientError(err)) {
          const wait = retryDelayMs(err, attempt, MAX_RETRY_DELAY_MS);
          console.log(`[Embedding] API busy, retrying in ${Math.round(wait / 1000)}s...`);
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }
  }

  /** Embeds product texts as documents. */
  async generateBatchEmbeddings(texts) {
    if (!this.client) throw new Error("GEMINI_API_KEY not configured.");

    const results = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const batch = texts.slice(i, i + CHUNK_SIZE);
      const embeddings = await Promise.all(
        batch.map((text) => this.#embedWithRetry(`title: ${text} | text: ${text}`)),
      );

      results.push(...embeddings);

      // Keep the stream smooth without idling excessively.
      await sleep(350);
    }

    return results;
  }
}
