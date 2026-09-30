// Relevance checks run by eval-search.js against the live catalogue.
// `expect` and `forbid` are matched against product titles.

const PASTA = /ТЕСТЕН|ШПАГЕТ|ПЕНЕ|ФУСИЛ|МАШНИ|МАКАРОН|ФАРФАЛ|ТАЛЈАТЕЛ|ТАГЛИАТЕЛ|ЛАЗАЊ|ТОРТИГЛ|РИГАТОН|ПАСТАРОТ|ФИДЕ|PAGETI|PASTA BARILA/i;

/** Plain product search (the product tab). */
export const searchCases = [
  { q: "млеко", expect: /МЛЕКО/i, forbid: /ДЕТСКА ХРАНА|ЧОКОЛ|КАФЕ/i },
  { q: "kaskaval", expect: /КАШКАВАЛ|KAŠKAVAL|KASKAVAL/i },
  { q: "najeftin kaskaval", expect: /КАШКАВАЛ/i, priceSort: "asc" },
  { q: "najeftino mleko", expect: /МЛЕКО/i, priceSort: "asc" },
  { q: "најскапо вино", expect: /ВИНО|0[.,]75|КАРМЕНЕР|СИРАХ|МЕРЛО|ВРАНЕЦ|ШАРДОНЕ|РОЗЕ|КАБЕРНЕ/i, priceSort: "desc" },
  { q: "леб", expect: /(^|\s)ЛЕБ/i, forbid: /ЛЕБЛЕБ|ТРОШКИ|ПРЕЗЛ/i },
  { q: "јајца", expect: /ЈАЈЦ|JAJC/i, forbid: /ТЕСТЕНИН|МАЈОНЕЗ|КИНДЕР|ЧОКОЛ/i },
  { q: "шеќер", expect: /ШЕЌЕР/i, forbid: /БЕЗ ШЕЌЕР/i },
  { q: "сол", expect: /(^|\s)СОЛ(\s|$)/i, forbid: /СОЛЕТИ/i },
  { q: "тестенини", expect: PASTA },
  { q: "шпагети", expect: /ШПАГЕТ/i },
  { q: "паста за заби", expect: /ПАСТА ЗА ЗАБИ|DENT|ЗАБИ/i },
  { q: "sok od portokal", expect: /ПОРТОКАЛ/i },
  { q: "кафе", expect: /КАФЕ/i, forbid: /КАФЕАВ/i },
  { q: "banana", expect: /БАНАН/i },
  { q: "пилешко месо", expect: /ПИЛЕШК|ПИЛЕ/i, forbid: /ЗАЧИН|СОС|СУПА|ЧИПС|ХРАНА ЗА/i },
  { q: "домати", expect: /ДОМАТ/i, forbid: /КЕЧАП|ЧИПС/i },
  { q: "кока кола", expect: /КОКА|COCA/i },
  { q: "monster energy", expect: /MONSTER|МОНСТЕР/i },
  { q: "детска храна", expect: /ДЕТСК|БЕБ|BABY/i },
  { q: "нешто слатко за деца", expect: /КОЛАЧ|БИСКВИТ|ЧОКОЛ|БОНБОН|ВАФЛ|КЕКС|КРЕМ|ДЕСЕРТ/i, forbid: /ЗАЧИН|ЦИМЕТ|ВАНИЛИН|ПЧЕНКА/i },
  { q: "храна за мачки", expect: /МАЧ|CAT|WHISKAS|FELIX/i },
  { q: "масло за готвење", expect: /МАСЛО|ОЛИО/i, forbid: /МОТОР|ЗА ТЕЛО|ЗА КОСА|ЗА СОНЧ/i },
  { q: "прашок за перење", expect: /ПЕРЕЊ|ПЕРАЛ|ДЕТЕРГЕНТ|ARIEL|АРИЕЛ|PERSIL|ПЕРСИЛ|ПРАШОК|ДУЕЛ|БИОАКТИВ|МЕРИКС/i, forbid: /ВАНИЛ|ПЕЦИВ|ПУДИНГ/i },
  { q: "pivo", expect: /ПИВО|BEER|ГИНИС|ЛАГЕР|ПИЛСНЕР|ПАУЛАНЕР|ХАЈНЕКЕН|СКОПСКО|ЗЛАТЕН ДАБ|ТУБОРГ|АМСТЕЛ/i },
];

