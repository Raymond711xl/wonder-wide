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
    label: "版图进度",
    description: "从第一块省级区域，到把整张中国地图慢慢晃熟。",
  },
  {
    id: "china-region",
    label: "区域连线",
    description: "东北、江浙沪、大湾区和西北环线，都能连成自己的路线。",
  },
  {
    id: "china-city",
    label: "城市热梗",
    description: "每座城都有一句旅行者之间一说就懂的暗号。",
  },
  {
    id: "china-landmark",
    label: "景点收藏",
    description: "古建、石窟、名山与经典机位，认真到过才会点亮。",
  },
  {
    id: "china-style",
    label: "旅行玩法",
    description: "特种兵、周末闪现、故地重游和在地生活，各有各的晃法。",
  },
  {
    id: "geo",
    label: "地理彩蛋",
    description: "半球、赤道、极圈和跨度，藏在坐标里的惊喜。",
  },
] as const;

export type RoamingTitleCategoryId =
  (typeof ROAMING_TITLE_CATEGORIES)[number]["id"];

export const CHINA_ROAMING_TITLE_CATEGORY_IDS = [
  "china",
  "china-region",
  "china-city",
  "china-landmark",
  "china-style",
] as const satisfies readonly RoamingTitleCategoryId[];

export function isChinaRoamingTitleCategory(
  category: RoamingTitleCategoryId,
) {
  return (CHINA_ROAMING_TITLE_CATEGORY_IDS as readonly string[]).includes(
    category,
  );
}

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
  cnVisits: CityVisit[];
  cnUniqueCities: CityVisit[];
  cnLandmarks: Array<{
    key: string;
    name: string;
    subtitle: string;
  }>;
  cnProvinces: Set<string>;
  maxChinaCitiesInDay: number;
  maxChinaCitiesInProvince: number;
  maxChinaLandmarksInCity: number;
  maxSameChinaCityVisits: number;
  chinaWeekendVisits: number;
  chinaDeepVisits: number;
  chinaSeasons: Set<string>;
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
const CN_NORTHEAST = new Set(["辽宁", "吉林", "黑龙江"]);
const CN_BEIJING_TIANJIN_HEBEI = new Set(["北京", "天津", "河北"]);
const CN_JIANGZHEHU = new Set(["上海", "江苏", "浙江"]);
const CN_GREATER_BAY = new Set(["广东", "香港", "澳门"]);
const CN_CENTRAL = new Set(["河南", "湖北", "湖南"]);
const CN_SOUTHWEST = new Set(["重庆", "四川", "贵州", "云南", "西藏"]);
const CN_NORTHWEST = new Set(["陕西", "甘肃", "青海", "宁夏", "新疆"]);
const CN_ISLANDS = new Set(["海南", "台湾"]);
const CN_YELLOW_RIVER = new Set([
  "青海",
  "甘肃",
  "宁夏",
  "内蒙古",
  "陕西",
  "山西",
  "河南",
  "山东",
]);
const CN_YANGTZE = new Set([
  "青海",
  "西藏",
  "四川",
  "云南",
  "重庆",
  "湖北",
  "湖南",
  "江西",
  "安徽",
  "江苏",
  "上海",
]);

