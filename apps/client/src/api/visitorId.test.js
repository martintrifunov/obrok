import { describe, it, expect, vi, afterEach } from "vitest";
import { getVisitorId } from "./visitorId";
import { fetchPublic } from "./fetch";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getVisitorId", () => {
  it("returns the same id across calls and persists it", () => {
    const id = getVisitorId();

    expect(id).toMatch(/^[A-Za-z0-9-]{12,64}$/);
    expect(getVisitorId()).toBe(id);
    expect(window.localStorage.getItem("obrok.visitorId")).toBe(id);
  });

  it("replaces a corrupt stored id", () => {
    window.localStorage.setItem("obrok.visitorId", "<bad>");
    expect(getVisitorId()).toMatch(/^[A-Za-z0-9-]{12,64}$/);
  });

  it("stays stable within the page when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    const id = getVisitorId();
    expect(getVisitorId()).toBe(id);
  });
});

describe("fetch wrappers", () => {
  it("send the visitor id on every request", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([fetchPublic("/flags"), fetchPublic("/chains")]);

    const ids = fetchMock.mock.calls.map(([, init]) =>
      init.headers.get("X-Visitor-Id"),
    );
    expect(ids[0]).toBe(getVisitorId());
    expect(ids[1]).toBe(ids[0]);
  });
});
