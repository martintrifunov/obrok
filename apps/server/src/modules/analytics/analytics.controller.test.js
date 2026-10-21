import { describe, it, expect, vi } from "vitest";
import { AnalyticsController } from "./analytics.controller.js";
import { SearchController } from "../search/search.controller.js";

const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

describe("admins are left out of analytics", () => {
  it("records a visitor's heartbeat", async () => {
    const service = { trackHeartbeat: vi.fn().mockResolvedValue({ ok: true }) };
    const req = { visitorId: "v-1234567890ab", user: null, body: { path: "/", isPageView: true } };

    await new AnalyticsController(service).heartbeat(req, makeRes());

    expect(service.trackHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ visitorId: "v-1234567890ab" }));
  });

  it("acknowledges an admin's heartbeat without recording it", async () => {
    const service = { trackHeartbeat: vi.fn() };
    const res = makeRes();

    await new AnalyticsController(service).heartbeat({ role: "admin", user: "admin", body: {} }, res);

    expect(service.trackHeartbeat).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("passes no analytics context for an admin's search", async () => {
    const service = { search: vi.fn().mockResolvedValue({ data: [] }) };
    const req = { role: "admin", user: "admin", visitorId: "v-1234567890ab", query: { q: "леб" } };

    await new SearchController(service).search(req, makeRes());

    expect(service.search).toHaveBeenCalledWith(expect.objectContaining({ analytics: null }));
  });
});
