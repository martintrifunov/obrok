import { describe, it, expect } from "vitest";
import { scriptMongoUri } from "./scriptMongoUri.js";

const env = { DATABASE_URI: "mongodb://db:27017/obrok", MONGO_URI_LOCAL: "mongodb://localhost:6969/obrok" };

describe("scriptMongoUri", () => {
  it("uses the db service inside the container", () => {
    expect(scriptMongoUri({ inContainer: true, env })).toBe(env.DATABASE_URI);
  });

  it("uses the published port on the host", () => {
    expect(scriptMongoUri({ inContainer: false, env })).toBe(env.MONGO_URI_LOCAL);
  });

  it("falls back to whichever is set", () => {
    expect(scriptMongoUri({ inContainer: false, env: { DATABASE_URI: "a" } })).toBe("a");
    expect(scriptMongoUri({ inContainer: true, env: { MONGO_URI_LOCAL: "b" } })).toBe("b");
  });
});
