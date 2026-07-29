import {
  chinaProvinceKey,
  type CityVisit,
  type TravelType,
} from "./atlas-data";

export const ROAMING_TITLE_CATEGORIES = [
  {
    id: "milestone",
    label: "起步里程",
    description: "从第一枚图钉，到真正把世界晃熟。",
  },
  {
    id: "continent",
    label: "大洲熟度",
    description: "看你在哪一块大陆留下了最多故事。",
  },
  {
    id: "region",
    label: "热门区域",
    description: "东欧、西欧、南法、东南亚，各有自己的晃法。",
  },
  {
    id: "combo",
    label: "经典组合",
    description: "旅行者之间一说就懂的国家组合。",
  },
  {
    id: "style",
    label: "旅行方式",
    description: "路过、出差、留学、常住，去过不等于一种去法。",
  },
  {
    id: "time",
    label: "时间复访",
    description: "有人一直向前，有人把喜欢的地方一去再去。",
  },
  {
    id: "china",
    label: "中国专属",
    description: "先把家门口、大江南北和东西海岸晃明白。",
  },
  {
    id: "geo",
    label: "地理彩蛋",
    description: "半球、赤道、极圈和跨度，藏在坐标里的惊喜。",
  },
] as const;

export type RoamingTitleCategoryId =
  (typeof ROAMING_TITLE_CATEGORIES)[number]["id"];

export type CountryRegionInfo = {
  continent: string;
  subregion: string;
};

export type CountryRegionMap = Record<string, CountryRegionInfo>;

export const COUNTRY_REGION_FALLBACKS: CountryRegionMap = {
  AD: { continent: "Europe", subregion: "Southern Europe" },
  LI: { continent: "Europe", subregion: "Western Europe" },
  MC: { continent: "Europe", subregion: "Western Europe" },
  MV: { continent: "Asia", subregion: "Southern Asia" },
  SG: { continent: "Asia", subregion: "South-Eastern Asia" },
  SM: { continent: "Europe", subregion: "Southern Europe" },
  VA: { continent: "Europe", subregion: "Southern Europe" },
  XK: { continent: "Europe", subregion: "Southern Europe" },
};

export type RoamingTitleTone =
  | "lime"
  | "ocean"
  | "pink"
  | "purple"
  | "orange";

type RuleResult = {
  unlocked: boolean;
  progress: number;
  progressLabel: string;
};

type RoamingTitleContext = {
  visits: CityVisit[];
  countries: Set<string>;
  uniqueCities: CityVisit[];
  cityVisits: Map<string, CityVisit[]>;
  countriesByContinent: Map<string, Set<string>>;
  countriesBySubregion: Map<string, Set<string>>;
  cnProvinces: Set<string>;
  years: number[];
  seasons: Set<string>;
  maxConsecutiveYears: number;
  maxContinentsInYear: number;
  maxSameCityVisits: number;
  maxCityYearSpan: number;
  mixedIdentityCities: number;
  weekendVisits: number;
  overseasDeepCountries: Set<string>;
  studyCountries: Set<string>;
  businessCountries: Set<string>;
  travelTypeCounts: Map<TravelType, number>;
  latitudeMin: number;
  latitudeMax: number;
  longitudeMin: number;
  longitudeMax: number;
};

type RoamingTitleDefinition = {
  id: string;
  category: RoamingTitleCategoryId;
  title: string;
  description: string;
  tone: RoamingTitleTone;
  priority: number;
  evaluate: (context: RoamingTitleContext) => RuleResult;
};

export type EvaluatedRoamingTitle = Omit<
  RoamingTitleDefinition,
  "evaluate"
> &
  RuleResult;

const DEEP_TRAVEL_TYPES = new Set<TravelType>(["短居 / 留学", "常住"]);
const AURORA_COUNTRIES = new Set(["IS", "NO", "SE", "FI", "CA", "US", "RU", "GL"]);
const ISLAND_COUNTRIES = new Set([
  "IS",
  "IE",
  "GB",
  "JP",
  "PH",
  "ID",
  "LK",
  "MV",
  "FJ",
  "NZ",
  "SG",
  "MT",
  "CY",
  "CU",
  "JM",
  "BS",
  "MU",
  "SC",
  "MG",
]);

