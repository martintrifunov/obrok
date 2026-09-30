import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    // No real waiting between Nominatim queries in tests.
    service = new GeocoderService({ sleep: async () => {} });
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

  describe("geocode — Nominatim rate limiting", () => {
    const makeClock = () => {
      let now = 1_000_000;
      const sleeps = [];
      return {
        now: () => now,
        sleep: async (ms) => {
          sleeps.push(ms);
          now += ms;
        },
        advance: (ms) => {
          now += ms;
        },
        sleeps,
      };
    };

    const okEmpty = { ok: true, status: 200, json: () => Promise.resolve([]) };
    const okMatch = { ok: true, status: 200, json: () => Promise.resolve([{ lat: "42.0", lon: "21.4" }]) };

    let originalFetch;
    beforeEach(() => {
      originalFetch = globalThis.fetch;
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
    });
    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("spaces every request at least 1.1s apart, including after a success", async () => {
      const clock = makeClock();
      const requestTimes = [];
      globalThis.fetch = vi.fn(async () => {
        requestTimes.push(clock.now());
        return okMatch;
      });
      const sut = new GeocoderService(clock);

      await sut.geocode("НОВ МАРКЕТ 1", "Македонија", "ул. Тестна 5, Скопје");
      await sut.geocode("НОВ МАРКЕТ 2", "Македонија", "ул. Тестна 6, Скопје");

      expect(requestTimes).toHaveLength(2);
      expect(requestTimes[1] - requestTimes[0]).toBeGreaterThanOrEqual(1100);
    });

    it("does not wait when enough time has already passed", async () => {
      const clock = makeClock();
      globalThis.fetch = vi.fn().mockResolvedValue(okMatch);
      const sut = new GeocoderService(clock);

      await sut.geocode("НОВ МАРКЕТ 1", "Македонија", "ул. Тестна 5, Скопје");
      clock.advance(5000);
      await sut.geocode("НОВ МАРКЕТ 2", "Македонија", "ул. Тестна 6, Скопје");

      expect(clock.sleeps).toEqual([]);
    });

    it("backs off and retries once on HTTP 429", async () => {
      const clock = makeClock();
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce(okMatch);
      const sut = new GeocoderService(clock);

      const result = await sut.geocode("НОВ МАРКЕТ 1", "Македонија", "ул. Тестна 5, Скопје");

      expect(result).toEqual([42.0, 21.4]);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(clock.sleeps).toContain(5000);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 429"));
    });

    it("logs server errors instead of treating them silently as no match", async () => {
      const clock = makeClock();
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValue(okEmpty);
      const sut = new GeocoderService(clock);

      await sut.geocode("НОВ МАРКЕТ 1", "Македонија", "ул. Тестна 5, Скопје");

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 503"));
    });
  });
});