const CHINA_CITY_ACHIEVEMENTS = [
  {
    id: "beijing-leg-day",
    title: "京城腿脚认证",
    description: "北京的景点距离，专治“看起来就在旁边”。",
    tone: "orange",
    priority: 126,
    markers: ["北京", "beijing"],
  },
  {
    id: "shanghai-citywalk",
    title: "魔都压马路",
    description: "梧桐区、弄堂和江边，走路才是上海的正确转场。",
    tone: "pink",
    priority: 126,
    markers: ["上海", "shanghai"],
  },
  {
    id: "guangzhou-morning-tea",
    title: "早茶不散场",
    description: "广州的一天，可以从一壶茶和三轮点心开始。",
    tone: "orange",
    priority: 128,
    markers: ["广州", "guangzhou", "canton"],
  },
  {
    id: "shenzhen-park-roamer",
    title: "公园城市漫游者",
    description: "在深圳，把海边、绿道和公园串成一条路线。",
    tone: "lime",
    priority: 124,
    markers: ["深圳", "shenzhen"],
  },
  {
    id: "chongqing-8d",
    title: "8D 导航失灵",
    description: "重庆的上楼、下楼和过马路，方向感只负责参与。",
    tone: "purple",
    priority: 132,
    markers: ["重庆", "chongqing"],
  },
  {
    id: "chengdu-bashi",
    title: "巴适得板",
    description: "在成都，赶路不重要，坐下来才算抵达。",
    tone: "lime",
    priority: 129,
    markers: ["成都", "chengdu"],
  },
  {
    id: "xian-night-roamer",
    title: "长安夜行人",
    description: "西安的城墙、灯火和夜风，把时间拉回长安。",
    tone: "purple",
    priority: 131,
    markers: ["西安", "xi'an", "xian"],
  },
  {
    id: "harbin-ice-guest",
    title: "尔滨冰雪来客",
    description: "冷是真的冷，热情也是真的能把冬天捂热。",
    tone: "ocean",
    priority: 133,
    markers: ["哈尔滨", "harbin"],
  },
  {
    id: "zibo-bbq",
    title: "小炉纯青",
    description: "小饼、小葱和小炉子，淄博这一桌已经开席。",
    tone: "orange",
    priority: 134,
    markers: ["淄博", "zibo"],
  },
  {
    id: "tianshui-malatang",
    title: "麻辣烫追风人",
    description: "为了这一碗热辣鲜香，专门晃到天水。",
    tone: "pink",
    priority: 134,
    markers: ["天水", "tianshui"],
  },
  {
    id: "changsha-night-battery",
    title: "夜长沙续航王",
    description: "白天逛，晚上吃，凌晨的长沙仍然不肯收工。",
    tone: "pink",
    priority: 130,
    markers: ["长沙", "changsha"],
  },
  {
    id: "wuhan-breakfast",
    title: "江城过早选手",
    description: "武汉的早餐不是一顿饭，是一整套城市副本。",
    tone: "orange",
    priority: 129,
    markers: ["武汉", "wuhan"],
  },
  {
    id: "hangzhou-lakeside",
    title: "西湖边走边看",
    description: "杭州的风景不催人，绕着湖慢慢走就好。",
    tone: "ocean",
    priority: 126,
    markers: ["杭州", "hangzhou"],
  },
  {
    id: "suzhou-garden-cut",
    title: "园林转场师",
    description: "苏州的门窗、借景和回廊，每一步都在换画面。",
    tone: "lime",
    priority: 127,
    markers: ["苏州", "suzhou"],
  },
  {
    id: "nanjing-wall-walker",
    title: "金陵城墙漫步者",
    description: "在南京，梧桐、城墙和旧地名会自动接成故事。",
    tone: "purple",
    priority: 127,
    markers: ["南京", "nanjing"],
  },
  {
    id: "quanzhou-gods-neighbor",
    title: "泉州众神串门客",
    description: "一条街走过几种信仰，烟火和古迹互不打扰。",
    tone: "orange",
    priority: 132,
    markers: ["泉州", "quanzhou"],
  },
  {
    id: "jingdezhen-clay-player",
    title: "捏泥巴也要出片",
    description: "在景德镇，瓷片、窑口和工作室都值得慢慢淘。",
    tone: "ocean",
    priority: 131,
    markers: ["景德镇", "jingdezhen"],
  },
  {
    id: "luoyang-flower-season",
    title: "神都花期赶场人",
    description: "洛阳的古都气场和牡丹花期，一次都不想错过。",
    tone: "pink",
    priority: 128,
    markers: ["洛阳", "luoyang"],
  },
  {
    id: "kaifeng-bianjing",
    title: "一脚踏进汴京",
    description: "开封的夜市和旧城，把北宋日常重新点亮。",
    tone: "purple",
    priority: 128,
    markers: ["开封", "kaifeng"],
  },
  {
    id: "datong-wooden-heritage",
    title: "地上文物巡查员",
    description: "到了大同，抬头看屋檐比低头看导航更重要。",
    tone: "lime",
    priority: 134,
    markers: ["大同", "datong"],
  },
  {
    id: "guilin-banknote-frame",
    title: "二十元取景框",
    description: "桂林山水一入镜，人民币背景就有了现场版。",
    tone: "ocean",
    priority: 133,
    markers: ["桂林", "阳朔", "guilin", "yangshuo"],
  },
  {
    id: "dali-slow-button",
    title: "苍山洱海慢放键",
    description: "大理适合把日程调松，把风景留得久一点。",
    tone: "ocean",
    priority: 127,
    markers: ["大理", "dali"],
  },
  {
    id: "lijiang-lost-route",
    title: "古城迷路也算路线",
    description: "在丽江拐错一个巷口，往往正好遇见下一段风景。",
    tone: "pink",
    priority: 126,
    markers: ["丽江", "lijiang"],
  },
  {
    id: "kunming-spring-mode",
    title: "春城常温体质",
    description: "昆明把四季揉成一档，鲜花和阳光长期在线。",
    tone: "lime",
    priority: 124,
    markers: ["昆明", "kunming"],
  },
  {
    id: "xishuangbanna-tropical",
    title: "北回归线热带客",
    description: "雨林、夜市和热带风，把西双版纳晃成另一种纬度。",
    tone: "orange",
    priority: 129,
    markers: ["西双版纳", "景洪", "xishuangbanna", "jinghong"],
  },
  {
    id: "qingdao-sea-breeze",
    title: "海风装袋带走",
    description: "青岛的坡路、红瓦和海风，适合边走边打包记忆。",
    tone: "ocean",
    priority: 126,
    markers: ["青岛", "qingdao"],
  },
  {
    id: "dalian-tram-sea",
    title: "电车追海人",
    description: "在大连，老电车和海岸线可以坐进同一段旅程。",
    tone: "ocean",
    priority: 126,
    markers: ["大连", "dalian"],
  },
  {
    id: "jinan-spring-listener",
    title: "泉水叮咚全勤",
    description: "济南的泉不是背景，是整座城持续播放的声音。",
    tone: "lime",
    priority: 125,
    markers: ["济南", "jinan"],
  },
  {
    id: "guiyang-mountain-turn",
    title: "山路转场王",
    description: "贵阳的路线没有平铺直叙，拐弯和爬坡都算剧情。",
    tone: "orange",
    priority: 126,
    markers: ["贵阳", "guiyang"],
  },
  {
    id: "lhasa-slow-breath",
    title: "高原慢呼吸",
    description: "在拉萨，走慢一点，天空和城市都会更近一点。",
    tone: "purple",
    priority: 132,
    markers: ["拉萨", "lhasa"],
  },
  {
    id: "kashgar-corner",
    title: "喀什老城转角王",
    description: "门窗、院落和巷口，让喀什的每个转弯都有新画面。",
    tone: "orange",
    priority: 131,
    markers: ["喀什", "kashgar", "kashi"],
  },
  {
    id: "dunhuang-light-chaser",
    title: "大漠壁画追光人",
    description: "敦煌的风沙、洞窟和夕阳，把颜色留了上千年。",
    tone: "purple",
    priority: 134,
    markers: ["敦煌", "dunhuang"],
  },
  {
    id: "hongkong-dingding",
    title: "叮叮慢晃客",
    description: "在香港坐一段电车，让密集城市慢下来。",
    tone: "pink",
    priority: 128,
    markers: ["香港", "hong kong", "hongkong"],
  },
  {
    id: "macau-alley-dessert",
    title: "澳门巷口甜品线",
    description: "大路看建筑，小巷找甜品，澳门适合两条线一起走。",
    tone: "orange",
    priority: 127,
    markers: ["澳门", "macau", "macao"],
  },
  {
    id: "sanya-sun-baked",
    title: "海岛晒熟了",
    description: "三亚的海风和太阳，负责把假期烤到全熟。",
    tone: "lime",
    priority: 126,
    markers: ["三亚", "sanya"],
  },
  {
    id: "zhangjiajie-stone-maze",
    title: "石柱迷宫解锁人",
    description: "张家界的峰林一根接一根，方向感再次只负责参与。",
    tone: "purple",
    priority: 132,
    markers: ["张家界", "zhangjiajie"],
  },
  {
    id: "chaoshan-stomach-test",
    title: "潮汕胃容量测试员",
    description: "牛肉、粿品、砂锅粥，潮汕路线按餐次而不是公里计算。",
    tone: "orange",
    priority: 133,
    markers: ["潮州", "汕头", "揭阳", "chaozhou", "shantou", "jieyang"],
  },
  {
    id: "yanji-carb-roamer",
    title: "延边碳水漫游者",
    description: "延吉的一天，从米酒、冷面和烤肉之间继续加餐。",
    tone: "pink",
    priority: 129,
    markers: ["延吉", "yanji"],
  },
  {
    id: "fuzhou-alley-regular",
    title: "榕城巷弄熟客",
    description: "福州的老巷、骑楼和汤水，把节奏放得刚刚好。",
    tone: "lime",
    priority: 125,
    markers: ["福州", "fuzhou"],
  },
  {
    id: "xiamen-island-breeze",
    title: "鹭岛海风收件人",
    description: "厦门把海、坡路和岛屿装进了一张慢行地图。",
    tone: "ocean",
    priority: 126,
    markers: ["厦门", "xiamen", "amoy"],
  },
] as const;

