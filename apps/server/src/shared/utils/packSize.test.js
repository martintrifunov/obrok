import { describe, it, expect } from "vitest";
import { parsePackSize } from "./packSize.js";

describe("parsePackSize", () => {
  it.each([
    ["ЛЕБ БЕЛ 500 Г ДЕМЕТРА ХАРТИЈА", 500, "g"],
    ["ТЕСТЕНИНИ ХЕЛИОС МАКАРОНИ БР.5 500ГР", 500, "g"],
    ["КАШКАВАЛ ЛИВАДА 150ГР.СЛАЈС", 150, "g"],
    ["ОРИЗ ИНТЕГРАЛЕН РИСО СКОТИ 1КГ", 1000, "g"],
    ["СИРЕЊЕ ОВЧО ОСОГОВО 1 КГ", 1000, "g"],
    ["MLEKO KOFETA 200GR KESE", 200, "g"],
    ["МЛЕКО НУНУ 4% ЛАЈТ 170Г1+1ГРАТИС", 170, "g"],
    ["ПИВО ХАЈНЕКЕН 0.25Л ШИШЕ", 250, "ml"],
    ["МАСЛО МАСЛИНОВО МОНИНИ 0,75Л СТАКЛО", 750, "ml"],
    ["МАСЛО СОНЧОГЛЕДОВО ЛЕ БОН 1 ЛИТ", 1000, "ml"],
    ["MLEKO EKONOMIK 2.8% - 1L", 1000, "ml"],
    ["МЛЕКО ЧОКОЛАДНО 1л. СУТАШ", 1000, "ml"],
    ["МАСЛО СО АРОМА 30мл", 30, "ml"],
    ["ПИВО СВЕТЛО СКОПСКО 500 МЛ 4.9% АЛК", 500, "ml"],
  ])("reads %j", (title, amount, unit) => {
    expect(parsePackSize(title)).toEqual({ amount, unit, byWeight: false });
  });

  it("multiplies multipacks", () => {
    expect(parsePackSize("ПИВО ХАЈНЕКЕН МУЛТИПАК ЛИМЕНКА 6Х0.5Л")).toMatchObject({ amount: 3000, unit: "ml" });
    expect(parsePackSize("МЛЕКО ЗА КАФЕ 10% 10х10гр.")).toMatchObject({ amount: 100, unit: "g" });
  });

  it("marks goods sold by weight", () => {
    expect(parsePackSize("КОМПИР МЛАД ДОМАШЕН КГ")).toEqual({ amount: 1000, unit: "g", byWeight: true });
    expect(parsePackSize("ШУНКА ГАВРИЛОВИЧ ВО ЦРЕВО РЕФУС / КГ")).toMatchObject({ byWeight: true });
    expect(parsePackSize("СИРЕЊЕ ОВЧО ВАКУМ кгр НИКОЛОВИ")).toMatchObject({ byWeight: true });
  });

  it("doesn't read sizes out of other words or percentages", () => {
    expect(parsePackSize("ЈАЈЦА ВЕНИ КОМ Л 10/1")).toBeNull();
    expect(parsePackSize("КАШКАВАЛ КРАВЈИ БУЧЕН КОЗЈАК")).toBeNull();
    expect(parsePackSize("МЛЕКО 3.2% ЛЕБ")).toBeNull();
  });
});
