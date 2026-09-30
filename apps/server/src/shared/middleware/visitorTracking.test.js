import { describe, it, expect, vi } from "vitest";
import visitorTracking from "./visitorTracking.js";

const makeReq = ({ cookie, header } = {}) => ({
  cookies: cookie ? { obrok_vid: cookie } : {},
  get: (name) => (name.toLowerCase() === "x-visitor-id" ? header : undefined),
});

const run = (req) => {
  const res = { cookie: vi.fn() };
  const next = vi.fn();
  visitorTracking(req, res, next);
  expect(next).toHaveBeenCalled();
  return { visitorId: req.visitorId, res };
};

const CLIENT_ID = "0b6f1c1e-5d3a-4f7e-9c1a-2b3c4d5e6f70";
const COOKIE_ID = "11111111-2222-4333-8444-555555555555";

describe("visitorTracking", () => {
  it("counts parallel first requests with the same header as one visitor", () => {
    const first = run(makeReq({ header: CLIENT_ID }));
    const second = run(makeReq({ header: CLIENT_ID }));

    expect(first.visitorId).toBe(CLIENT_ID);
    expect(second.visitorId).toBe(CLIENT_ID);
    expect(first.res.cookie).toHaveBeenCalledWith(
      "obrok_vid",
      CLIENT_ID,
      expect.any(Object),
    );
  });

  it("prefers an existing cookie over the header and doesn't reset it", () => {
    const { visitorId, res } = run(
      makeReq({ cookie: COOKIE_ID, header: CLIENT_ID }),
    );

    expect(visitorId).toBe(COOKIE_ID);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("ignores malformed header ids", () => {
    const { visitorId } = run(makeReq({ header: "<script>alert(1)</script>" }));

    expect(visitorId).not.toContain("<");
    expect(visitorId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("mints an id when neither cookie nor header is present", () => {
    const { visitorId, res } = run(makeReq());

    expect(visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.cookie).toHaveBeenCalled();
  });
});