const CHINA_LANDMARK_ACHIEVEMENTS = [
  {
    id: "great-wall-leg-power",
    title: "长城腿力认证",
    description: "好汉证书不发纸质版，台阶会替你盖章。",
    tone: "orange",
    priority: 151,
    markers: ["长城", "八达岭", "慕田峪", "greatwall", "badaling", "mutianyu"],
  },
  {
    id: "forbidden-city-steps",
    title: "宫门走断腿",
    description: "故宫的门一重又一重，今天的步数很有历史感。",
    tone: "pink",
    priority: 152,
    markers: ["故宫", "紫禁城", "forbiddencity", "palacemuseum"],
  },
  {
    id: "temple-of-heaven-echo",
    title: "天坛回音测试员",
    description: "古人的声学彩蛋，也被你现场验收了一遍。",
    tone: "ocean",
    priority: 147,
    markers: ["天坛", "templeofheaven"],
  },
  {
    id: "bund-light-watcher",
    title: "外滩灯光观察员",
    description: "浦江两岸同时亮起，上海的夜才算正式开场。",
    tone: "purple",
    priority: 148,
    markers: ["外滩", "thebund", "bund"],
  },
  {
    id: "west-lake-loop",
    title: "西湖绕圈人",
    description: "桥、堤、塔和水面，绕一圈仍然看不完。",
    tone: "ocean",
    priority: 148,
    markers: ["西湖", "westlake"],
  },
  {
    id: "terracotta-roll-call",
    title: "兵马俑点兵人",
    description: "千人千面，今天由你负责现场点名。",
    tone: "orange",
    priority: 153,
    markers: ["兵马俑", "秦始皇陵", "terracotta", "qinshihuang"],
  },
  {
    id: "giant-wild-goose-night",
    title: "雁塔夜班游客",
    description: "大雁塔一亮灯，长安的夜游副本正式开启。",
    tone: "purple",
    priority: 146,
    markers: ["大雁塔", "giantwildgoosepagoda", "dayanta"],
  },
  {
    id: "panda-base-shift",
    title: "熊猫早班观察员",
    description: "为了赶上滚滚营业时间，旅行者也能主动早起。",
    tone: "lime",
    priority: 154,
    markers: ["熊猫基地", "大熊猫繁育研究基地", "pandabase", "panda"],
  },
  {
    id: "hongya-cave-levels",
    title: "洪崖洞楼层侦探",
    description: "你以为在一楼，转个弯可能已经到了十一楼。",
    tone: "pink",
    priority: 151,
    markers: ["洪崖洞", "hongyadong", "hongyacave"],
  },
  {
    id: "yellow-crane-elevator",
    title: "黄鹤楼登高员",
    description: "登楼望江，武汉三镇在视野里重新排版。",
    tone: "orange",
    priority: 147,
    markers: ["黄鹤楼", "yellowcranetower"],
  },
  {
    id: "huangshan-cloud-walker",
    title: "黄山云端候场",
    description: "奇松、怪石和云海，天气负责随机开盲盒。",
    tone: "ocean",
    priority: 153,
    markers: ["黄山", "huangshan", "yellowmountain"],
  },
  {
    id: "mount-tai-climber",
    title: "泰山日出候场人",
    description: "夜爬的风和山顶的光，都算这次登高的勋章。",
    tone: "orange",
    priority: 152,
    markers: ["泰山", "mounttai", "taishan"],
  },
  {
    id: "jiuzhaigou-color-card",
    title: "九寨沟色卡采集员",
    description: "一池一种蓝，手机相册开始自动分层。",
    tone: "ocean",
    priority: 154,
    markers: ["九寨沟", "jiuzhaigou"],
  },
  {
    id: "potala-slow-climb",
    title: "布宫慢爬模式",
    description: "台阶很多，海拔很高，抵达必须按自己的呼吸来。",
    tone: "purple",
    priority: 155,
    markers: ["布达拉宫", "potala"],
  },
  {
    id: "mogao-color-reader",
    title: "莫高窟读色人",
    description: "洞窟里的颜色跨过千年，依旧比屏幕更有力量。",
    tone: "purple",
    priority: 157,
    markers: ["莫高窟", "mogaocaves", "mogao"],
  },
  {
    id: "yungang-stone-reader",
    title: "云冈石头读者",
    description: "石窟不说话，但每一张面孔都在讲时间。",
    tone: "purple",
    priority: 156,
    markers: ["云冈石窟", "yunganggrottoes", "yungang"],
  },
  {
    id: "xiaoxitian-ceiling",
    title: "小西天抬头党",
    description: "满堂悬塑把天花板塞满，脖子酸也舍不得低头。",
    tone: "pink",
    priority: 158,
    markers: ["小西天", "xiaoxitian"],
  },
  {
    id: "longmen-grottoes",
    title: "龙门石窟对望者",
    description: "隔着千年与石刻对望，表情细节仍然清晰。",
    tone: "purple",
    priority: 156,
    markers: ["龙门石窟", "longmengrottoes", "longmen"],
  },
  {
    id: "leshan-perspective",
    title: "乐山大佛比例尺",
    description: "站在大佛脚边，人会自动缩成一个标点。",
    tone: "orange",
    priority: 151,
    markers: ["乐山大佛", "lesh giantbuddha", "leshandafo", "leshan"],
  },
  {
    id: "sanxingdui-eye-contact",
    title: "三星堆对眼成功",
    description: "青铜面具一抬眼，古蜀审美直接穿越到现场。",
    tone: "lime",
    priority: 155,
    markers: ["三星堆", "sanxingdui"],
  },
  {
    id: "gulangyu-soundtrack",
    title: "鼓浪屿步行声轨",
    description: "没有汽车打断，脚步和海风负责整座岛的配乐。",
    tone: "ocean",
    priority: 148,
    markers: ["鼓浪屿", "gulangyu"],
  },
  {
    id: "pingyao-night-watch",
    title: "平遥古城夜巡",
    description: "城墙围住旧街，夜色把明清日常重新开机。",
    tone: "orange",
    priority: 149,
    markers: ["平遥古城", "pingyao"],
  },
  {
    id: "wutai-temple-route",
    title: "五台山寺院连线",
    description: "一座山装下许多寺院，走的是山路也是时间线。",
    tone: "lime",
    priority: 150,
    markers: ["五台山", "mountwutai", "wutaishan"],
  },
  {
    id: "zhangjiajie-elevator",
    title: "峰林垂直通勤",
    description: "张家界把路修进云里，电梯也能直达山水。",
    tone: "purple",
    priority: 151,
    markers: ["张家界国家森林公园", "天门山", "百龙天梯", "zhangjiajie"],
  },
  {
    id: "guilin-river-frame",
    title: "漓江山水取景员",
    description: "船往前走，山水长卷就一页页自动翻开。",
    tone: "ocean",
    priority: 150,
    markers: ["漓江", "遇龙河", "lijiangriver", "liriver", "yulongriver"],
  },
] as const;

