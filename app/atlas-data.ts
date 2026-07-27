export type TravelType =
  | "路过"
  | "旅游"
  | "出差"
  | "短居 / 留学"
  | "常住"
  | "出生地";

export type AtlasGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export type LandmarkOption = {
  id: string;
  name: string;
  subtitle: string;
  longitude: number;
  latitude: number;
};

export type CityCandidate = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region?: string;
  subtitle: string;
  longitude: number;
  latitude: number;
  bbox?: [number, number, number, number];
  geometry?: AtlasGeometry;
};

export type CityVisit = CityCandidate & {
  visitId: string;
  visitedOn: string;
  travelType: TravelType;
  landmarks: LandmarkOption[];
};

export type ActiveCountry = {
  code: string;
  name: string;
};

export function chinaProvinceKey(
  visit: Pick<CityCandidate, "name" | "region">,
) {
  const municipalityByCity: Record<string, string> = {
    北京: "北京",
    北京市: "北京",
    上海: "上海",
    上海市: "上海",
    天津: "天津",
    天津市: "天津",
    重庆: "重庆",
    重庆市: "重庆",
    香港: "香港",
    澳门: "澳门",
  };
  const source =
    visit.region?.trim() ??
    municipalityByCity[visit.name.trim()] ??
    visit.name.trim();

  return source
    .replace(/壮族自治区$/u, "")
    .replace(/回族自治区$/u, "")
    .replace(/维吾尔自治区$/u, "")
    .replace(/特别行政区$/u, "")
    .replace(/自治区$/u, "")
    .replace(/[省市]$/u, "")
    .trim();
}

export const TRAVEL_TYPE_OPTIONS: Array<{
  value: TravelType;
  label: string;
  description: string;
  score: 1 | 2 | 3 | 4 | 5 | 6;
}> = [
  {
    value: "路过",
    label: "路过",
    description: "短暂停留",
    score: 1,
  },
  {
    value: "旅游",
    label: "旅游",
    description: "专程游览",
    score: 2,
  },
  {
    value: "出差",
    label: "出差",
    description: "工作到访",
    score: 3,
  },
  {
    value: "短居 / 留学",
    label: "短居 / 留学",
    description: "阶段生活",
    score: 4,
  },
  {
    value: "常住",
    label: "常住",
    description: "工作 / 生活",
    score: 5,
  },
  {
    value: "出生地",
    label: "出生地",
    description: "人生起点",
    score: 6,
  },
];

const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  CN: "中国",
  TW: "中国",
  TH: "泰国",
};