const SOUTH_FRANCE_MARKERS = [
  "尼斯",
  "nice",
  "戛纳",
  "cannes",
  "马赛",
  "marseille",
  "艾克斯",
  "aix",
  "阿维尼翁",
  "avignon",
  "阿尔勒",
  "arles",
  "蒙彼利埃",
  "montpellier",
  "圣特罗佩",
  "sainttropez",
  "土伦",
  "toulon",
  "尼姆",
  "nimes",
  "普罗旺斯",
  "provence",
  "蔚蓝海岸",
  "cotedazur",
];

const CN_NORTH = new Set([
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "山东",
  "河南",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
]);
const CN_SOUTH = new Set([
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "香港",
  "澳门",
  "台湾",
]);
const CN_EAST = new Set([
  "北京",
  "天津",
  "河北",
  "辽宁",
  "山东",
  "上海",
  "江苏",
  "浙江",
  "福建",
  "广东",
  "海南",
  "香港",
  "澳门",
  "台湾",
]);
const CN_WEST = new Set([
  "内蒙古",
  "广西",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
]);
const CN_COASTAL = new Set([
  "辽宁",
  "河北",
  "天津",
  "山东",
  "江苏",
  "上海",
  "浙江",
  "福建",
  "广东",
  "广西",
  "海南",
  "香港",
  "澳门",
  "台湾",
]);

function cityKey(visit: Pick<CityVisit, "countryCode" | "name">) {
  return `${visit.countryCode}:${visit.name.trim().toLowerCase()}`;
}

function addToSetMap(
  map: Map<string, Set<string>>,
  key: string,
  value: string,
) {
  if (!key) return;
  const current = map.get(key) ?? new Set<string>();
  current.add(value);
  map.set(key, current);
}

function countResult(current: number, target: number, unit: string): RuleResult {
  const safeTarget = Math.max(1, target);
  return {
    unlocked: current >= target,
    progress: Math.min(1, current / safeTarget),
    progressLabel:
      current >= target
        ? `已解锁 · ${current} ${unit}`
        : `${current} / ${target} ${unit}`,
  };
}

function conditionResult(
  unlocked: boolean,
  progress: number,
  progressLabel: string,
): RuleResult {
  return {
    unlocked,
    progress: Math.max(0, Math.min(1, progress)),
    progressLabel,
  };
}

function countrySetResult(
  context: RoamingTitleContext,
  codes: string[],
  target = codes.length,
): RuleResult {
  const current = codes.filter((code) => context.countries.has(code)).length;
  return countResult(current, target, "个目的地");
}

function continentResult(
  context: RoamingTitleContext,
  continent: string,
  target: number,
): RuleResult {
  return countResult(
    context.countriesByContinent.get(continent)?.size ?? 0,
    target,
    "个国家",
  );
}

function subregionResult(
  context: RoamingTitleContext,
  subregion: string,
  target: number,
): RuleResult {
  return countResult(
    context.countriesBySubregion.get(subregion)?.size ?? 0,
    target,
    "个国家",
  );
}

function countInSet(values: Set<string>, candidates: Set<string>) {
  let count = 0;
  values.forEach((value) => {
    if (candidates.has(value)) count += 1;
  });
  return count;
}

function normalizePlaceText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s·•・／/\\'’_-]/g, "");
}

function matchingCityCount(
  context: RoamingTitleContext,
  countryCode: string,
  markers: string[],
) {
  const normalizedMarkers = markers.map(normalizePlaceText);
  return context.uniqueCities.filter((visit) => {
    if (visit.countryCode !== countryCode) return false;
    const haystack = normalizePlaceText(
      [visit.name, visit.region, visit.subtitle].filter(Boolean).join(" "),
    );
    return normalizedMarkers.some((marker) => haystack.includes(marker));
  }).length;
}