function cityKey(visit: Pick<CityVisit, "countryCode" | "name">) {
  return `${visit.countryCode}:${visit.name.trim().toLowerCase()}`;
}

function landmarkKey(
  visit: Pick<CityVisit, "countryCode" | "name">,
  landmarkId: string,
) {
  return `${cityKey(visit)}:${landmarkId}`;
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

function matchingChinaCityCount(
  context: RoamingTitleContext,
  markers: readonly string[],
) {
  const normalizedMarkers = markers.map(normalizePlaceText);
  return context.cnUniqueCities.filter((visit) => {
    const haystack = normalizePlaceText(
      [visit.name, visit.region, visit.subtitle].filter(Boolean).join(" "),
    );
    return normalizedMarkers.some((marker) => haystack.includes(marker));
  }).length;
}

function matchingChinaLandmarkCount(
  context: RoamingTitleContext,
  markers: readonly string[],
) {
  const normalizedMarkers = markers.map(normalizePlaceText);
  return context.cnLandmarks.filter((landmark) => {
    const haystack = normalizePlaceText(
      [landmark.name, landmark.subtitle].filter(Boolean).join(" "),
    );
    return normalizedMarkers.some((marker) => haystack.includes(marker));
  }).length;
}

function validVisitDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { date, day, month, year };
}

