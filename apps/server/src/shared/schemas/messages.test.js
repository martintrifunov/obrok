import { describe, it, expect } from "vitest";
import { createProductSchema } from "../../modules/product/product.schema.js";
import { createPublicHolidaySchema } from "../../modules/public-holiday/public-holiday.schema.js";
import { createMarketSchema } from "../../modules/market/market.schema.js";
import { createReportSchema } from "../../modules/report/report.schema.js";

const messagesOf = (schema, value) =>
  Object.fromEntries(
    schema.safeParse(value).error.issues.map((i) => [i.path.join("."), i.message]),
  );

describe("custom validation messages (Zod 4 ignores required_error)", () => {
  it("reports required fields with the schema's own message", () => {
    expect(messagesOf(createProductSchema, {})).toEqual({
      title: "Product title is required.",
    });
    expect(messagesOf(createMarketSchema, {})).toMatchObject({
      name: "Market name is required.",
      location: "Location coordinates are required.",
      chain: "This field is required.",
    });
  });

  it("distinguishes missing from wrong-typed values", () => {
    expect(
      messagesOf(createMarketSchema, {
        name: "Vero",
        location: ["a", 1],
        chain: "a".repeat(24),
      }),
    ).toEqual({ "location.0": "Coordinate must be a number." });
  });

  it("distinguishes missing from invalid dates", () => {
    expect(messagesOf(createReportSchema, {})).toEqual({
      from: "From date is required.",
      to: "To date is required.",
    });
    expect(messagesOf(createPublicHolidaySchema, { name: "x", date: "nope" })).toEqual({
      date: "Holiday date is invalid.",
    });
  });

  it("still parses holiday dates as UTC midnight", () => {
    const { data } = createPublicHolidaySchema.safeParse({ name: "x", date: "2026-10-03" });
    expect(data.date.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});
