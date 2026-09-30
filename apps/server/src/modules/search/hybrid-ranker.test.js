import { describe, it, expect } from "vitest";
import { buildKeywordScorer, fuseResults, sortStrongByPrice } from "./hybrid-ranker.js";

describe("buildKeywordScorer", () => {
  const score = buildKeywordScorer("млеко");

  it("ranks a title that starts with the query highest", () => {
    expect(score({ title: "МЛЕКО 3.5% 1Л" })).toBe(1);
    expect(buildKeywordScorer("mleko")({ title: "МЛЕКО 3.5% 1Л" })).toBe(1);
  });

  it("ranks the query as a whole word below that", () => {
    expect(score({ title: "КИСЕЛО МЛЕКО 400Г" })).toBe(0.8);
  });

  it("ranks substring or category-only matches lowest", () => {
    expect(score({ title: "МЛЕКОВИТА ЈОГУРТ" })).toBe(0.4);
    expect(score({ title: "ДЕТСКА ХРАНА", category: "ХРАНА ЗА БЕБИЊА - МЛЕКО" })).toBe(0.4);
  });
});

describe("fuseResults", () => {
  it("rewards products found by both signals", () => {
    const fused = fuseResults(
      [{ productId: "a", score: 0.8 }, { productId: "b", score: 0.79 }],
      [{ productId: "b", score: 1 }, { productId: "c", score: 1 }],
    );

    expect(fused.map((r) => r.productId)).toEqual(["b", "c", "a"]);
  });

  it("drops the vector tail far below the best hit", () => {
    const fused = fuseResults(
      [{ productId: "a", score: 0.8 }, { productId: "far", score: 0.6 }],
      [],
    );

    expect(fused.map((r) => r.productId)).toEqual(["a"]);
  });
});

describe("sortStrongByPrice", () => {
  it("sorts strong matches by price and keeps weak ones after them", () => {
    const results = [
      { id: "milk 60", score: 1, price: 60 },
      { id: "milk 45", score: 0.9, price: 45 },
      { id: "choco bar 20", score: 0.4, price: 20 },
    ];

    const sorted = sortStrongByPrice(results, (r) => r.price);

    expect(sorted.map((r) => r.id)).toEqual(["milk 45", "milk 60", "choco bar 20"]);
  });
});
