import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { IntentParserService } = await import("./intent-parser.service.js");

const recipe = {
  searchTerms: "палачинки",
  priceSort: "asc",
  intent: "recipe",
  products: ["брашно", "јајца", " брашно "],
};

describe("IntentParserService", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.restoreAllMocks();
    generateContent.mockReset();
  });

  it("caches successful parses", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(recipe) });
    const sut = new IntentParserService();

    await sut.parseIntent("палачинки");
    await sut.parseIntent("Палачинки ");

    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("dedupes ingredient names", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(recipe) });
    const sut = new IntentParserService();

    const result = await sut.parseIntent("палачинки");

    expect(result.products).toEqual(["брашно", "јајца"]);
  });

  it("does not cache the fallback when every model fails", async () => {
    // Non-transient error: each model gives up immediately without retry sleeps.
    generateContent.mockRejectedValue(Object.assign(new Error("bad request"), { status: 400 }));
    const sut = new IntentParserService();

    const failed = await sut.parseIntent("палачинки");
    expect(failed).toMatchObject({ intent: "search", products: [] });

    generateContent.mockReset();
    generateContent.mockResolvedValue({ text: JSON.stringify(recipe) });
    const recovered = await sut.parseIntent("палачинки");

    expect(recovered.intent).toBe("recipe");
  });
});
