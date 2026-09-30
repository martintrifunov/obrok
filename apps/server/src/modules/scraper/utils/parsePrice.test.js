import { describe, it, expect } from "vitest";
import { parsePrice, withParsedPrices } from "./parsePrice.js";

const NBSP = " ";
const NNBSP = " ";

describe("parsePrice", () => {
  it.each([
    ["1.299,00 ден", 1299],
    ["1,299.00", 1299],
    ["1 299,00", 1299],
    [`1${NBSP}299,00`, 1299],
    [`1${NNBSP}299,50 ден`, 1299.5],
    ["89,90", 89.9],
    ["89.90", 89.9],
    ["199.00", 199],
    ["2.450", 2450],
    ["2,450", 2450],
    ["1.234.567,89", 1234567.89],
    ["1,234,567.89", 1234567.89],
    ["1.234.567", 1234567],
    ["ден 65", 65],
    ["65 ден.", 65],
    ["0", 0],
    ["12,5", 12.5],
    ["199", 199],
  ])("%j -> %d", (input, expected) => {
    expect(parsePrice(input)).toBeCloseTo(expected, 5);
  });

  it.each([[""], ["abc"], ["ден"], ["."], [","], [null], [undefined]])(
    "%j -> NaN",
    (input) => {
      expect(parsePrice(input)).toBeNaN();
    },
  );

  it("parses numbers passed as numbers", () => {
    expect(parsePrice(199.5)).toBe(199.5);
  });
});

describe("withParsedPrices", () => {
  it("parses prices and drops rows without a positive price", () => {
    expect(
      withParsedPrices([
        { title: "A", priceText: "1.299,00 ден", category: "X" },
        { title: "B", priceText: "0", category: "X" },
        { title: "C", priceText: "n/a", category: "X" },
      ]),
    ).toEqual([{ title: "A", price: 1299, category: "X" }]);
  });
});
