import { describe, it, expect } from "vitest";
import {
  buildBilingualRegex,
  buildBilingualTokenRegexes,
  buildWordStartMatcher,
} from "./bilingualRegex.js";

const matches = (pattern, title) => new RegExp(pattern, "i").test(title);

describe("buildBilingualRegex", () => {
  it("returns null for empty input", () => {
    expect(buildBilingualRegex("")).toBe(null);
    expect(buildBilingualRegex(null)).toBe(null);
    expect(buildBilingualRegex(undefined)).toBe(null);
  });

  it("returns regex pattern with latin and cyrillic alternatives", () => {
    const result = buildBilingualRegex("mleko");
    expect(matches(result, "Mleko 1l")).toBe(true);
    expect(matches(result, "Млеко 1л")).toBe(true);
  });

  it("handles multi-char transliterations (sh, ch, etc.)", () => {
    expect(matches(buildBilingualRegex("sheker"), "Шекер")).toBe(true);
  });

  it("escapes regex special characters", () => {
    const result = buildBilingualRegex("test (1)");
    expect(result).toContain("\\(");
    expect(result).toContain("\\)");
  });

  it("handles Cyrillic input as-is", () => {
    const result = buildBilingualRegex("леб");
    expect(result).toContain("леб");
  });

  it("splits multi-word input into token regexes", () => {
    const result = buildBilingualTokenRegexes("monster jagoda");
    expect(result).toHaveLength(2);
    expect(matches(result[0], "Монстер")).toBe(true);
    expect(matches(result[1], "Јагода")).toBe(true);
  });

  it("ignores repeated whitespace when building token regexes", () => {
    const result = buildBilingualTokenRegexes("  monster   jagoda  ");
    expect(result).toHaveLength(2);
  });

  it("lets plain ASCII input find titles spelled with diacritics or ш/ч/ж/ѓ/ќ", () => {
    const kaskaval = buildBilingualRegex("kaskaval");
    for (const title of ["Kaškaval 400g", "Кашкавал", "KASKAVAL", "каскавал"]) {
      expect(matches(kaskaval, title)).toBe(true);
    }
    expect(matches(buildBilingualRegex("secer"), "Шеќер кристал")).toBe(true);
    expect(matches(buildBilingualRegex("cokolado"), "Čokolado")).toBe(true);
    expect(matches(buildBilingualRegex("cokolado"), "Чоколадо")).toBe(true);
    expect(matches(buildBilingualRegex("mleko"), "Kafe")).toBe(false);
  });

  it("maps Macedonian Latin diacritics instead of producing mixed scripts", () => {
    expect(buildBilingualRegex("kaškaval")).toBe("kaškaval|kaskaval|kashkaval|кашкавал");
    expect(buildBilingualRegex("čokolado")).toContain("чоколадо");
    expect(buildBilingualRegex("žito")).toContain("жито");
    expect(buildBilingualRegex("ǵevrek")).toContain("ѓеврек");
    expect(buildBilingualRegex("ḱebap")).toContain("ќебап");
  });

  it("matches ASCII-folded and digraph titles for diacritic input", () => {
    const pattern = buildBilingualRegex("kaškaval");
    for (const title of ["KAŠKAVAL", "Kaskaval 400g", "kashkaval", "Кашкавал"]) {
      expect(matches(pattern, title)).toBe(true);
    }
  });

  it("handles decomposed diacritics (combining marks)", () => {
    expect(buildBilingualRegex("z\u030Cito")).toContain("жито");
  });

  it("adds Latin spellings for Cyrillic input", () => {
    const pattern = buildBilingualRegex("кашкавал");
    expect(matches(pattern, "KASKAVAL")).toBe(true);
    expect(matches(pattern, "Kashkaval")).toBe(true);
  });
});

describe("buildWordStartMatcher", () => {
  const check = (query, title) => buildWordStartMatcher(query)(title);

  it("requires the ingredient as a word, not a prefix of a longer word", () => {
    expect(check("сол", "Сол морска 1кг")).toBe(true);
    expect(check("сол", "Морска СОЛ")).toBe(true);
    expect(check("сол", "Солети стапчиња")).toBe(false);
    expect(check("млеко", "Млекара Битола")).toBe(false);
  });

  it("allows short inflected endings", () => {
    expect(check("шунка", "Шунки свински")).toBe(true);
    expect(check("јајца", "Јајце М")).toBe(true);
    expect(check("леб", "Лебче")).toBe(true);
  });

  it("ignores the ingredient after 'без'/'bez' (without)", () => {
    expect(check("шеќер", "Шеќер кристал 1кг")).toBe(true);
    expect(check("шеќер", "Бонбони без шеќер")).toBe(false);
    expect(check("шеќер", "BEZ SEKER bombone")).toBe(false);
  });

  it("matches Latin titles for Cyrillic ingredients and vice versa", () => {
    expect(check("кашкавал", "KASKAVAL 400g")).toBe(true);
    expect(check("kaškaval", "Кашкавал Битола")).toBe(true);
    expect(check("sol", "СОЛЕТИ")).toBe(false);
  });

  it("requires every token of a multi-word ingredient", () => {
    expect(check("маслиново масло", "Маслиново масло 1л")).toBe(true);
    expect(check("маслиново масло", "Масло сончогледово")).toBe(false);
  });

  it("matches nothing for an empty ingredient", () => {
    expect(check("", "Сол")).toBe(false);
  });
});
