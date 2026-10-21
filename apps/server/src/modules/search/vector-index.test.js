import { describe, it, expect, vi } from "vitest";
import { VectorIndex } from "./vector-index.js";
import { encodeEmbedding } from "./embedding-codec.js";

const rows = [
  { product: "milk", embedding: [1, 0, 0] },
  { product: "cheese", embedding: encodeEmbedding([0.8, 0.6, 0]) },
  { product: "soap", embedding: [0, 0, 1] },
];

const makeRepo = (data = rows, version = "v1") => ({
  count: vi.fn(async () => data.length),
  latestVersion: vi.fn(async () => version),
  streamAll: () => data,
});

const quiet = { logger: { log: () => {}, error: () => {} } };

describe("VectorIndex", () => {
  it("ranks by cosine similarity, reading packed and legacy embeddings", async () => {
    const index = new VectorIndex(makeRepo(), quiet);
    await index.load();

    const hits = index.search([2, 0.1, 0], { k: 3 });

    expect(hits.map((h) => h.productId)).toEqual(["milk", "cheese", "soap"]);
    expect(hits[0].score).toBeCloseTo(0.9988, 2);
    expect(hits[1].score).toBeCloseTo(0.829, 2);
  });

  it("keeps only the best k", async () => {
    const index = new VectorIndex(makeRepo(), quiet);
    await index.load();

    expect(index.search([0, 0, 1], { k: 1 }).map((h) => h.productId)).toEqual(["soap"]);
  });

  it("limits the search to the given products", async () => {
    const index = new VectorIndex(makeRepo(), quiet);
    await index.load();

    const hits = index.search([1, 0, 0], { k: 5, productIds: ["soap", "cheese", "unknown"] });

    expect(hits.map((h) => h.productId)).toEqual(["cheese", "soap"]);
  });

  it("returns nothing before loading or for a wrong-sized query", async () => {
    const index = new VectorIndex(makeRepo(), quiet);
    expect(index.search([1, 0, 0])).toEqual([]);
    await index.load();
    expect(index.search([1, 0])).toEqual([]);
  });

  it("reloads only when the stored version changes", async () => {
    const repo = makeRepo();
    const index = new VectorIndex(repo, quiet);
    await index.load();
    const load = vi.spyOn(index, "load");

    await index.refreshIfStale();
    expect(load).not.toHaveBeenCalled();

    repo.latestVersion.mockResolvedValue("v2");
    await index.refreshIfStale();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
