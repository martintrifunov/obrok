import { describe, it, expect, vi, beforeEach } from "vitest";
import corsOptions from "./corsOptions.js";

const decide = (origin) => {
  const callback = vi.fn();
  corsOptions.origin(origin, callback);
  return callback.mock.calls[0];
};

describe("corsOptions.origin", () => {
  beforeEach(() => vi.stubEnv("CLIENT_ORIGIN", "http://localhost:3500"));

  it("allows the client and requests without an Origin header", () => {
    expect(decide("http://localhost:3500")).toEqual([null, true]);
    expect(decide(undefined)).toEqual([null, true]);
  });

  it("refuses other origins without raising an error", () => {
    expect(decide("http://evil.example")).toEqual([null, false]);
  });
});
