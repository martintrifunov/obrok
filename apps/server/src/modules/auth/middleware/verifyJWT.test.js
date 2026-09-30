import { describe, it, expect, vi, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import verifyJWT from "./verifyJWT.js";
import optionalVerifyJWT from "./optionalVerifyJWT.js";

const SECRET = "test-secret";

const makeReq = (payload) => ({
  headers: { authorization: `Bearer ${jwt.sign(payload, SECRET)}` },
});

const makeRes = () => ({ sendStatus: vi.fn() });

beforeAll(() => {
  process.env.ACCESS_TOKEN_SECRET = SECRET;
});

describe("verifyJWT", () => {
  it("sets user and role for a valid token", () => {
    const req = makeReq({ UserInfo: { username: "admin", role: "admin" } });
    const res = makeRes();
    const next = vi.fn();

    verifyJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBe("admin");
    expect(req.role).toBe("admin");
  });

  it("returns 401 for a signed token without UserInfo", () => {
    const req = makeReq({ sub: "someone" });
    const res = makeRes();
    const next = vi.fn();

    verifyJWT(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("optionalVerifyJWT", () => {
  it("continues anonymously for a signed token without UserInfo", () => {
    const req = makeReq({ sub: "someone" });
    const next = vi.fn();

    optionalVerifyJWT(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
