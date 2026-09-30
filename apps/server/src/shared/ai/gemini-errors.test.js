import { describe, it, expect } from "vitest";
import { isModelUnavailableError, isTransientError, retryDelayMs } from "./gemini-errors.js";

describe("gemini errors", () => {
  it("treats rate limits, server errors and network failures as transient", () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ message: "RESOURCE_EXHAUSTED" })).toBe(true);
    expect(isTransientError({ cause: { code: "ECONNRESET" } })).toBe(true);
    expect(isTransientError({ status: 400, message: "bad request" })).toBe(false);
  });

  it("recognises a missing model", () => {
    expect(isModelUnavailableError({ status: 404 })).toBe(true);
    expect(isModelUnavailableError({ message: "model is no longer available" })).toBe(true);
    expect(isModelUnavailableError({ status: 429 })).toBe(false);
  });

  it("follows the server's retry hint, otherwise backs off up to the cap", () => {
    expect(retryDelayMs({ message: "Please retry in 2.5s" }, 0, 30_000)).toBe(2500);
    const delay = retryDelayMs({}, 10, 30_000);
    expect(delay).toBeGreaterThanOrEqual(30_000);
    expect(delay).toBeLessThan(30_500);
  });
});