function comparablePlaceName(value: string) {
  return value
    .trim()
    .replace(/[·•・／/]/g, "")
    .replace(/國/g, "国")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizeCountryName(name: string, countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  if (COUNTRY_NAME_OVERRIDES[code]) return COUNTRY_NAME_OVERRIDES[code];

  const parts = name
    .split(/[·•・／/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const uniqueParts = parts.filter(
    (part, index) =>
      parts.findIndex(
        (candidate) =>
          comparablePlaceName(candidate) === comparablePlaceName(part),
      ) === index,
  );
  return uniqueParts.join(" · ") || name.trim() || code;
}

export function formatLocationSubtitle(
  region: string | undefined,
  country: string,
) {
  const cleanRegion = region?.trim();
  if (!cleanRegion) return country;
  if (comparablePlaceName(cleanRegion) === comparablePlaceName(country)) {
    return country;
  }
  return `${cleanRegion} · ${country}`;
}

export function travelTypeScore(travelType: TravelType) {
  return (
    TRAVEL_TYPE_OPTIONS.find((option) => option.value === travelType)?.score ?? 1
  );
}

export const FEATURED_CITIES: CityCandidate[] = [
  {
    id: "city-shanghai",
    name: "上海",
    country: "中国",
    countryCode: "CN",
    region: "上海市",
    subtitle: "上海市 · 中国",
    longitude: 121.4737,
    latitude: 31.2304,
    bbox: [120.85, 30.67, 122.2, 31.88],
  },
  {
    id: "city-beijing",
    name: "北京",
    country: "中国",
    countryCode: "CN",
    region: "北京市",
    subtitle: "北京市 · 中国",
    longitude: 116.4074,
    latitude: 39.9042,
    bbox: [115.42, 39.44, 117.5, 41.06],
  },
  {
    id: "city-tokyo",
    name: "东京",
    country: "日本",
    countryCode: "JP",
    region: "东京都",
    subtitle: "东京都 · 日本",
    longitude: 139.6917,
    latitude: 35.6895,
    bbox: [138.94, 35.5, 140.05, 35.9],
  },
  {
    id: "city-paris",
    name: "巴黎",
    country: "法国",
    countryCode: "FR",
    region: "法兰西岛",
    subtitle: "法兰西岛 · 法国",
    longitude: 2.3522,
    latitude: 48.8566,
    bbox: [2.224, 48.815, 2.47, 48.902],
  },
  {
    id: "city-barcelona",
    name: "巴塞罗那",
    country: "西班牙",
    countryCode: "ES",
    region: "加泰罗尼亚",
    subtitle: "加泰罗尼亚 · 西班牙",
    longitude: 2.1734,
    latitude: 41.3851,
    bbox: [2.052, 41.317, 2.229, 41.469],
  },
  {
    id: "city-stockholm",
    name: "斯德哥尔摩",
    country: "瑞典",
    countryCode: "SE",
    region: "斯德哥尔摩省",
    subtitle: "斯德哥尔摩省 · 瑞典",
    longitude: 18.0686,
    latitude: 59.3293,
    bbox: [17.8, 59.17, 18.2, 59.46],
  },
  {
    id: "city-new-york",
    name: "纽约",
    country: "美国",
    countryCode: "US",
    region: "纽约州",
    subtitle: "纽约州 · 美国",
    longitude: -74.006,
    latitude: 40.7128,
    bbox: [-74.26, 40.49, -73.7, 40.92],
  },
  {
    id: "city-singapore",
    name: "新加坡",
    country: "新加坡",
    countryCode: "SG",
    subtitle: "新加坡",
    longitude: 103.8198,
    latitude: 1.3521,
    bbox: [103.6, 1.16, 104.05, 1.47],
  },
  {
    id: "city-bangkok",
    name: "曼谷",
    country: "泰国",
    countryCode: "TH",
    region: "曼谷",
    subtitle: "曼谷 · 泰国",
    longitude: 100.5018,
    latitude: 13.7563,
    bbox: [100.327, 13.494, 100.938, 13.955],
  },
];

export const LANDMARKS_BY_CITY: Record<string, LandmarkOption[]> = {
  "CN:上海": [
    {
      id: "landmark-bund",
      name: "外滩",
      subtitle: "黄浦江畔",
      longitude: 121.4904,
      latitude: 31.2401,
    },
    {
      id: "landmark-oriental-pearl",
      name: "东方明珠",
      subtitle: "陆家嘴",
      longitude: 121.4997,
      latitude: 31.2397,
    },
    {
      id: "landmark-wukang",
      name: "武康大楼",
      subtitle: "徐汇区",
      longitude: 121.438,
      latitude: 31.205,
    },
    {
      id: "landmark-shanghai-museum",
      name: "上海博物馆",
      subtitle: "人民广场",
      longitude: 121.4754,
      latitude: 31.2283,
    },
  ],
  "CN:北京": [
    {
      id: "landmark-forbidden-city",
      name: "故宫博物院",
      subtitle: "东城区",
      longitude: 116.397,
      latitude: 39.9163,
    },
    {
      id: "landmark-temple-heaven",
      name: "天坛",
      subtitle: "东城区",
      longitude: 116.4074,
      latitude: 39.8822,
    },
    {
      id: "landmark-summer-palace",
      name: "颐和园",
      subtitle: "海淀区",
      longitude: 116.272,
      latitude: 39.9999,
    },
  ],
  "JP:东京": [
    {
      id: "landmark-shibuya",
      name: "涩谷十字路口",
      subtitle: "涩谷区",
      longitude: 139.7006,
      latitude: 35.6595,
    },
    {
      id: "landmark-sensoji",
      name: "浅草寺",
      subtitle: "台东区",
      longitude: 139.7967,
      latitude: 35.7148,
    },
    {
      id: "landmark-tokyo-tower",
      name: "东京塔",
      subtitle: "港区",
      longitude: 139.7454,
      latitude: 35.6586,
    },
  ],
  "FR:巴黎": [
    {
      id: "landmark-eiffel",
      name: "埃菲尔铁塔",
      subtitle: "第七区",
      longitude: 2.2945,
      latitude: 48.8584,
    },
    {
      id: "landmark-louvre",
      name: "卢浮宫",
      subtitle: "第一区",
      longitude: 2.3364,
      latitude: 48.8606,
    },
    {
      id: "landmark-notre-dame",
      name: "巴黎圣母院",
      subtitle: "西岱岛",
      longitude: 2.3499,
      latitude: 48.853,
    },
  ],
  "ES:巴塞罗那": [
    {
      id: "landmark-sagrada",
      name: "圣家堂",
      subtitle: "扩展区",
      longitude: 2.1744,
      latitude: 41.4036,
    },
    {
      id: "landmark-park-guell",
      name: "桂尔公园",
      subtitle: "格拉西亚",
      longitude: 2.1527,
      latitude: 41.4145,
    },
    {
      id: "landmark-casa-batllo",
      name: "巴特罗之家",
      subtitle: "格拉西亚大道",
      longitude: 2.1649,
      latitude: 41.3917,
    },
  ],
  "SE:斯德哥尔摩": [
    {
      id: "landmark-vasa",
      name: "瓦萨沉船博物馆",
      subtitle: "动物园岛",
      longitude: 18.0914,
      latitude: 59.328,
    },
    {
      id: "landmark-stockholm-city-hall",
      name: "斯德哥尔摩市政厅",
      subtitle: "国王岛",
      longitude: 18.0686,
      latitude: 59.3275,
    },
    {
      id: "landmark-gamla-stan",
      name: "斯德哥尔摩老城",
      subtitle: "老城岛",
      longitude: 18.0706,
      latitude: 59.325,
    },
    {
      id: "landmark-nobel-prize-museum",
      name: "诺贝尔奖博物馆",
      subtitle: "大广场",
      longitude: 18.0708,
      latitude: 59.3252,
    },
    {
      id: "landmark-fotografiska",
      name: "摄影博物馆",
      subtitle: "南城",
      longitude: 18.0847,
      latitude: 59.318,
    },
    {
      id: "landmark-moderna-museet",
      name: "现代艺术博物馆",
      subtitle: "船岛",
      longitude: 18.084,
      latitude: 59.3263,
    },
  ],
  "US:纽约": [
    {
      id: "landmark-liberty",
      name: "自由女神像",
      subtitle: "自由岛",
      longitude: -74.0445,
      latitude: 40.6892,
    },
    {
      id: "landmark-central-park",
      name: "中央公园",
      subtitle: "曼哈顿",
      longitude: -73.9654,
      latitude: 40.7829,
    },
    {
      id: "landmark-met",
      name: "大都会艺术博物馆",
      subtitle: "第五大道",
      longitude: -73.9632,
      latitude: 40.7794,
    },
  ],
  "SG:新加坡": [
    {
      id: "landmark-marina-bay",
      name: "滨海湾",
      subtitle: "市中心",
      longitude: 103.859,
      latitude: 1.2834,
    },
    {
      id: "landmark-gardens-bay",
      name: "滨海湾花园",
      subtitle: "滨海湾",
      longitude: 103.8636,
      latitude: 1.2816,
    },
  ],
  "TH:曼谷": [
    {
      id: "landmark-grand-palace",
      name: "大皇宫",
      subtitle: "拍那空区",
      longitude: 100.4913,
      latitude: 13.7500,
    },
    {
      id: "landmark-wat-arun",
      name: "郑王庙",
      subtitle: "昭披耶河畔",
      longitude: 100.4889,
      latitude: 13.7437,
    },
    {
      id: "landmark-wat-pho",
      name: "卧佛寺",
      subtitle: "拍那空区",
      longitude: 100.4925,
      latitude: 13.7465,
    },
    {
      id: "landmark-chatuchak",
      name: "乍都乍周末市场",
      subtitle: "乍都乍区",
      longitude: 100.5501,
      latitude: 13.7999,
    },
  ],
};