/** Ingredient picks for the meal tab: what each market would be priced with. */
export const ingredientCases = [
  { name: "паста", expect: PASTA, forbid: /ЗАБИ|КАРИ|ЧИЛИ|ГОЧУЈАНГ|DENT/i },
  { name: "сирење", expect: /СИРЕЊЕ/i, forbid: /СОС|ЗАЧИН|ЧИПС|СУПА|КРЕКЕР|ПИЦА|ПОЛНЕЊЕ/i },
  { name: "леб", expect: /(^|\s)ЛЕБ/i, forbid: /ЛЕБЛЕБ|ТРОШКИ|ПРЕЗЛ/i },
  { name: "млеко", expect: /МЛЕКО/i, forbid: /ЧОКОЛ|ДЕТСКА|КАФЕ|СОС|ЛОСИОН|ЗА ТЕЛО|ПУДИНГ/i },
  { name: "јајца", expect: /ЈАЈЦ|JAJC/i, forbid: /ТЕСТЕНИН|МАЈОНЕЗ|ЧОКОЛ|КИНДЕР/i },
  { name: "шеќер", expect: /ШЕЌЕР|ШЕКЕР/i, forbid: /БЕЗ ШЕЌЕР|БОНБОН/i },
  { name: "брашно", expect: /БРАШНО/i, forbid: /ПАНИРЕЗ|ПРЕЗЛ/i },
  { name: "путер", expect: /ПУТЕР|МАСЛО/i, forbid: /КИКИРИК|КЕКС|БИСКВИТ|КРЕКЕР|ЗА ТЕЛО/i },
  { name: "шунка", expect: /ШУНКА/i, forbid: /ПИЦА|СЕНДВИЧ|ЧИПС|САЛАМ/i },
  { name: "домати", expect: /ДОМАТ/i, forbid: /КЕЧАП|ЧИПС/i },
  { name: "кромид", expect: /КРОМИД/i, forbid: /ЧИПС|ЗАЧИН|КРЕКЕР/i },
  { name: "компир", expect: /КОМПИР/i, forbid: /ЧИПС|СТИК|КРОКЕТ/i },
  { name: "мелено месо", expect: /МЕЛЕН|MELEN/i, forbid: /ЗАЧИН|ПИПЕР/i },
  { name: "ориз", expect: /ОРИЗ/i, forbid: /ВАФЛ|ЧОКОЛ|МЛЕКО|КРЕКЕР|ГАЛЕТ/i },
  { name: "маслиново масло", expect: /МАСЛИН|ВИРЏИН|VIRGIN/i, forbid: /ЗА ТЕЛО|САПУН|КРЕМА|МАСЛИНКИ/i },
];

/** Meal decomposition by the intent parser (costs one LLM call each). */
export const mealCases = [
  { q: "pasta so sirenje", expect: [PASTA.source + "|ПАСТА", "СИРЕЊЕ"] },
  { q: "направи ми палачинки", expect: ["БРАШНО", "ЈАЈЦ", "МЛЕКО"] },
  { q: "sakam da jadam sendvich so kaskaval i shunka", expect: ["ЛЕБ", "КАШКАВАЛ", "ШУНКА"] },
  { q: "musaka", expect: ["КОМПИР|ПАТЛИЏАН", "МЕЛЕН|МЕСО"] },
  { q: "tavche gravche", expect: ["ГРАВ", "КРОМИД"] },
  { q: "omlet", expect: ["ЈАЈЦ"] },
];
