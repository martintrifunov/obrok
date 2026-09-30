import { createElement } from "react";
import CakeIcon from "@mui/icons-material/Cake";
import SetMealIcon from "@mui/icons-material/SetMeal";
import EggIcon from "@mui/icons-material/Egg";
import BakeryDiningIcon from "@mui/icons-material/BakeryDining";
import LocalFloristIcon from "@mui/icons-material/LocalFlorist";
import RiceBowlIcon from "@mui/icons-material/RiceBowl";
import CoffeeIcon from "@mui/icons-material/Coffee";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import WineBarIcon from "@mui/icons-material/WineBar";
import SportsBarIcon from "@mui/icons-material/SportsBar";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import SoupKitchenIcon from "@mui/icons-material/SoupKitchen";
import OilBarrelIcon from "@mui/icons-material/OilBarrel";
import InventoryIcon from "@mui/icons-material/Inventory";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import IcecreamIcon from "@mui/icons-material/Icecream";
import LunchDiningIcon from "@mui/icons-material/LunchDining";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import LocalLaundryServiceIcon from "@mui/icons-material/LocalLaundryService";
import FaceIcon from "@mui/icons-material/Face";
import DescriptionIcon from "@mui/icons-material/Description";
import SmokingRoomsIcon from "@mui/icons-material/SmokingRooms";
import EditIcon from "@mui/icons-material/Edit";
import CategoryDefaultIcon from "@mui/icons-material/Category";
import PetsIcon from "@mui/icons-material/Pets";
import KitchenIcon from "@mui/icons-material/Kitchen";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import TapasIcon from "@mui/icons-material/Tapas";
import LiquorIcon from "@mui/icons-material/Liquor";
import EmojiFoodBeverageIcon from "@mui/icons-material/EmojiFoodBeverage";

const MAIN_CATEGORY_MAP = [
  {
    keywords: ["здраво тело", "аптека", "фарма", "лек", "витамин"],
    icon: LocalPharmacyIcon,
  },
  { keywords: ["месо", "месни"], icon: SetMealIcon },
  { keywords: ["млечни", "млеко", "млечн"], icon: EggIcon },
  { keywords: ["пекар", "леб"], icon: BakeryDiningIcon },
  { keywords: ["риба", "морск"], icon: KitchenIcon },
  { keywords: ["овошј", "зеленчук", "свежи производ"], icon: LocalFloristIcon },
  { keywords: ["тестенин", "ориз", "жит", "брашн"], icon: RiceBowlIcon },
  { keywords: ["кафе", "чај", "топол напиток"], icon: CoffeeIcon },
  {
    keywords: ["безалкохол", "сок", "пијалоц", "пијалок"],
    icon: LocalCafeIcon,
  },
  { keywords: ["вино", "алкохол", "жесток"], icon: WineBarIcon },
  { keywords: ["пиво"], icon: SportsBarIcon },
  { keywords: ["вода", "минерал"], icon: WaterDropIcon },
  { keywords: ["зачин", "сос", "додаток"], icon: SoupKitchenIcon },
  { keywords: ["масло", "маст", "масл", "маргарин"], icon: OilBarrelIcon },
  { keywords: ["конзерв", "готов"], icon: InventoryIcon },
  { keywords: ["замрзна", "ледени"], icon: AcUnitIcon },
  { keywords: ["бебе", "детска", "бебеш"], icon: ChildCareIcon },
  { keywords: ["кондитор", "чоколад", "слатк", "бонбон"], icon: CakeIcon },
  { keywords: ["снек", "чипс", "грицк"], icon: LunchDiningIcon },
  { keywords: ["домаќинство", "хигиен", "чист"], icon: CleaningServicesIcon },
  {
    keywords: ["детергент", "перење", "омекнувач"],
    icon: LocalLaundryServiceIcon,
  },
  { keywords: ["козметик", "нега", "убавин"], icon: FaceIcon },
  { keywords: ["хартија", "салфет", "тоалет"], icon: DescriptionIcon },
  { keywords: ["тутун", "цигар"], icon: SmokingRoomsIcon },
  { keywords: ["канцелар", "училиш"], icon: EditIcon },
  {
    keywords: ["животн", "миленич", "куч", "мачк", "храна за"],
    icon: PetsIcon,
  },
  { keywords: ["деликатес", "сувомес", "нарезок"], icon: TapasIcon },
  { keywords: ["амбалажа", "амбалаж", "повратна"], icon: ShoppingBagIcon },
  { keywords: ["батери"], icon: BatteryChargingFullIcon },
  { keywords: ["сијалиц", "ламп"], icon: LightbulbIcon },
];

