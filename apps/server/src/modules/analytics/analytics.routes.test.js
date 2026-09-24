import { describe, it, expect } from "vitest";
import { analyticsRouter } from "./analytics.routes.js";
import verifyJWT from "../auth/middleware/verifyJWT.js";
import verifyAdmin from "../auth/middleware/verifyAdmin.js";
import verifyAdminUser from "../auth/middleware/verifyAdminUser.js";

const middlewareFor = (method, path) => {
  const layer = analyticsRouter.stack.find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  return layer.route.stack.map((s) => s.handle);
};

describe("analytics routes", () => {
  it.each(["/summary", "/feature-trends"])("%s requires an admin", (path) => {
    const chain = middlewareFor("get", path);
    expect(chain).toContain(verifyJWT);
    expect(chain).toContain(verifyAdmin);
  });

  it("export stays restricted to the configured admin user", () => {
    expect(middlewareFor("get", "/export")).toContain(verifyAdminUser);
  });

  it("every read endpoint except the public heartbeat is admin-only", () => {
    const readRoutes = analyticsRouter.stack
      .filter((l) => l.route?.methods.get)
      .map((l) => l.route);
    for (const route of readRoutes) {
      const chain = route.stack.map((s) => s.handle);
      expect(
        chain.includes(verifyAdmin) || chain.includes(verifyAdminUser),
        `${route.path} is not admin-only`,
      ).toBe(true);
    }
  });
});