const CHINA_CITY_TITLE_DEFINITIONS: RoamingTitleDefinition[] =
  CHINA_CITY_ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    category: "china-city",
    evaluate: (context) =>
      countResult(
        matchingChinaCityCount(context, achievement.markers),
        1,
        "座对应城市",
      ),
  }));

const CHINA_LANDMARK_TITLE_DEFINITIONS: RoamingTitleDefinition[] =
  CHINA_LANDMARK_ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    category: "china-landmark",
    evaluate: (context) =>
      countResult(
        matchingChinaLandmarkCount(context, achievement.markers),
        1,
        "处对应景点",
      ),
  }));

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
  const cnVisits = visits.filter((visit) => visit.countryCode === "CN");
  const cnCityVisits = new Map<string, CityVisit[]>();
  cnVisits.forEach((visit) => {
    const key = cityKey(visit);
    cnCityVisits.set(key, [...(cnCityVisits.get(key) ?? []), visit]);
  });
  const cnUniqueCities = [...cnCityVisits.values()].map((items) => items[0]);
  const cnLandmarks = [
    ...new Map(
      cnVisits.flatMap((visit) =>
        visit.landmarks.map(
          (landmark) =>
            [
              landmarkKey(visit, landmark.id),
              {
                key: landmarkKey(visit, landmark.id),
                name: landmark.name,
                subtitle: landmark.subtitle,
              },
            ] as const,
        ),
      ),
    ).values(),
  ];

  const countriesByContinent = new Map<string, Set<string>>();
  const countriesBySubregion = new Map<string, Set<string>>();
  countries.forEach((code) => {
    const region = countryRegions[code];
    if (!region) return;
    addToSetMap(countriesByContinent, region.continent, code);
    addToSetMap(countriesBySubregion, region.subregion, code);
  });

  const cnProvinces = new Set(
    cnVisits.map(chinaProvinceKey).filter(Boolean),
  );
  const chinaCitiesByProvince = new Map<string, Set<string>>();
  cnUniqueCities.forEach((visit) => {
    const province = chinaProvinceKey(visit);
    if (province) addToSetMap(chinaCitiesByProvince, province, cityKey(visit));
  });
  const maxChinaCitiesInProvince = Math.max(
    0,
    ...[...chinaCitiesByProvince.values()].map((cities) => cities.size),
  );
  const maxChinaLandmarksInCity = Math.max(
    0,
    ...[...cnCityVisits.values()].map(
      (items) =>
        new Set(
          items.flatMap((visit) =>
            visit.landmarks.map((landmark) => landmarkKey(visit, landmark.id)),
          ),
        ).size,
    ),
  );
  const maxSameChinaCityVisits = Math.max(
    0,
    ...[...cnCityVisits.values()].map((items) => items.length),
  );
  const chinaCitiesByDay = new Map<string, Set<string>>();
  cnVisits.forEach((visit) => {
    if (!validVisitDate(visit.visitedOn)) return;
    addToSetMap(chinaCitiesByDay, visit.visitedOn, cityKey(visit));
  });
  const maxChinaCitiesInDay = Math.max(
    0,
    ...[...chinaCitiesByDay.values()].map((cities) => cities.size),
  );
  const years = [
    ...new Set(
      visits
        .map((visit) => validVisitDate(visit.visitedOn)?.year)
        .filter((year): year is number => typeof year === "number"),
    ),
  ].sort((left, right) => left - right);
  let maxConsecutiveYears = years.length ? 1 : 0;
  let consecutive = years.length ? 1 : 0;
  for (let index = 1; index < years.length; index += 1) {
    consecutive = years[index] === years[index - 1] + 1 ? consecutive + 1 : 1;
    maxConsecutiveYears = Math.max(maxConsecutiveYears, consecutive);
  }

  const seasons = new Set<string>();
  const chinaSeasons = new Set<string>();
  visits.forEach((visit) => {
    const parsed = validVisitDate(visit.visitedOn);
    if (!parsed) return;
    const season =
      parsed.month >= 3 && parsed.month <= 5
        ? "spring"
        : parsed.month >= 6 && parsed.month <= 8
          ? "summer"
          : parsed.month >= 9 && parsed.month <= 11
            ? "autumn"
            : "winter";
    seasons.add(season);
    if (visit.countryCode === "CN") chinaSeasons.add(season);
  });

  const yearContinents = new Map<string, Set<string>>();
  visits.forEach((visit) => {
    const year = validVisitDate(visit.visitedOn)?.year;
    const continent = countryRegions[visit.countryCode]?.continent;
    if (typeof year !== "number" || !continent) return;
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
      .map((visit) => validVisitDate(visit.visitedOn)?.year)
      .filter((year): year is number => typeof year === "number");
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
    const parsed = validVisitDate(visit.visitedOn);
    const day = parsed?.date.getUTCDay();
    return day === 0 || day === 6;
  }).length;
  const chinaWeekendVisits = cnVisits.filter((visit) => {
    const parsed = validVisitDate(visit.visitedOn);
    const day = parsed?.date.getUTCDay();
    return day === 0 || day === 6;
  }).length;
  const chinaDeepVisits = cnVisits.filter(
    (visit) =>
      visit.travelType === "短居 / 留学" ||
      visit.travelType === "常住" ||
      visit.travelType === "出生地",
  ).length;

  const latitudes = uniqueCities.map((visit) => visit.latitude);
  const longitudes = uniqueCities.map((visit) => visit.longitude);

  return {
    visits,
    countries,
    uniqueCities,
    cityVisits,
    countriesByContinent,
    countriesBySubregion,
    cnVisits,
    cnUniqueCities,
    cnLandmarks,
    cnProvinces,
    maxChinaCitiesInDay,
    maxChinaCitiesInProvince,
    maxChinaLandmarksInCity,
    maxSameChinaCityVisits,
    chinaWeekendVisits,
    chinaDeepVisits,
    chinaSeasons,
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
    id: "twenty-five-province-roamer",
    category: "china",
    title: "神州七分熟",
    description: "二十五个省级区域，中国地图已经大面积亮起来。",
    tone: "orange",
    priority: 102,
    evaluate: (context) => countResult(context.cnProvinces.size, 25, "个省级区域"),
  },
  {
    id: "all-china-provinces",
    category: "china",
    title: "神州全图鉴",
    description: "三十四个省级区域全部点亮，这张地图真的被你晃完整了。",
    tone: "purple",
    priority: 180,
    evaluate: (context) => countResult(context.cnProvinces.size, 34, "个省级区域"),
  },
  {
    id: "china-three-cities",
    category: "china",
    title: "三城开场",
    description: "三座中国城市，已经足够拼出第一条国内路线。",
    tone: "lime",
    priority: 72,
    evaluate: (context) => countResult(context.cnUniqueCities.length, 3, "座城市"),
  },
  {
    id: "china-ten-cities",
    category: "china",
    title: "十城熟客",
    description: "十座城市以后，国内旅行开始有自己的偏爱。",
    tone: "pink",
    priority: 88,
    evaluate: (context) => countResult(context.cnUniqueCities.length, 10, "座城市"),
  },
  {
    id: "china-twenty-cities",
    category: "china",
    title: "二十城巡游者",
    description: "二十座城市，南腔北调都进入了你的旅行词典。",
    tone: "purple",
    priority: 106,
    evaluate: (context) => countResult(context.cnUniqueCities.length, 20, "座城市"),
  },
  {
    id: "china-fifty-cities",
    category: "china",
    title: "中国城市观察员",
    description: "五十座城市，热门与冷门都被你认真看过。",
    tone: "ocean",
    priority: 145,
    evaluate: (context) => countResult(context.cnUniqueCities.length, 50, "座城市"),
  },
  {
    id: "china-ten-landmarks",
    category: "china",
    title: "十景入册",
    description: "十处景点被认真收下，地图开始长出细节。",
    tone: "orange",
    priority: 91,
    evaluate: (context) => countResult(context.cnLandmarks.length, 10, "处景点"),
  },
  {
    id: "china-thirty-landmarks",
    category: "china",
    title: "景点图鉴扩容",
    description: "三十处景点，城市之外的故事也越来越完整。",
    tone: "pink",
    priority: 112,
    evaluate: (context) => countResult(context.cnLandmarks.length, 30, "处景点"),
  },
  {
    id: "north-south-china",
    category: "china-region",
    title: "大江南北都认识",
    description: "南北各去过至少三个省级区域，口音和温度都换过。",
    tone: "pink",
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
    category: "china-region",
    title: "东西横着晃",
    description: "东部与西部各去过至少两个省级区域。",
    tone: "purple",
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
    category: "china-region",
    title: "直辖市全勤",
    description: "北京、上海、天津、重庆全部点亮。",
    tone: "orange",
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
    category: "china-region",
    title: "沿海串珠",
    description: "六个沿海省级区域，海岸线被你串成了一条项链。",
    tone: "ocean",
    priority: 91,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_COASTAL), 6, "个沿海区域"),
  },
  {
    id: "northeast-three",
    category: "china-region",
    title: "东北三省全勤",
    description: "辽宁、吉林、黑龙江全部点亮，东北地图一块不少。",
    tone: "ocean",
    priority: 112,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_NORTHEAST), 3, "个省级区域"),
  },
  {
    id: "beijing-tianjin-hebei",
    category: "china-region",
    title: "京津冀串门卡",
    description: "北京、天津、河北三点连线，首都圈被你走成日常。",
    tone: "orange",
    priority: 111,
    evaluate: (context) =>
      countResult(
        countInSet(context.cnProvinces, CN_BEIJING_TIANJIN_HEBEI),
        3,
        "个省级区域",
      ),
  },
  {
    id: "jiangzhehu-package",
    category: "china-region",
    title: "江浙沪包邮漫游",
    description: "上海、江苏、浙江全部点亮，周末路线开始自动成团。",
    tone: "pink",
    priority: 114,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_JIANGZHEHU), 3, "个省级区域"),
  },
  {
    id: "greater-bay-roamer",
    category: "china-region",
    title: "大湾区串门客",
    description: "广东、香港、澳门全部点亮，跨城切换已经很顺手。",
    tone: "purple",
    priority: 116,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_GREATER_BAY), 3, "个省级区域"),
  },
  {
    id: "central-three",
    category: "china-region",
    title: "中部三省连线",
    description: "河南、湖北、湖南全部点亮，中原与江湖接上了线。",
    tone: "lime",
    priority: 110,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_CENTRAL), 3, "个省级区域"),
  },
  {
    id: "southwest-mountain-pass",
    category: "china-region",
    title: "西南山路通行证",
    description: "西南五地里点亮四处，山路再弯也拦不住你。",
    tone: "orange",
    priority: 118,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_SOUTHWEST), 4, "个省级区域"),
  },
  {
    id: "northwest-loop",
    category: "china-region",
    title: "西北大环线体质",
    description: "西北五地里点亮四处，戈壁、高原和古城已经连片。",
    tone: "purple",
    priority: 120,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_NORTHWEST), 4, "个省级区域"),
  },
  {
    id: "two-islands",
    category: "china-region",
    title: "两座宝岛双开",
    description: "海南与台湾都留下足迹，两种海岛日常一起点亮。",
    tone: "ocean",
    priority: 117,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_ISLANDS), 2, "个海岛区域"),
  },
  {
    id: "yellow-river-route",
    category: "china-region",
    title: "沿黄一路向东",
    description: "黄河沿线点亮五地，把高原、古都和入海口串在一起。",
    tone: "orange",
    priority: 121,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_YELLOW_RIVER), 5, "个沿黄区域"),
  },
  {
    id: "yangtze-route",
    category: "china-region",
    title: "长江一路相认",
    description: "长江沿线点亮六地，从雪山水源一路晃向东海。",
    tone: "ocean",
    priority: 122,
    evaluate: (context) =>
      countResult(countInSet(context.cnProvinces, CN_YANGTZE), 6, "个沿江区域"),
  },

  ...CHINA_CITY_TITLE_DEFINITIONS,
  ...CHINA_LANDMARK_TITLE_DEFINITIONS,

  {
    id: "china-special-forces-day",
    category: "china-style",
    title: "一日三城特种兵",
    description: "同一天点亮三座中国城市，时间表已经进入竞速模式。",
    tone: "orange",
    priority: 142,
    evaluate: (context) =>
      countResult(context.maxChinaCitiesInDay, 3, "座同日城市"),
  },
  {
    id: "china-weekend-flash",
    category: "china-style",
    title: "周末闪现小队",
    description: "三次国内到访落在周末，休息日也能装下一段旅程。",
    tone: "pink",
    priority: 128,
    evaluate: (context) =>
      countResult(context.chinaWeekendVisits, 3, "次周末到访"),
  },
  {
    id: "china-province-deep-dive",
    category: "china-style",
    title: "一省深挖三城",
    description: "同一省级区域认真去过三座城市，不只停在省会。",
    tone: "lime",
    priority: 132,
    evaluate: (context) =>
      countResult(context.maxChinaCitiesInProvince, 3, "座同省城市"),
  },
  {
    id: "china-province-local",
    category: "china-style",
    title: "一省熟门熟路",
    description: "同一省级区域点亮五座城市，路线已经有了在地感。",
    tone: "purple",
    priority: 145,
    evaluate: (context) =>
      countResult(context.maxChinaCitiesInProvince, 5, "座同省城市"),
  },
  {
    id: "china-landmark-special-forces",
    category: "china-style",
    title: "出片特种兵",
    description: "同一座城市收下五处景点，相册和腿都很忙。",
    tone: "pink",
    priority: 138,
    evaluate: (context) =>
      countResult(context.maxChinaLandmarksInCity, 5, "处同城景点"),
  },
  {
    id: "china-listen-and-go",
    category: "china-style",
    title: "听劝就多看两眼",
    description: "国内景点收藏达到十处，别人的建议被你走成了自己的路。",
    tone: "orange",
    priority: 133,
    evaluate: (context) => countResult(context.cnLandmarks.length, 10, "处景点"),
  },
  {
    id: "china-city-replay",
    category: "china-style",
    title: "喜欢就再刷一次",
    description: "同一座中国城市至少到访两次，喜欢无需一次说完。",
    tone: "ocean",
    priority: 130,
    evaluate: (context) =>
      countResult(context.maxSameChinaCityVisits, 2, "次同城到访"),
  },
  {
    id: "china-local-life",
    category: "china-style",
    title: "在地生活体验卡",
    description: "在国内有过短居、常住或出生地记录，不只是匆匆路过。",
    tone: "lime",
    priority: 136,
    evaluate: (context) => countResult(context.chinaDeepVisits, 1, "次在地生活"),
  },
  {
    id: "china-four-seasons",
    category: "china-style",
    title: "四季神州都在路上",
    description: "春夏秋冬都留下过国内到访日期，出发没有固定季节。",
    tone: "purple",
    priority: 143,
    evaluate: (context) => countResult(context.chinaSeasons.size, 4, "个季节"),
  },
  {
    id: "china-grotto-route",
    category: "china-style",
    title: "石窟巡礼双响",
    description: "莫高、云冈、龙门或麦积山中点亮两处，石头里的时间开始连线。",
    tone: "purple",
    priority: 159,
    evaluate: (context) =>
      countResult(
        matchingChinaLandmarkCount(context, [
          "莫高窟",
          "云冈石窟",
          "龙门石窟",
          "麦积山石窟",
          "mogao",
          "yungang",
          "longmen",
          "maijishan",
        ]),
        2,
        "处石窟",
      ),
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
