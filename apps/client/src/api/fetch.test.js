import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPrivate } from "./fetch";
import { useAuthStore } from "@/store/authStore";

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const mockFetch = (...responses) => {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockImplementationOnce(r));
  vi.stubGlobal("fetch", fn);
  return fn;
};

beforeEach(() => {
  useAuthStore.setState({ auth: { username: "admin", accessToken: "old" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPrivate token refresh", () => {
  it("retries with the refreshed token after a 401", async () => {
    const fetchMock = mockFetch(
      async () => jsonResponse(401, { message: "expired" }),
      async () => jsonResponse(200, { accessToken: "new" }),
      async () => jsonResponse(200, { ok: true }),
    );

    await expect(fetchPrivate("/chains")).resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls[2][1].headers.get("Authorization")).toBe("Bearer new");
    expect(useAuthStore.getState().auth.accessToken).toBe("new");
  });

  it("clears auth when the refresh is rejected", async () => {
    mockFetch(
      async () => jsonResponse(401, { message: "expired" }),
      async () => jsonResponse(403, { message: "Forbidden" }),
    );

    await expect(fetchPrivate("/chains")).rejects.toMatchObject({ status: 403 });

    expect(useAuthStore.getState().auth).toEqual({});
  });

  it("keeps auth when the refresh fails on the network", async () => {
    mockFetch(
      async () => jsonResponse(401, { message: "expired" }),
      async () => {
        throw new TypeError("Failed to fetch");
      },
    );

    await expect(fetchPrivate("/chains")).rejects.toThrow("Failed to fetch");

    expect(useAuthStore.getState().auth.accessToken).toBe("old");
  });
});