function buildContext(
  visits: CityVisit[],
  countryRegions: CountryRegionMap,
): RoamingTitleContext {
  const countries = new Set(visits.map((visit) => visit.countryCode));
  const cityVisits = new Map<string, CityVisit[]>();
  visits.forEach((visit) => {
    const key = cityKey(visit);
    cityVisits.set(key, [...(cityVisits.get(key) ?? []), visit]);
  });
  const uniqueCities = [...cityVisits.values()].map((items) => items[0]);

  const countriesByContinent = new Map<string, Set<string>>();
  const countriesBySubregion = new Map<string, Set<string>>();
  countries.forEach((code) => {
    const region = countryRegions[code];
    if (!region) return;
    addToSetMap(countriesByContinent, region.continent, code);
    addToSetMap(countriesBySubregion, region.subregion, code);
  });

  const cnProvinces = new Set(
    visits
      .filter((visit) => visit.countryCode === "CN")
      .map(chinaProvinceKey)
      .filter(Boolean),
  );
  const years = [
    ...new Set(
      visits
        .map((visit) => Number(visit.visitedOn.slice(0, 4)))
        .filter(Number.isFinite),
    ),
  ].sort((left, right) => left - right);
  let maxConsecutiveYears = years.length ? 1 : 0;
  let consecutive = years.length ? 1 : 0;
  for (let index = 1; index < years.length; index += 1) {
    consecutive = years[index] === years[index - 1] + 1 ? consecutive + 1 : 1;
    maxConsecutiveYears = Math.max(maxConsecutiveYears, consecutive);
  }

  const seasons = new Set<string>();
  visits.forEach((visit) => {
    const month = Number(visit.visitedOn.slice(5, 7));
    if (month >= 3 && month <= 5) seasons.add("spring");
    else if (month >= 6 && month <= 8) seasons.add("summer");
    else if (month >= 9 && month <= 11) seasons.add("autumn");
    else if (month === 12 || month === 1 || month === 2) seasons.add("winter");
  });

  const yearContinents = new Map<string, Set<string>>();
  visits.forEach((visit) => {
    const year = Number(visit.visitedOn.slice(0, 4));
    const continent = countryRegions[visit.countryCode]?.continent;
    if (!Number.isFinite(year) || !continent) return;
    addToSetMap(yearContinents, String(year), continent);
  });
  const maxContinentsInYear = Math.max(
    0,
    ...[...yearContinents.values()].map((continents) => continents.size),
  );

  let maxSameCityVisits = 0;
  let maxCityYearSpan = 0;
  let mixedIdentityCities = 0;
  cityVisits.forEach((items) => {
    maxSameCityVisits = Math.max(maxSameCityVisits, items.length);
    const cityYears = items
      .map((visit) => Number(visit.visitedOn.slice(0, 4)))
      .filter(Number.isFinite);
    if (cityYears.length > 1) {
      maxCityYearSpan = Math.max(
        maxCityYearSpan,
        Math.max(...cityYears) - Math.min(...cityYears),
      );
    }
    if (new Set(items.map((visit) => visit.travelType)).size >= 2) {
      mixedIdentityCities += 1;
    }
  });

  const travelTypeCounts = new Map<TravelType, number>();
  visits.forEach((visit) =>
    travelTypeCounts.set(
      visit.travelType,
      (travelTypeCounts.get(visit.travelType) ?? 0) + 1,
    ),
  );
  const overseasDeepCountries = new Set(
    visits
      .filter(
        (visit) =>
          visit.countryCode !== "CN" && DEEP_TRAVEL_TYPES.has(visit.travelType),
      )
      .map((visit) => visit.countryCode),
  );
  const studyCountries = new Set(
    visits
      .filter((visit) => visit.travelType === "短居 / 留学")
      .map((visit) => visit.countryCode),
  );
  const businessCountries = new Set(
    visits
      .filter((visit) => visit.travelType === "出差")
      .map((visit) => visit.countryCode),
  );
  const weekendVisits = visits.filter((visit) => {
    const date = new Date(`${visit.visitedOn}T00:00:00Z`);
    const day = date.getUTCDay();
    return day === 0 || day === 6;
  }).length;

  const latitudes = uniqueCities.map((visit) => visit.latitude);
  const longitudes = uniqueCities.map((visit) => visit.longitude);

  return {
    visits,
    countries,
    uniqueCities,
    cityVisits,
    countriesByContinent,
    countriesBySubregion,
    cnProvinces,
    years,
    seasons,
    maxConsecutiveYears,
    maxContinentsInYear,
    maxSameCityVisits,
    maxCityYearSpan,
    mixedIdentityCities,
    weekendVisits,
    overseasDeepCountries,
    studyCountries,
    businessCountries,
    travelTypeCounts,
    latitudeMin: latitudes.length ? Math.min(...latitudes) : 0,
    latitudeMax: latitudes.length ? Math.max(...latitudes) : 0,
    longitudeMin: longitudes.length ? Math.min(...longitudes) : 0,
    longitudeMax: longitudes.length ? Math.max(...longitudes) : 0,
  };
}

