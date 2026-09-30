import { describe, it, expect, vi } from "vitest";
import { validateRequest } from "./validateRequest.js";
import { ValidationError } from "../errors/ValidationError.js";
import { z } from "zod";
import { createProductSchema } from "../../modules/product/product.schema.js";
import { createPublicHolidaySchema } from "../../modules/public-holiday/public-holiday.schema.js";

const schema = z.object({ name: z.string() });

describe("validateRequest", () => {
  it("calls next with formatted ValidationError on invalid body", () => {
    const req = { body: { name: 123 } };
    const res = {};
    const next = vi.fn();
    validateRequest(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));

    const errorArg = next.mock.calls[0][0];
    expect(errorArg.errors).toHaveProperty("name");
  });

  it("mutates req.body with parsed data and calls next on valid input", () => {
    const req = { body: { name: "maco" } };
    const res = {};
    const next = vi.fn();
    validateRequest(schema)(req, res, next);
    expect(req.body).toEqual({ name: "maco" });
    expect(next).toHaveBeenCalledWith();
  });

  it("handles query source via Object.defineProperty", () => {
    const req = { body: {} };
    Object.defineProperty(req, "query", {
      get: () => ({ name: "maco" }),
      configurable: true,
    });
    const res = {};
    const next = vi.fn();
    validateRequest(schema, "query")(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next with ValidationError on invalid query", () => {
    const req = { body: {} };
    Object.defineProperty(req, "query", {
      get: () => ({ name: 123 }),
      configurable: true,
    });
    const res = {};
    const next = vi.fn();
    validateRequest(schema, "query")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("replaces Zod's default wording for a missing field", () => {
    const next = vi.fn();
    validateRequest(schema)({ body: {} }, {}, next);
    expect(next.mock.calls[0][0].errors).toEqual({ name: "This field cannot be blank." });
  });

  it("keeps the schema's own messages", () => {
    const errorsFor = (s, body) => {
      const next = vi.fn();
      validateRequest(s)({ body }, {}, next);
      return next.mock.calls[0][0].errors;
    };

    expect(errorsFor(createProductSchema, { price: 1, market: "507f1f77bcf86cd799439011" }).title)
      .toBe("Product title is required.");
    expect(errorsFor(createPublicHolidaySchema, { name: "x" }).date).toBe("Holiday date is required.");
    expect(errorsFor(createPublicHolidaySchema, { name: "x", date: "not-a-date" }).date)
      .toBe("Holiday date is invalid.");
  });
});
