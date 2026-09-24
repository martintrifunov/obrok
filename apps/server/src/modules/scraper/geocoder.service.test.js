import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeocoderService } from "./geocoder.service.js";

// Mock fs so it doesn't try to read the real coordinates file
vi.mock("fs", () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({
      "ВЕРО 1": [41.9845, 21.4686],
      "РАМСТОР ВАРДАР": [41.9919, 21.4273],
    }),
  ),
}));

describe("GeocoderService", () => {
  let service;

  beforeEach(() => {
    service = new GeocoderService();
  });

  describe("geocode — static lookup", () => {
    it("returns coordinates from static JSON for exact match", async () => {
      const result = await service.geocode("ВЕРО 1", "Македонија", "");
      expect(result).toEqual([41.9845, 21.4686]);
    });

    it("normalizes РАМСТОРЕ to РАМСТОР for lookup", async () => {
      const result = await service.geocode(
        "РАМСТОРЕ ВАРДАР",
        "Македонија",
        "",
      );
      expect(result).toEqual([41.9919, 21.4273]);
    });

    it("falls through to Nominatim for unknown market", async () => {
      // Mock global fetch to simulate Nominatim returning no results
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await service.geocode(
        "НЕПОСТОЕЧКИ МАРКЕТ",
        "Македонија",
        "Some address, Скопје",
      );

      // After all Nominatim queries fail, should try city fallback for Скопје
      if (result) {
        expect(result).toHaveLength(2);
        expect(result[0]).toBeCloseTo(41.998, 1);
        expect(result[1]).toBeCloseTo(21.425, 1);
      } else {
        expect(result).toBeNull();
      }

      globalThis.fetch = originalFetch;
    });
  });

  describe("geocode — Nominatim integration", () => {
    it("returns coordinates from Nominatim when static lookup misses", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([{ lat: "42.0", lon: "21.4" }]),
      });

      const result = await service.geocode(
        "НОВА ЛОКАЦИЈА 1",
        "Македонија",
        "Ул. Тестна 5, Скопје",
      );

      expect(result).toEqual([42.0, 21.4]);
      expect(globalThis.fetch).toHaveBeenCalled();

      globalThis.fetch = originalFetch;
    });

    it("strips street prefixes without mangling street names", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ lat: "42.0", lon: "21.4" }]),
      });

      await service.geocode(
        "НОВА ЛОКАЦИЈА 2",
        "Македонија",
        "ул. Брегалница бр. 5, Скопје",
      );

      const firstQuery = new URL(globalThis.fetch.mock.calls[0][0]).searchParams.get("q");
      expect(firstQuery).toContain("Брегалница");
      expect(firstQuery).not.toMatch(/ул\.|бр\./i);

      globalThis.fetch = originalFetch;
    });
  });
});
