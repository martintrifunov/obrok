import { describe, it, expect } from "vitest";
import { extractPdfTextItems, parseToUnicodeCMap } from "./pdf-text-extractor.js";

describe("extractPdfTextItems", () => {
  it("returns empty array for empty buffer", () => {
    const result = extractPdfTextItems(Buffer.alloc(0));
    expect(result).toEqual([]);
  });

  it("returns empty array for non-PDF buffer", () => {
    const result = extractPdfTextItems(Buffer.from("not a pdf file"));
    expect(result).toEqual([]);
  });

  it("returns empty array for buffer with no FlateDecode streams", () => {
    const fakePdf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
    );
    const result = extractPdfTextItems(fakePdf);
    expect(result).toEqual([]);
  });

  it("returns array type", () => {
    const result = extractPdfTextItems(Buffer.from("%PDF-1.4"));
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("parseToUnicodeCMap", () => {
  const cmap = (body) => `begincmap\n${body}\nendcmap`;

  it("maps a bfrange with a hex destination", () => {
    const map = parseToUnicodeCMap(cmap("1 beginbfrange\n<01> <03> <0041>\nendbfrange"), 1);
    expect([...map]).toEqual([
      ["01", "A"],
      ["02", "B"],
      ["03", "C"],
    ]);
  });

  it("maps Cyrillic destinations", () => {
    const map = parseToUnicodeCMap(cmap("1 beginbfrange\n<0010> <0011> <0410>\nendbfrange"), 2);
    expect(map.get("0010")).toBe("А");
    expect(map.get("0011")).toBe("Б");
  });

  it("maps a bfrange with an array destination", () => {
    const map = parseToUnicodeCMap(
      cmap("1 beginbfrange\n<0003> <0005> [<0041> <0439> <00660069>]\nendbfrange"),
      2,
    );
    expect(map.get("0003")).toBe("A");
    expect(map.get("0004")).toBe("й");
    expect(map.get("0005")).toBe("fi");
  });

  it("maps bfchar entries", () => {
    const map = parseToUnicodeCMap(
      cmap("2 beginbfchar\n<0001> <0020>\n<0002> <041C>\nendbfchar"),
      2,
    );
    expect(map.get("0001")).toBe(" ");
    expect(map.get("0002")).toBe("М");
  });

  it("decodes multi-character ligature destinations without throwing", () => {
    const map = parseToUnicodeCMap(cmap("1 beginbfchar\n<001F> <00660069>\nendbfchar"), 2);
    expect(map.get("001f")).toBe("fi");
  });

  it("decodes UTF-16 surrogate pairs", () => {
    const map = parseToUnicodeCMap(cmap("1 beginbfchar\n<0001> <D835DC00>\nendbfchar"), 2);
    expect(map.get("0001")).toBe("𝐀");
    expect(map.get("0001").codePointAt(0)).toBe(0x1d400);
  });

  it("increments the last code unit of a multi-unit bfrange destination", () => {
    const map = parseToUnicodeCMap(cmap("1 beginbfrange\n<01> <02> <00660069>\nendbfrange"), 1);
    expect(map.get("01")).toBe("fi");
    expect(map.get("02")).toBe("fj");
  });

  it("skips malformed entries and keeps the valid ones", () => {
    const map = parseToUnicodeCMap(
      cmap(
        [
          "3 beginbfrange",
          "<05> <01> <0041>", // end before start
          "<0000> <FFFFFF> <0041>", // absurd span
          "<10> <11> <0061>",
          "endbfrange",
          "2 beginbfchar",
          "<20> <>", // empty destination
          "<21> <0062>",
          "endbfchar",
        ].join("\n"),
      ),
      1,
    );
    expect([...map.keys()].sort()).toEqual(["10", "11", "21"]);
    expect(map.get("11")).toBe("b");
    expect(map.get("21")).toBe("b");
  });

  it("returns an empty map when there are no mappings", () => {
    expect(parseToUnicodeCMap(cmap(""), 1).size).toBe(0);
  });
});
