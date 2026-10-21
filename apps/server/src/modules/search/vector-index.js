import { readEmbeddingInto } from "./embedding-codec.js";

// Product embeddings held in memory as normalized int8 vectors (1 byte per
// dimension), scored by brute force. 93k products x 768 dims is about 70 MB,
// and a full scan takes tens of milliseconds, so no vector database is needed.

const INT8_MAX = 127;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const MAX_DIMS = 4096;

/** @param {ArrayLike<number>} vector */
const normalize = (vector) => {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  return Float32Array.from(vector, (x) => x / norm);
};

export class VectorIndex {
  /**
   * @param {import("./product-embedding.repository.js").ProductEmbeddingRepository} productEmbeddingRepository
   * @param {{ logger?: Pick<Console, "log" | "error"> }} [options]
   */
  constructor(productEmbeddingRepository, { logger = console } = {}) {
    this.repository = productEmbeddingRepository;
    this.logger = logger;
    this.dims = 0;
    /** @type {string[]} */
    this.ids = [];
    /** @type {Map<string, number>} */
    this.rowById = new Map();
    this.vectors = new Int8Array(0);
    // Per-row factor turning an int8 dot product back into a cosine.
    this.scales = new Float32Array(0);
    this.version = null;
    this.loading = null;
  }

  isReady() {
    return this.ids.length > 0;
  }

  /** Loads every embedding; concurrent calls share one load. */
  load() {
    if (!this.loading) {
      this.loading = this.#load().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  async #load() {
    const started = Date.now();
    const version = await this.repository.latestVersion();
    const total = await this.repository.count();

    let dims = 0;
    let vectors = new Int8Array(0);
    const scales = new Float32Array(total);
    const scratch = new Float32Array(MAX_DIMS);
    const ids = [];
    let row = 0;
    for await (const doc of this.repository.streamAll()) {
      const length = readEmbeddingInto(doc.embedding, scratch);
      if (!length || row >= total) continue;
      if (!dims) {
        dims = length;
        vectors = new Int8Array(total * dims);
      }
      if (length !== dims) continue;

      // Scale each unit vector to the full int8 range: its components are
      // small, so a fixed scale would leave most of the range unused.
      let norm = 0;
      let maxAbs = 0;
      for (let i = 0; i < dims; i++) {
        norm += scratch[i] * scratch[i];
        maxAbs = Math.max(maxAbs, Math.abs(scratch[i]));
      }
      norm = Math.sqrt(norm) || 1;
      const factor = maxAbs ? (INT8_MAX * norm) / maxAbs : 1;
      const offset = row * dims;
      for (let i = 0; i < dims; i++) vectors[offset + i] = Math.round((scratch[i] / norm) * factor);
      scales[row] = 1 / factor;
      ids.push(doc.product.toString());
      row++;
    }

    this.dims = dims;
    this.vectors = vectors.subarray(0, row * dims);
    this.scales = scales.subarray(0, row);
    this.ids = ids;
    this.rowById = new Map(ids.map((id, i) => [id, i]));
    this.version = version;
    this.logger.log(
      `[VectorIndex] Loaded ${row} embeddings (${dims} dims, ` +
        `${Math.round(this.vectors.byteLength / 1e6)} MB) in ${Date.now() - started}ms.`,
    );
  }

  /** Reloads a loaded index if embeddings changed since the last load. */
  async refreshIfStale() {
    if (!this.isReady()) return;
    try {
      const version = await this.repository.latestVersion();
      if (version !== this.version) await this.load();
    } catch (err) {
      this.logger.error(`[VectorIndex] Refresh failed: ${err.message}`);
    }
  }

  startAutoRefresh(intervalMs = REFRESH_INTERVAL_MS) {
    setInterval(() => this.refreshIfStale(), intervalMs).unref?.();
  }

  /**
   * @param {number[]} queryVector
   * @param {{ k?: number, productIds?: Iterable<unknown> | null }} [options]
   *   productIds limits the search to those products (e.g. one market's catalogue).
   * @returns {{ productId: string, score: number }[]} best first, cosine similarity
   */
  search(queryVector, { k = 100, productIds = null } = {}) {
    if (!this.isReady() || queryVector.length !== this.dims) return [];

    const query = normalize(queryVector);
    const dims = this.dims;
    const vectors = this.vectors;
    const scales = this.scales;

    /** @type {number[] | null} */
    let rows = null;
    if (productIds) {
      rows = [];
      for (const id of productIds) {
        const r = this.rowById.get(String(id));
        if (r !== undefined) rows.push(r);
      }
    }
    const n = rows ? rows.length : this.ids.length;

    // Keep the best k in a small array sorted ascending; k is small (<= a few hundred).
    /** @type {{ row: number, score: number }[]} */
    const best = [];
    for (let j = 0; j < n; j++) {
      const row = rows ? rows[j] : j;
      const offset = row * dims;
      let dot = 0;
      for (let i = 0; i < dims; i++) dot += query[i] * vectors[offset + i];
      const score = dot * scales[row];
      if (best.length < k) {
        best.push({ row, score });
        if (best.length === k) best.sort((a, b) => a.score - b.score);
      } else if (score > best[0].score) {
        let i = 1;
        while (i < k && best[i].score < score) {
          best[i - 1] = best[i];
          i++;
        }
        best[i - 1] = { row, score };
      }
    }

    return best
      .sort((a, b) => b.score - a.score)
      .map(({ row, score }) => ({ productId: this.ids[row], score }));
  }
}