const SUB_CATEGORY_MAP = [
  { keywords: ["чоколад", "алва", "какао", "наполит"], icon: CakeIcon },
  {
    keywords: ["колбас", "салам", "виршл", "шунка", "сланин"],
    icon: SetMealIcon,
  },
  { keywords: ["сирењ", "јогурт", "кашкавал", "павлак"], icon: EggIcon },
  {
    keywords: ["кифл", "бурек", "пециво", "кроасан", "земичк"],
    icon: BakeryDiningIcon,
  },
  { keywords: ["тестенин", "нудли", "шпагет"], icon: RiceBowlIcon },
  { keywords: ["кафе"], icon: CoffeeIcon },
  { keywords: ["чај"], icon: EmojiFoodBeverageIcon },
  { keywords: ["сок", "газиран", "сируп"], icon: LocalCafeIcon },
  { keywords: ["вино", "ракија", "ликер"], icon: WineBarIcon },
  { keywords: ["виски", "џин", "вотка", "рум", "бренди"], icon: LiquorIcon },
  { keywords: ["пиво"], icon: SportsBarIcon },
  { keywords: ["вода", "минерал"], icon: WaterDropIcon },
  { keywords: ["кечап", "мајонез", "сенф", "сос"], icon: SoupKitchenIcon },
  { keywords: ["масло", "маргарин"], icon: OilBarrelIcon },
  { keywords: ["туна", "конзерв", "сардин"], icon: InventoryIcon },
  { keywords: ["замрзна", "ледени"], icon: AcUnitIcon },
  {
    keywords: ["бонбон", "џем", "мармалад", "мед", "бисквит", "колач"],
    icon: IcecreamIcon,
  },
  {
    keywords: ["чипс", "крекер", "гриц", "пуканки", "кикиритк", "стапч"],
    icon: LunchDiningIcon,
  },
  {
    keywords: ["детергент", "прашок", "омекнувач"],
    icon: LocalLaundryServiceIcon,
  },
  {
    keywords: ["шампон", "крем", "сапун", "дезодоранс", "козметич"],
    icon: FaceIcon,
  },
  {
    keywords: ["хартија", "салфет", "марамиц", "тоалет"],
    icon: DescriptionIcon,
  },
  { keywords: ["паштет", "намаз"], icon: TapasIcon },
  { keywords: ["кеса", "кеси", "флаша", "шише"], icon: ShoppingBagIcon },
];

const FALLBACK_ICON = CategoryDefaultIcon;

export const getCategoryIcon = (category) => {
  if (!category) return FALLBACK_ICON;

  const normalized = category.toLowerCase();
  const parts = normalized.split(/\s*[-–—]\s*/);
  const mainPart = parts[0].trim();
  const subPart = parts.length > 1 ? parts.slice(1).join(" ").trim() : "";

  for (const entry of MAIN_CATEGORY_MAP) {
    if (entry.keywords.some((kw) => mainPart.includes(kw))) {
      return entry.icon;
    }
  }

  if (subPart) {
    for (const entry of SUB_CATEGORY_MAP) {
      if (entry.keywords.some((kw) => subPart.includes(kw))) {
        return entry.icon;
      }
    }
  }

  for (const entry of SUB_CATEGORY_MAP) {
    if (entry.keywords.some((kw) => normalized.includes(kw))) {
      return entry.icon;
    }
  }

  return FALLBACK_ICON;
};

export const CategoryIcon = ({ category, ...props }) =>
  createElement(getCategoryIcon(category), props);

export default getCategoryIcon;
