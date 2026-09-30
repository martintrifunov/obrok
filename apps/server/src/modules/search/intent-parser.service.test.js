import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY" },
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

  it("reuses a saved meal instead of calling the model", async () => {
    const repo = {
      findByKey: vi.fn().mockResolvedValue({ intent: "recipe", products: ["брашно", "јајца"] }),
      save: vi.fn(),
    };
    const sut = new IntentParserService(repo);

    const result = await sut.parseIntent("Palačinki");

    expect(generateContent).not.toHaveBeenCalled();
    expect(repo.findByKey).toHaveBeenCalledWith("палачинки");
    expect(result).toMatchObject({ intent: "recipe", products: ["брашно", "јајца"] });
  });

  it("saves a new meal and takes price intent from the query, not the model", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ ...recipe, priceSort: "desc" }) });
    const repo = { findByKey: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue({}) };
    const sut = new IntentParserService(repo);

    const result = await sut.parseIntent("najeftini palachinki");

    expect(repo.save).toHaveBeenCalledWith(expect.any(String), {
      intent: "recipe",
      products: ["брашно", "јајца"],
    });
    expect(result.priceSort).toBe("asc");
  });

  it("treats a recipe with no ingredients as a plain search", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ intent: "recipe", products: [] }) });
    const sut = new IntentParserService();

    expect(await sut.parseIntent("нешто")).toMatchObject({ intent: "search", products: [] });
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
