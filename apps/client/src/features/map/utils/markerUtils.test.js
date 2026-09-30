import { describe, it, expect } from "vitest";
import { getClusterGradient, getMarkerColor } from "./markerUtils";

const makeSupercluster = (chainNames) => ({
  getLeaves: () => chainNames.map((chainName) => ({ properties: { chainName } })),
});

describe("getClusterGradient", () => {
  it("returns null without a cluster or supercluster", () => {
    expect(getClusterGradient(null, makeSupercluster([]))).toBeNull();
    expect(getClusterGradient({ id: 1 }, null)).toBeNull();
  });

  it("returns a solid color when every market is from one chain", () => {
    expect(getClusterGradient({ id: 1 }, makeSupercluster(["Vero", "vero "]))).toBe(
      "crimson",
    );
  });

  it("builds a wrapped conic gradient for mixed chains", () => {
    const gradient = getClusterGradient(
      { id: 1 },
      makeSupercluster(["Vero", "Ramstore"]),
    );
    expect(gradient).toBe(
      "conic-gradient(from 0deg, #2e7d32 0%, crimson 50%, #2e7d32 100%)",
    );
  });

  it("returns null when supercluster throws", () => {
    const broken = {
      getLeaves: () => {
        throw new Error("boom");
      },
    };
    expect(getClusterGradient({ id: 1 }, broken)).toBeNull();
  });
});

describe("getMarkerColor", () => {
  it("matches chain names loosely", () => {
    expect(getMarkerColor("Super Kit-Go")).toBe("#0d47a1");
  });

  it("falls back to the Vero color for unknown chains", () => {
    expect(getMarkerColor("Unknown")).toBe("crimson");
  });
});
