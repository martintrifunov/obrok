import { describe, it, expect } from "vitest";
import {
  paginationSchema,
  paginationWithAllSchema,
} from "./paginationSchema.js";
import { productQuerySchema } from "../../modules/product/product.schema.js";
import { marketQuerySchema } from "../../modules/market/market.schema.js";
import { chainQuerySchema } from "../../modules/chain/chain.schema.js";

describe("paginationSchema", () => {
  it("defaults to page 1, limit 10", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it.each(["0", "101", "-1"])("rejects limit=%s", (limit) => {
    expect(paginationSchema.safeParse({ limit }).success).toBe(false);
  });

  it("accepts limit=100", () => {
    expect(paginationSchema.parse({ limit: "100" }).limit).toBe(100);
  });
});

describe("paginationWithAllSchema", () => {
  it("allows limit=0 for loading everything", () => {
    expect(paginationWithAllSchema.parse({ limit: "0" }).limit).toBe(0);
  });

  it("still caps explicit page sizes", () => {
    expect(paginationWithAllSchema.safeParse({ limit: "1000" }).success).toBe(
      false,
    );
  });
});

describe("endpoint schemas", () => {
  it("products can't be fetched all at once", () => {
    expect(productQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("markets and chains can, for the map and dropdowns", () => {
    expect(marketQuerySchema.parse({ limit: "0" }).limit).toBe(0);
    expect(chainQuerySchema.parse({ limit: "0" }).limit).toBe(0);
  });
});