export const ROAMING_TITLES: RoamingTitleDefinition[] = [
  {
    id: "wander-free",
    category: "milestone",
    title: "晃悠自由人",
    description: "不赶趟，不排名；路线怎么长，自己说了算。",
    tone: "lime",
    priority: 1,
    evaluate: () => conditionResult(true, 1, "基础称号 · 永久可用"),
  },
  {
    id: "first-pin",
    category: "milestone",
    title: "第一枚图钉",
    description: "世界很大，但地图总要从一座城开始。",
    tone: "lime",
    priority: 15,
    evaluate: (context) => countResult(context.uniqueCities.length, 1, "座城市"),
  },
  {
    id: "three-city-wanderer",
    category: "milestone",
    title: "三城小晃",
    description: "三座城市，已经足够长出一点旅行脾气。",
    tone: "lime",
    priority: 22,
    evaluate: (context) => countResult(context.uniqueCities.length, 3, "座城市"),
  },
  {
    id: "five-country-visitor",
    category: "milestone",
    title: "五国串门客",
    description: "护照开始有点忙，地球开始有点熟。",
    tone: "lime",
    priority: 34,
    evaluate: (context) => countResult(context.countries.size, 5, "个国家"),
  },
  {
    id: "ten-country-roamer",
    category: "milestone",
    title: "十国漫游者",
    description: "两位数以后，旅行就不再只是偶尔出门。",
    tone: "lime",
    priority: 40,
    evaluate: (context) => countResult(context.countries.size, 10, "个国家"),
  },
  {
    id: "twenty-country-regular",
    category: "milestone",
    title: "地球常客",
    description: "去过二十个国家，已经很难说自己只是路过。",
    tone: "lime",
    priority: 47,
    evaluate: (context) => countResult(context.countries.size, 20, "个国家"),
  },
  {
    id: "intercontinental-roamer",
    category: "milestone",
    title: "洲际晃客",
    description: "地图上的颜色，已经跨过三块大陆。",
    tone: "lime",
    priority: 52,
    evaluate: (context) =>
      countResult(context.countriesByContinent.size, 3, "个大洲"),
  },

  {
    id: "asia-neighbor",
    category: "continent",
    title: "亚洲串门客",
    description: "在亚洲去过三国，近邻也能晃出大世界。",
    tone: "ocean",
    priority: 55,
    evaluate: (context) => continentResult(context, "Asia", 3),
  },
  {
    id: "asia-regular",
    category: "continent",
    title: "亚洲熟门熟路",
    description: "八个亚洲国家，语言和口味都切换得很自然。",
    tone: "ocean",
    priority: 62,
    evaluate: (context) => continentResult(context, "Asia", 8),
  },
  {
    id: "europe-roamer",
    category: "continent",
    title: "欧罗巴漫游者",
    description: "至少三个欧洲国家，已经晃出一点欧陆版图。",
    tone: "ocean",
    priority: 56,
    evaluate: (context) => continentResult(context, "Europe", 3),
  },
  {
    id: "europe-pass",
    category: "continent",
    title: "欧罗巴通行证",
    description: "八个欧洲国家，古城、火车和广场已经连成片。",
    tone: "ocean",
    priority: 64,
    evaluate: (context) => continentResult(context, "Europe", 8),
  },
  {
    id: "africa-eye-opener",
    category: "continent",
    title: "非洲开眼人",
    description: "在三个非洲国家留下足迹，世界的尺度又大了一圈。",
    tone: "ocean",
    priority: 58,
    evaluate: (context) => continentResult(context, "Africa", 3),
  },
  {
    id: "north-america-neighbor",
    category: "continent",
    title: "北美串门客",
    description: "北美三国以上，城市、旷野和海岸都有了坐标。",
    tone: "ocean",
    priority: 57,
    evaluate: (context) => continentResult(context, "North America", 3),
  },
  {
    id: "south-america-slow",
    category: "continent",
    title: "南美慢晃家",
    description: "三个南美国家，值得把节奏放慢一点。",
    tone: "ocean",
    priority: 58,
    evaluate: (context) => continentResult(context, "South America", 3),
  },

  {
    id: "west-europe-streets",
    category: "region",
    title: "西欧街巷熟客",
    description: "至少三个西欧国家，广场与街角都不再陌生。",
    tone: "pink",
    priority: 76,
    evaluate: (context) => subregionResult(context, "Western Europe", 3),
  },
  {
    id: "east-europe-slow",
    category: "region",
    title: "东欧慢晃家",
    description: "至少三个东欧国家，旧城和边界都有自己的时间。",
    tone: "pink",
    priority: 77,
    evaluate: (context) => subregionResult(context, "Eastern Europe", 3),
  },
  {
    id: "both-sides-europe",
    category: "region",
    title: "欧陆两面通",
    description: "东欧、西欧各去过至少两国，欧洲不只一张脸。",
    tone: "pink",
    priority: 91,
    evaluate: (context) => {
      const west =
        context.countriesBySubregion.get("Western Europe")?.size ?? 0;
      const east =
        context.countriesBySubregion.get("Eastern Europe")?.size ?? 0;
      const progress = Math.min(west / 2, east / 2, 1);
      return conditionResult(
        west >= 2 && east >= 2,
        progress,
        west >= 2 && east >= 2
          ? "已解锁 · 东西欧都晃过"
          : `西欧 ${west}/2 · 东欧 ${east}/2`,
      );
    },
  },
  {
    id: "southern-europe-sun",
    category: "region",
    title: "南欧晒太阳协会",
    description: "三个南欧国家，阳光、海风和晚饭时间都很南。",
    tone: "pink",
    priority: 78,
    evaluate: (context) => subregionResult(context, "Southern Europe", 3),
  },
  {
    id: "south-france-ease",
    category: "region",
    title: "南法松弛派",
    description: "阳光、海岸、小镇与市集，至少认真晃过两座南法城市。",
    tone: "pink",
    priority: 96,
    evaluate: (context) =>
      countResult(
        matchingCityCount(context, "FR", SOUTH_FRANCE_MARKERS),
        2,
        "座南法城市",
      ),
  },
  {
    id: "southeast-asia-warm",
    category: "region",
    title: "东南亚常温区",
    description: "新马泰越印之中去过三国，热带已经开始熟悉。",
    tone: "pink",
    priority: 79,
    evaluate: (context) =>
      countrySetResult(context, ["SG", "MY", "TH", "VN", "ID"], 3),
  },
  {
    id: "southeast-asia-fluent",
    category: "region",
    title: "东南亚熟门熟路",
    description: "新加坡、马来西亚、泰国、越南、印尼全部点亮。",
    tone: "pink",
    priority: 94,
    evaluate: (context) =>
      countrySetResult(context, ["SG", "MY", "TH", "VN", "ID"]),
  },
  {
    id: "east-asia-neighbors",
    category: "region",
    title: "东亚近邻串门王",
    description: "东亚三国以上，周边世界被你走出了连续剧。",
    tone: "pink",
    priority: 79,
    evaluate: (context) => subregionResult(context, "Eastern Asia", 3),
  },
  {
    id: "central-asia-three",
    category: "region",
    title: "中亚三连客",
    description: "中亚五国里点亮三个，草原与旧城开始连线。",
    tone: "pink",
    priority: 82,
    evaluate: (context) =>
      countrySetResult(context, ["KZ", "KG", "TJ", "TM", "UZ"], 3),
  },
  {
    id: "caribbean-island-hop",
    category: "region",
    title: "加勒比跳岛客",
    description: "三个加勒比目的地，海水也有不同口音。",
    tone: "pink",
    priority: 82,
    evaluate: (context) => subregionResult(context, "Caribbean", 3),
  },

  {
    id: "caucasus-brothers",
    category: "combo",
    title: "高加索三兄弟",
    description: "格鲁吉亚、亚美尼亚、阿塞拜疆，全员都见过。",
    tone: "purple",
    priority: 110,
    evaluate: (context) => countrySetResult(context, ["GE", "AM", "AZ"]),
  },
  {
    id: "singapore-malaysia-thailand",
    category: "combo",
    title: "新马泰三连晃",
    description: "经典南洋三角，被你走成了自己的版本。",
    tone: "purple",
    priority: 107,
    evaluate: (context) => countrySetResult(context, ["SG", "MY", "TH"]),
  },
  {
    id: "japan-korea-double",
    category: "combo",
    title: "日韩双开",
    description: "东京与首尔之外，两种近邻日常都认真看过。",
    tone: "purple",
    priority: 99,
    evaluate: (context) => countrySetResult(context, ["JP", "KR"]),
  },
  {
    id: "china-japan-korea",
    category: "combo",
    title: "东亚三角已成形",
    description: "中国、日本、韩国三点连线，东亚地图完整了一角。",
    tone: "purple",
    priority: 106,
    evaluate: (context) => countrySetResult(context, ["CN", "JP", "KR"]),
  },
  {
    id: "nordic-five",
    category: "combo",
    title: "北欧五国全勤",
    description: "丹麦、瑞典、挪威、芬兰、冰岛全部点亮。",
    tone: "purple",
    priority: 112,
    evaluate: (context) =>
      countrySetResult(context, ["DK", "SE", "NO", "FI", "IS"]),
  },
  {
    id: "aurora-waiting-zone",
    category: "combo",
    title: "极光带候场人",
    description: "未必保证见到极光，但你已经站进它常出没的纬度。",
    tone: "purple",
    priority: 101,
    evaluate: (context) => {
      const cities = context.uniqueCities.filter(
        (visit) =>
          visit.latitude >= 60 && AURORA_COUNTRIES.has(visit.countryCode),
      ).length;
      return countResult(cities, 2, "座高纬城市");
    },
  },
  {
    id: "baltic-three",
    category: "combo",
    title: "波罗的海三连",
    description: "爱沙尼亚、拉脱维亚、立陶宛，三座旧城文明同时点亮。",
    tone: "purple",
    priority: 106,
    evaluate: (context) => countrySetResult(context, ["EE", "LV", "LT"]),
  },
  {
    id: "benelux-three",
    category: "combo",
    title: "低地三国串门王",
    description: "荷兰、比利时、卢森堡，小国之间也能晃很久。",
    tone: "purple",
    priority: 105,
    evaluate: (context) => countrySetResult(context, ["NL", "BE", "LU"]),
  },
  {
    id: "iberia-double",
    category: "combo",
    title: "伊比利亚双晃",
    description: "西班牙与葡萄牙，半岛两边都留下足迹。",
    tone: "purple",
    priority: 101,
    evaluate: (context) => countrySetResult(context, ["ES", "PT"]),
  },
  {
    id: "balkan-turns",
    category: "combo",
    title: "巴尔干拐弯王",
    description: "巴尔干目的地去过四个，边界再多也拦不住你。",
    tone: "purple",
    priority: 104,
    evaluate: (context) =>
      countrySetResult(
        context,
        ["AL", "BA", "BG", "HR", "ME", "MK", "RS", "SI", "XK", "GR"],
        4,
      ),
  },
  {
    id: "central-asia-five",
    category: "combo",
    title: "中亚五国全勤",
    description: "哈萨克斯坦、吉尔吉斯斯坦、塔吉克斯坦、土库曼斯坦、乌兹别克斯坦全部点亮。",
    tone: "purple",
    priority: 113,
    evaluate: (context) =>
      countrySetResult(context, ["KZ", "KG", "TJ", "TM", "UZ"]),
  },

  {
    id: "foreign-local",
    category: "style",
    title: "异乡生活家",
    description: "不只路过，也曾在境外短居、留学或生活。",
    tone: "orange",
    priority: 98,
    evaluate: (context) =>
      countResult(context.overseasDeepCountries.size, 1, "个生活过的国家"),
  },
  {
    id: "multi-home",
    category: "style",
    title: "多地生活体质",
    description: "在两个国家短居或常住，生活不只一个坐标。",
    tone: "orange",
    priority: 105,
    evaluate: (context) =>
      countResult(context.overseasDeepCountries.size, 2, "个生活过的国家"),
  },
  {
    id: "world-exchange-student",
    category: "style",
    title: "世界交换生",
    description: "至少在两个国家有过短居或留学记录。",
    tone: "orange",
    priority: 103,
    evaluate: (context) =>
      countResult(context.studyCountries.size, 2, "个短居或留学国家"),
  },
  {
    id: "global-worker",
    category: "style",
    title: "全球打工人",
    description: "三个国家留下出差记录，工位跟着护照移动。",
    tone: "orange",
    priority: 96,
    evaluate: (context) =>
      countResult(context.businessCountries.size, 3, "个出差国家"),
  },
  {
    id: "passing-still-counts",
    category: "style",
    title: "路过也留名",
    description: "五次短暂停留，每一次经过也都算数。",
    tone: "orange",
    priority: 74,
    evaluate: (context) =>
      countResult(context.travelTypeCounts.get("路过") ?? 0, 5, "次路过"),
  },
  {
    id: "went-there-on-purpose",
    category: "style",
    title: "专程去看的人",
    description: "五次专程游览，喜欢的地方值得认真抵达。",
    tone: "orange",
    priority: 78,
    evaluate: (context) =>
      countResult(context.travelTypeCounts.get("旅游") ?? 0, 5, "次旅游"),
  },
  {
    id: "one-city-many-identities",
    category: "style",
    title: "一城多重身份",
    description: "同一座城市，用过至少两种方式重新认识。",
    tone: "orange",
    priority: 102,
    evaluate: (context) =>
      countResult(context.mixedIdentityCities, 1, "座多重身份城市"),
  },

  {
    id: "return-again",
    category: "time",
    title: "故地重晃",
    description: "同一座城市至少去过两次，喜欢不是一次性的。",
    tone: "pink",
    priority: 87,
    evaluate: (context) =>
      countResult(context.maxSameCityVisits, 2, "次同城到访"),
  },
  {
    id: "city-replay",
    category: "time",
    title: "一城多刷",
    description: "同一座城市三次以上，已经有自己的固定路线。",
    tone: "pink",
    priority: 95,
    evaluate: (context) =>
      countResult(context.maxSameCityVisits, 3, "次同城到访"),
  },
  {
    id: "year-after-year",
    category: "time",
    title: "年年有晃",
    description: "连续三年都有到访记录，旅行已经长进日历。",
    tone: "pink",
    priority: 84,
    evaluate: (context) =>
      countResult(context.maxConsecutiveYears, 3, "个连续年份"),
  },
  {
    id: "four-seasons",
    category: "time",
    title: "四季都在路上",
    description: "春夏秋冬都留下过出发的日期。",
    tone: "pink",
    priority: 90,
    evaluate: (context) => countResult(context.seasons.size, 4, "个季节"),
  },
  {
    id: "ten-year-map",
    category: "time",
    title: "十年地图",
    description: "最早与最近的足迹相隔十年，地图也有了年轮。",
    tone: "pink",
    priority: 94,
    evaluate: (context) => {
      const span = context.years.length
        ? context.years[context.years.length - 1] - context.years[0]
        : 0;
      return countResult(span, 10, "年跨度");
    },
  },
  {
    id: "old-place-new-chapter",
    category: "time",
    title: "旧地新章",
    description: "同一座城市跨越三年以上重访，旧地方也会长出新故事。",
    tone: "pink",
    priority: 97,
    evaluate: (context) => countResult(context.maxCityYearSpan, 3, "年同城跨度"),
  },
  {
    id: "weekend-pilot",
    category: "time",
    title: "周末飞行员",
    description: "五次到访落在周末，休息日也不肯待在原地。",
    tone: "pink",
    priority: 79,
    evaluate: (context) => countResult(context.weekendVisits, 5, "次周末到访"),
  },

  {
    id: "china-wanderer",
    category: "china",
    title: "神州晃客",
    description: "先把家门口晃明白，中国地图已经有了第一笔。",
    tone: "lime",
    priority: 66,
    evaluate: (context) => countResult(context.cnProvinces.size, 1, "个省级区域"),
  },
  {
    id: "five-province-neighbor",
    category: "china",
    title: "五省串门客",
    description: "五个省级区域，家门口也能一路晃远。",
    tone: "lime",
    priority: 73,
    evaluate: (context) => countResult(context.cnProvinces.size, 5, "个省级区域"),
  },
  {
    id: "ten-province-neighbor",
    category: "china",
    title: "十省串门客",
    description: "十个省级区域，中国已经被你晃出轮廓。",
    tone: "lime",
    priority: 82,
    evaluate: (context) => countResult(context.cnProvinces.size, 10, "个省级区域"),
  },
  {
    id: "half-familiar-china",
    category: "china",
    title: "神州半熟",
    description: "十七个省级区域，半张中国地图已经有故事。",
    tone: "lime",
    priority: 92,
    evaluate: (context) => countResult(context.cnProvinces.size, 17, "个省级区域"),
  },
  {
    id: "north-south-china",
    category: "china",
    title: "大江南北都认识",
    description: "南北各去过至少三个省级区域，口音和温度都换过。",
    tone: "lime",
    priority: 95,
    evaluate: (context) => {
      const north = countInSet(context.cnProvinces, CN_NORTH);
      const south = countInSet(context.cnProvinces, CN_SOUTH);
      return conditionResult(
        north >= 3 && south >= 3,
        Math.min(north / 3, south / 3, 1),
        north >= 3 && south >= 3
          ? "已解锁 · 南北都晃过"
          : `北方 ${north}/3 · 南方 ${south}/3`,
      );
    },
  },
  {
    id: "east-west-china",
    category: "china",
    title: "东西横着晃",
    description: "东部与西部各去过至少两个省级区域。",
    tone: "lime",
    priority: 94,
    evaluate: (context) => {
      const east = countInSet(context.cnProvinces, CN_EAST);
      const west = countInSet(context.cnProvinces, CN_WEST);
      return conditionResult(
        east >= 2 && west >= 2,
        Math.min(east / 2, west / 2, 1),
        east >= 2 && west >= 2
          ? "已解锁 · 东西都晃过"
          : `东部 ${east}/2 · 西部 ${west}/2`,
      );
    },
  },
  {
    id: "municipalities-complete",
    category: "china",
    title: "直辖市全勤",
    description: "北京、上海、天津、重庆全部点亮。",
    tone: "lime",
    priority: 103,
    evaluate: (context) =>
      countResult(
        countInSet(context.cnProvinces, new Set(["北京", "上海", "天津", "重庆"])),
        4,
        "座直辖市",
      ),
  },
  {
    id: "coastal-pearls",
    category: "china",
    title: "沿海串珠",
    description: "六个沿海省级区域，海岸线被你串成了一条项链。",
    tone: "lime",
    priority: 91,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_COASTAL), 6, "个沿海区域"),
  },

  {
    id: "both-hemispheres",
    category: "geo",
    title: "南北半球双开",
    description: "赤道南北都留下过城市坐标。",
    tone: "ocean",
    priority: 93,
    evaluate: (context) =>
      conditionResult(
        context.latitudeMin < 0 && context.latitudeMax > 0,
        context.latitudeMin < 0 && context.latitudeMax > 0 ? 1 : 0.5,
        context.latitudeMin < 0 && context.latitudeMax > 0
          ? "已解锁 · 南北半球都有足迹"
          : "还差另一个半球",
      ),
  },
  {
    id: "east-west-hemispheres",
    category: "geo",
    title: "东西半球都留过点",
    description: "本初子午线两边，都有你的城市图钉。",
    tone: "ocean",
    priority: 93,
    evaluate: (context) =>
      conditionResult(
        context.longitudeMin < 0 && context.longitudeMax > 0,
        context.longitudeMin < 0 && context.longitudeMax > 0 ? 1 : 0.5,
        context.longitudeMin < 0 && context.longitudeMax > 0
          ? "已解锁 · 东西半球都有足迹"
          : "还差另一个半球",
      ),
  },
  {
    id: "near-equator",
    category: "geo",
    title: "赤道附近晃过",
    description: "至少一座城市距离赤道不到五个纬度。",
    tone: "ocean",
    priority: 86,
    evaluate: (context) => {
      const count = context.uniqueCities.filter(
        (visit) => Math.abs(visit.latitude) <= 5,
      ).length;
      return countResult(count, 1, "座赤道城市");
    },
  },
  {
    id: "arctic-latitude",
    category: "geo",
    title: "北纬六十度候场",
    description: "至少一枚图钉落在北纬六十度以北。",
    tone: "ocean",
    priority: 88,
    evaluate: (context) => {
      const count = context.uniqueCities.filter(
        (visit) => visit.latitude >= 60,
      ).length;
      return countResult(count, 1, "座高纬城市");
    },
  },
  {
    id: "three-continents-one-year",
    category: "geo",
    title: "同年跨三洲",
    description: "同一个自然年，在三块大陆留下足迹。",
    tone: "ocean",
    priority: 101,
    evaluate: (context) =>
      countResult(context.maxContinentsInYear, 3, "个同年大洲"),
  },
  {
    id: "island-neighbor",
    category: "geo",
    title: "海岛串门客",
    description: "三个岛国或岛屿目的地，海风也有不同版本。",
    tone: "ocean",
    priority: 89,
    evaluate: (context) =>
      countResult(countInSet(context.countries, ISLAND_COUNTRIES), 3, "个海岛国家"),
  },
  {
    id: "latitude-span",
    category: "geo",
    title: "经纬跨度王",
    description: "足迹跨过六十个纬度，地图已经很难一眼装下。",
    tone: "ocean",
    priority: 96,
    evaluate: (context) =>
      countResult(
        Math.round(context.latitudeMax - context.latitudeMin),
        60,
        "度纬度跨度",
      ),
  },
];

export function evaluateRoamingTitles(
  visits: CityVisit[],
  countryRegions: CountryRegionMap,
) {
  const context = buildContext(visits, countryRegions);
  return ROAMING_TITLES.map((definition): EvaluatedRoamingTitle => {
    const { evaluate, ...title } = definition;
    return {
      ...title,
      ...evaluate(context),
    };
  });
}

export function recommendedRoamingTitle(titles: EvaluatedRoamingTitle[]) {
  return [...titles]
    .filter((title) => title.unlocked)
    .sort(
      (left, right) =>
        right.priority - left.priority || left.title.localeCompare(right.title),
    )[0];
}
