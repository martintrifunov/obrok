import { describe, it, expect } from "vitest";
import { roleFromToken } from "./roleFromToken";

const tokenWith = (payload) =>
  ["header", btoa(JSON.stringify(payload)).replace(/=+$/, ""), "signature"].join(".");

describe("roleFromToken", () => {
  it("reads the role from the token payload", () => {
    expect(roleFromToken(tokenWith({ UserInfo: { username: "ana", role: "admin" } }))).toBe("admin");
    expect(roleFromToken(tokenWith({ UserInfo: { username: "ana", role: "user" } }))).toBe("user");
  });

  it("returns null for a missing or malformed token", () => {
    expect(roleFromToken(undefined)).toBeNull();
    expect(roleFromToken("not-a-token")).toBeNull();
    expect(roleFromToken(tokenWith({ username: "ana" }))).toBeNull();
  });
});
