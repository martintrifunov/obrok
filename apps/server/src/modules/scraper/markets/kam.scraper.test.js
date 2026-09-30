import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const extractPdfTextItems = vi.hoisted(() => vi.fn());
vi.mock("../utils/pdf-text-extractor.js", () => ({ extractPdfTextItems }));

const { KamScraper } = await import("./kam.scraper.js");

// Layout taken from a real KAM pricelist: every word of a line shares its x/y,
// titles and descriptions wrap onto lines ~10 units apart, and only the first
// line of a product carries the price.
const line = (y, x, text, page = 1) => text.split(" ").map((str) => ({ str, x, y, page }));

const header = [
  ...line(-40, 700, "30.09.2026 9:15 AM"),
  ...line(-52, 11, "Назив"), ...line(-86, 11, "производ"),
  ...line(-52, 89, "Продажна"), ...line(-52, 172, "Единична"),
  ...line(-52, 260, "Опис"), ...line(-52, 342, "Достапност"),
];

const product = (y, { title, description, price, available = "Да" }) => [
  ...line(y + 2, 20, title[0]),
  ...line(y + 1, 270, description[0]),
  ...line(y, 110, `${price} ден .`),
  ...line(y, 183, "100 гр = 10.00"),
  ...line(y, 460, `${price} ден .`),
  ...line(y - 0.2, 379, available),
  ...title.slice(1).flatMap((t, i) => line(y - 8 - i * 10, 25, t)),
  ...description.slice(1).flatMap((d, i) => line(y - 9 - i * 10, 270, d)),
];

const parse = async (items) => {
  extractPdfTextItems.mockReturnValue(items);
  const { products } = await new KamScraper().fetchProducts(null, "https://kam.test/1.pdf", null);
  return products;
};

describe("KamScraper pricelist parsing", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      /** @type {any} */ ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("joins a title and description that wrap over several lines", async () => {
    const products = await parse([
      ...header,
      ...product(-238, {
        title: ["ТОРТ . ДОРА КАСАЛ", "ЧОКО 350"],
        description: ["MIDI ТОРТИЧКИ", "СО ЧОКОЛАДЕН", "КРЕМ"],
        price: 110,
      }),
      ...product(-276, {
        title: ["ЛЕБ ТОНУС 450 Г", "СТАНДАРД"],
        description: ["TONUS ЛЕБ", "СТАНДАРД"],
        price: 75,
      }),
    ]);

    expect(products).toEqual([
      { title: "ТОРТ . ДОРА КАСАЛ ЧОКО 350", price: 110, category: "MIDI ТОРТИЧКИ СО ЧОКОЛАДЕН КРЕМ" },
      { title: "ЛЕБ ТОНУС 450 Г СТАНДАРД", price: 75, category: "TONUS ЛЕБ СТАНДАРД" },
    ]);
  });

  it("keeps titles that contain the word 'производ'", async () => {
    const products = await parse([
      ...header,
      ...product(-388, {
        title: ["ЈУНЕШКИ", "ОБЛИКУВАН", "ПРОИЗВОД СВЕЖ"],
        description: ["TIAMO ЌЕБАПИ"],
        price: 235,
      }),
    ]);

    expect(products.map((p) => p.title)).toEqual(["ЈУНЕШКИ ОБЛИКУВАН ПРОИЗВОД СВЕЖ"]);
  });

  it("skips unavailable products and doesn't glue far-away text onto the last one", async () => {
    const products = await parse([
      ...header,
      ...product(-200, { title: ["МЛЕКО 1Л"], description: ["МЛЕКО"], price: 60, available: "НЕ" }),
      ...product(-238, { title: ["ЈОГУРТ 1Л"], description: ["ЈОГУРТ"], price: 70 }),
      ...line(-560, 20, "Страна 1 од 12"),
    ]);

    expect(products).toEqual([{ title: "ЈОГУРТ 1Л", price: 70, category: "ЈОГУРТ" }]);
  });

  it("ignores header text above the first product on later pages", async () => {
    const products = await parse([
      ...header,
      ...product(-238, { title: ["ЛЕБ БЕЛ"], description: ["ЛЕБ"], price: 30 }),
      ...line(-30, 20, "Цени важат до", 2),
      ...product(-120, { title: ["ШЕЌЕР 1КГ"], description: ["ШЕЌЕР"], price: 65 }).map((it) => ({ ...it, page: 2 })),
    ]);

    expect(products.map((p) => p.title)).toEqual(["ЛЕБ БЕЛ", "ШЕЌЕР 1КГ"]);
  });
});
