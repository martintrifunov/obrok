import { describe, it, expect } from "vitest";
import { formatDistance } from "./formatDistance";

describe("formatDistance", () => {
  it("returns null when distance is missing", () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
  });

  it("formats short distances in meters", () => {
    expect(formatDistance(0)).toBe("0m");
    expect(formatDistance(999)).toBe("999m");
  });

  it("formats longer distances in kilometers with one decimal", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(2345)).toBe("2.3 km");
  });
});
