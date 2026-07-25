"use client";

import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Crosshair,
  Globe2,
  Landmark,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MapLoadState = "loading" | "ready" | "fallback" | "unavailable";

type LandmarkOption = {
  id: string;
  name: string;
  subtitle: string;
  longitude: number;
  latitude: number;
};

type CityCandidate = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region?: string;
  subtitle: string;
  longitude: number;
  latitude: number;
  bbox?: [number, number, number, number];
  geometry?: Polygon | MultiPolygon;
};

type CityVisit = CityCandidate & {
  visitId: string;
  visitedOn: string;
  landmarks: LandmarkOption[];
};

type ActiveCountry = {
  code: string;
  name: string;
};

type NominatimResult = {
  place_id: number;
  osm_id?: number;
  osm_type?: string;
  display_name: string;
  name?: string;
  type: string;
  class?: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
  geojson?: Geometry;
  address?: Record<string, string>;
};

const STORAGE_KEY = "footprint-atlas-m1-city-visits";
const MAP_READY_TIMEOUT_MS = 7000;
const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const FEATURED_CITIES: CityCandidate[] = [
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
];

const LANDMARKS_BY_CITY: Record<string, LandmarkOption[]> = {
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
};

const FLAT_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Footprint Atlas flat world",
  sources: {
    "city-basemap": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution:
        "Basemap © Esri · Country boundaries © Natural Earth · Data © OpenStreetMap contributors",
    },
    countries: {
      type: "geojson",
      data: "/data/world-countries.geojson",
    },
    "selected-city-areas": {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    },
    "selected-city-centers": {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    },
    "selected-landmarks": {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    },
    "candidate-city-area": {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    },
    "candidate-city-center": {
      type: "geojson",
      data: EMPTY_FEATURE_COLLECTION,
    },
    "city-labels": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    {
      id: "paper-background",
      type: "background",
      paint: { "background-color": "#d6e2df" },
    },
    {
      id: "city-basemap",
      type: "raster",
      source: "city-basemap",
      paint: {
        "raster-opacity": 0.8,
        "raster-saturation": -0.72,
        "raster-contrast": -0.08,
      },
    },
    {
      id: "country-base-fill",
      type: "fill",
      source: "countries",
      paint: {
        "fill-color": "#eee9dc",
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.9,
          3,
          0.66,
          5,
          0.12,
          9,
          0.02,
        ],
      },
    },
    {
      id: "country-boundaries",
      type: "line",
      source: "countries",
      paint: {
        "line-color": "#7f918b",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.55,
          4,
          0.9,
          8,
          1.2,
        ],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.65,
          7,
          0.3,
        ],
      },
    },
    {
      id: "selected-country-fill",
      type: "fill",
      source: "countries",
      filter: ["==", ["get", "ISO_A2_EH"], "__none__"],
      paint: {
        "fill-color": "#efb55b",
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.78,
          4,
          0.52,
          8,
          0.18,
        ],
      },
    },
    {
      id: "selected-country-line",
      type: "line",
      source: "countries",
      filter: ["==", ["get", "ISO_A2_EH"], "__none__"],
      paint: {
        "line-color": "#c6533f",
        "line-width": 1.6,
        "line-opacity": 0.85,
      },
    },
    {
      id: "active-country-fill",
      type: "fill",
      source: "countries",
      filter: ["==", ["get", "ISO_A2_EH"], "__none__"],
      paint: {
        "fill-color": "#4e817c",
        "fill-opacity": 0.16,
      },
    },
    {
      id: "active-country-line",
      type: "line",
      source: "countries",
      filter: ["==", ["get", "ISO_A2_EH"], "__none__"],
      paint: {
        "line-color": "#173b42",
        "line-width": 2,
        "line-opacity": 0.9,
      },
    },
    {
      id: "selected-city-area-fill",
      type: "fill",
      source: "selected-city-areas",
      paint: {
        "fill-color": "#d85c45",
        "fill-opacity": 0.3,
      },
    },
    {
      id: "selected-city-area-line",
      type: "line",
      source: "selected-city-areas",
      paint: {
        "line-color": "#b43e2f",
        "line-width": 2.1,
        "line-opacity": 0.9,
      },
    },
    {
      id: "selected-city-halo",
      type: "circle",
      source: "selected-city-centers",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          7,
          7,
          15,
          12,
          23,
        ],
        "circle-color": "#d85c45",
        "circle-opacity": 0.18,
        "circle-blur": 0.55,
      },
    },
    {
      id: "selected-city-center",
      type: "circle",
      source: "selected-city-centers",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          3.8,
          8,
          6.5,
          14,
          9,
        ],
        "circle-color": "#c6533f",
        "circle-stroke-color": "#fffdf7",
        "circle-stroke-width": 2,
      },
    },
    {
      id: "selected-landmark-halo",
      type: "circle",
      source: "selected-landmarks",
      minzoom: 7,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          5,
          14,
          12,
        ],
        "circle-color": "#efb55b",
        "circle-opacity": 0.2,
        "circle-blur": 0.45,
      },
    },
    {
      id: "selected-landmark-center",
      type: "circle",
      source: "selected-landmarks",
      minzoom: 7,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          2.8,
          14,
          5,
        ],
        "circle-color": "#efb55b",
        "circle-stroke-color": "#173b42",
        "circle-stroke-width": 1.2,
      },
    },
    {
      id: "candidate-city-area-fill",
      type: "fill",
      source: "candidate-city-area",
      paint: {
        "fill-color": "#3b716c",
        "fill-opacity": 0.22,
      },
    },
    {
      id: "candidate-city-area-line",
      type: "line",
      source: "candidate-city-area",
      paint: {
        "line-color": "#173b42",
        "line-width": 2.3,
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "candidate-city-halo",
      type: "circle",
      source: "candidate-city-center",
      paint: {
        "circle-radius": 18,
        "circle-color": "#173b42",
        "circle-opacity": 0.16,
        "circle-blur": 0.5,
      },
    },
    {
      id: "candidate-city-center",
      type: "circle",
      source: "candidate-city-center",
      paint: {
        "circle-radius": 6,
        "circle-color": "#173b42",
        "circle-stroke-color": "#fffdf7",
        "circle-stroke-width": 2,
      },
    },
    {
      id: "city-labels",
      type: "raster",
      source: "city-labels",
      paint: {
        "raster-opacity": 0.92,
        "raster-saturation": -0.65,
      },
    },
    {
      id: "country-hit-area",
      type: "fill",
      source: "countries",
      paint: {
        "fill-color": "#000000",
        "fill-opacity": 0.001,
      },
    },
  ],
};

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatVisitDate(value: string) {
  if (!value) return "日期待补";
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function normalizeCityName(value: string) {
  return value
    .trim()
    .replace(/(特别行政区|自治州|地区|市)$/u, "")
    .toLocaleLowerCase();
}

function cityCatalogKey(city: Pick<CityCandidate, "countryCode" | "name">) {
  const normalizedName = normalizeCityName(city.name);
  const match = FEATURED_CITIES.find(
    (item) =>
      item.countryCode === city.countryCode &&
      normalizeCityName(item.name) === normalizedName,
  );
  return `${city.countryCode}:${match?.name ?? city.name}`;
}

function landmarksForCity(city: CityCandidate) {
  return LANDMARKS_BY_CITY[cityCatalogKey(city)] ?? [];
}

function normalizeCityResult(result: NominatimResult): CityCandidate | null {
  const address = result.address ?? {};
  const settlementType = [
    "city",
    "town",
    "village",
    "municipality",
    "borough",
  ].includes(result.type);
  const cityName =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    (settlementType ? result.name : undefined);
  const country = address.country;
  const countryCode = (address.country_code ?? "").toUpperCase();

  if (!cityName || !country || countryCode.length !== 2) return null;

  const region =
    address.state ?? address.province ?? address.region ?? address.county;
  const geometry =
    result.geojson?.type === "Polygon" ||
    result.geojson?.type === "MultiPolygon"
      ? result.geojson
      : undefined;
  const bbox = result.boundingbox
    ? ([
        Number(result.boundingbox[2]),
        Number(result.boundingbox[0]),
        Number(result.boundingbox[3]),
        Number(result.boundingbox[1]),
      ] as [number, number, number, number])
    : undefined;

  return {
    id: `city-${result.osm_type ?? "place"}-${result.osm_id ?? result.place_id}`,
    name: cityName,
    country,
    countryCode,
    region,
    subtitle: [region, country].filter(Boolean).join(" · "),
    longitude: Number(result.lon),
    latitude: Number(result.lat),
    bbox,
    geometry,
  };
}

function normalizeLandmarkResult(result: NominatimResult): LandmarkOption {
  const address = result.address ?? {};
  return {
    id: `landmark-${result.osm_type ?? "place"}-${result.osm_id ?? result.place_id}`,
    name: result.name ?? result.display_name.split(",")[0] ?? "未命名地标",
    subtitle:
      [address.road, address.suburb, address.city]
        .filter(Boolean)
        .slice(0, 2)
        .join(" · ") || result.type,
    longitude: Number(result.lon),
    latitude: Number(result.lat),
  };
}

function countryFilter(codes: string[]): maplibregl.FilterSpecification {
  if (codes.length === 0) {
    return ["==", ["get", "ISO_A2_EH"], "__none__"];
  }
  return [
    "in",
    ["get", "ISO_A2_EH"],
    ["literal", codes],
  ] as maplibregl.FilterSpecification;
}

function activeCountryFilter(code?: string): maplibregl.FilterSpecification {
  return code
    ? ["==", ["get", "ISO_A2_EH"], code]
    : ["==", ["get", "ISO_A2_EH"], "__none__"];
}

function boundsFromGeometry(geometry: Geometry) {
  const bounds = new maplibregl.LngLatBounds();

  const walk = (coordinates: unknown) => {
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      bounds.extend([coordinates[0], coordinates[1]]);
      return;
    }
    if (Array.isArray(coordinates)) coordinates.forEach(walk);
  };

  if ("coordinates" in geometry) walk(geometry.coordinates);
  return bounds;
}

function cityAreaCollection(visits: CityVisit[]): FeatureCollection {
  const seen = new Set<string>();
  const features: Feature<Polygon | MultiPolygon>[] = [];

  visits.forEach((visit) => {
    const key = `${visit.countryCode}:${normalizeCityName(visit.name)}`;
    if (!visit.geometry || seen.has(key)) return;
    seen.add(key);
    features.push({
      type: "Feature",
      properties: {
        id: visit.id,
        name: visit.name,
        countryCode: visit.countryCode,
      },
      geometry: visit.geometry,
    });
  });

  return { type: "FeatureCollection", features };
}

function cityCenterCollection(visits: CityVisit[]): FeatureCollection<Point> {
  const unique = new Map<string, CityVisit>();
  visits.forEach((visit) => {
    unique.set(`${visit.countryCode}:${normalizeCityName(visit.name)}`, visit);
  });

  return {
    type: "FeatureCollection",
    features: [...unique.values()].map((visit) => ({
      type: "Feature",
      properties: {
        id: visit.id,
        name: visit.name,
        visitedOn: visit.visitedOn,
      },
      geometry: {
        type: "Point",
        coordinates: [visit.longitude, visit.latitude],
      },
    })),
  };
}

function landmarkCollection(visits: CityVisit[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: visits.flatMap((visit) =>
      visit.landmarks.map((landmark) => ({
        type: "Feature" as const,
        properties: {
          id: landmark.id,
          name: landmark.name,
          city: visit.name,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [landmark.longitude, landmark.latitude],
        },
      })),
    ),
  };
}

function candidateAreaCollection(city: CityCandidate | null): FeatureCollection {
  if (!city?.geometry) return EMPTY_FEATURE_COLLECTION;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: city.id, name: city.name },
        geometry: city.geometry,
      },
    ],
  };
}

function candidateCenterCollection(
  city: CityCandidate | null,
): FeatureCollection<Point> {
  if (!city) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: city.id, name: city.name },
        geometry: {
          type: "Point",
          coordinates: [city.longitude, city.latitude],
        },
      },
    ],
  };
}

export default function AtlasExplorer() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const featuredMarkersRef = useRef<maplibregl.Marker[]>([]);
  const selectedMarkersRef = useRef<maplibregl.Marker[]>([]);
  const pickModeRef = useRef(false);
  const lastLookupRef = useRef(0);

  const [mapState, setMapState] = useState<MapLoadState>("loading");
  const [basemapIssue, setBasemapIssue] = useState(false);
  const [visits, setVisits] = useState<CityVisit[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeCountry, setActiveCountry] = useState<ActiveCountry | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CityCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pickMode, setPickMode] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [candidate, setCandidate] = useState<CityCandidate | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [landmarksOpen, setLandmarksOpen] = useState(true);
  const [landmarkOptions, setLandmarkOptions] = useState<LandmarkOption[]>([]);
  const [selectedLandmarks, setSelectedLandmarks] = useState<LandmarkOption[]>(
    [],
  );
  const [landmarkQuery, setLandmarkQuery] = useState("");
  const [landmarkSearching, setLandmarkSearching] = useState(false);
  const [landmarkError, setLandmarkError] = useState("");
  const [toast, setToast] = useState("");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const mapReady = mapState === "ready" || mapState === "fallback";

  const stats = useMemo(() => {
    const countries = new Set(visits.map((visit) => visit.countryCode));
    const cities = new Set(
      visits.map(
        (visit) => `${visit.countryCode}:${normalizeCityName(visit.name)}`,
      ),
    );
    const landmarks = visits.reduce(
      (total, visit) => total + visit.landmarks.length,
      0,
    );
    return {
      countries: countries.size,
      cities: cities.size,
      landmarks,
    };
  }, [visits]);

  const showToast = useCallback((message: string) => setToast(message), []);

  const selectCityCandidate = useCallback((city: CityCandidate) => {
    setCandidate(city);
    setActiveCountry({ code: city.countryCode, name: city.country });
    setVisitDate(todayISO());
    setLandmarkOptions(landmarksForCity(city));
    setSelectedLandmarks([]);
    setLandmarkQuery("");
    setLandmarkError("");
    setLandmarksOpen(true);
    setSearchResults([]);
    setSearchError("");
  }, []);

  const focusCity = useCallback((city: CityCandidate) => {
    const map = mapRef.current;
    if (!map) return;
    if (city.bbox) {
      map.fitBounds(
        [
          [city.bbox[0], city.bbox[1]],
          [city.bbox[2], city.bbox[3]],
        ],
        {
          padding: { top: 120, right: 90, bottom: 110, left: 90 },
          maxZoom: 11,
          duration: 900,
        },
      );
      return;
    }
    map.flyTo({
      center: [city.longitude, city.latitude],
      zoom: 9,
      essential: true,
    });
  }, []);

  const openCity = useCallback(
    (city: CityCandidate) => {
      selectCityCandidate(city);
      focusCity(city);
    },
    [focusCity, selectCityCandidate],
  );

  useEffect(() => {
    let savedVisits: CityVisit[] | null = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CityVisit[];
        if (Array.isArray(parsed)) savedVisits = parsed;
      }
    } catch {
      // Device-local storage is convenient, but it must never block the map.
    }

    const hydrationTimer = window.setTimeout(() => {
      if (savedVisits) setVisits(savedVisits);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch {
      // The prototype remains usable without device-local persistence.
    }
  }, [hydrated, visits]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    maplibregl.setWorkerUrl(maplibreWorkerUrl);
    let map: maplibregl.Map;
    let destroyed = false;
    let startupSettled = false;

    const readyTimer = window.setTimeout(() => {
      if (destroyed || startupSettled) return;
      startupSettled = true;
      setMapState("fallback");
    }, MAP_READY_TIMEOUT_MS);

    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: FLAT_MAP_STYLE,
        center: [12, 23],
        zoom: 1.35,
        minZoom: 0.8,
        maxZoom: 17,
        attributionControl: false,
        // A full 360° maxBounds combined with disabled world copies can make
        // MapLibre 6 calculate a singular projection matrix during startup.
        // The local country layer already defines the visible world extent.
        renderWorldCopies: false,
      });
    } catch (error) {
      console.error("Footprint Atlas map initialization failed", error);
      window.clearTimeout(readyTimer);
      const unavailableTimer = window.setTimeout(
        () => setMapState("unavailable"),
        0,
      );
      return () => window.clearTimeout(unavailableTimer);
    }

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.once("style.load", () => {
      if (destroyed || startupSettled) return;
      startupSettled = true;
      window.clearTimeout(readyTimer);
      setMapState("ready");
    });

    map.on("error", (event) => {
      const message = String(event.error?.message ?? "").toLowerCase();
      if (
        message.includes("arcgis") ||
        message.includes("raster") ||
        message.includes("tile")
      ) {
        setBasemapIssue(true);
      }
    });

    map.on("mouseenter", "country-hit-area", () => {
      if (!pickModeRef.current) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "country-hit-area", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("click", "country-hit-area", (event) => {
      if (pickModeRef.current) return;
      const feature = event.features?.[0];
      if (!feature) return;
      const code = String(
        feature.properties?.ISO_A2_EH ?? feature.properties?.ISO_A2 ?? "",
      );
      if (!code || code === "-99") return;
      const name = String(
        feature.properties?.NAME_ZH ??
          feature.properties?.NAME ??
          feature.properties?.ADMIN ??
          code,
      );
      setActiveCountry({ code, name });
      setCandidate(null);
      setSearchResults([]);
      setSearchError("");

      const bounds = boundsFromGeometry(feature.geometry);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 120, right: 85, bottom: 95, left: 85 },
          maxZoom: 5.4,
          duration: 950,
        });
      }
    });

    map.on("click", async (event) => {
      if (!pickModeRef.current) return;
      const now = Date.now();
      if (now - lastLookupRef.current < 1200) return;
      lastLookupRef.current = now;
      setLookupLoading(true);

      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          lat: String(event.lngLat.lat),
          lon: String(event.lngLat.lng),
          zoom: "10",
          addressdetails: "1",
          polygon_geojson: "1",
          polygon_threshold: "0.01",
          "accept-language": "zh-CN,zh,en",
        });
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
          { headers: { Accept: "application/json" } },
        );
        if (!response.ok) throw new Error("City lookup failed");
        const result = (await response.json()) as NominatimResult;
        const city = normalizeCityResult(result);
        if (!city) throw new Error("No city found");
        selectCityCandidate(city);
        focusCity(city);
      } catch {
        showToast("没有辨认出城市，请使用上方搜索");
      } finally {
        setLookupLoading(false);
        setPickMode(false);
      }
    });

    mapRef.current = map;
    return () => {
      destroyed = true;
      window.clearTimeout(readyTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [focusCity, selectCityCandidate, showToast]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

    const countryCodes = [
      ...new Set(
        visits
          .map((visit) => visit.countryCode)
          .filter((code) => code.length === 2),
      ),
    ];
    map.setFilter("selected-country-fill", countryFilter(countryCodes));
    map.setFilter("selected-country-line", countryFilter(countryCodes));

    (
      map.getSource("selected-city-areas") as
        | maplibregl.GeoJSONSource
        | undefined
    )?.setData(cityAreaCollection(visits));
    (
      map.getSource("selected-city-centers") as
        | maplibregl.GeoJSONSource
        | undefined
    )?.setData(cityCenterCollection(visits));
    (
      map.getSource("selected-landmarks") as
        | maplibregl.GeoJSONSource
        | undefined
    )?.setData(landmarkCollection(visits));
  }, [mapReady, visits]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

    map.setFilter(
      "active-country-fill",
      activeCountryFilter(activeCountry?.code),
    );
    map.setFilter(
      "active-country-line",
      activeCountryFilter(activeCountry?.code),
    );
  }, [activeCountry, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

    (
      map.getSource("candidate-city-area") as
        | maplibregl.GeoJSONSource
        | undefined
    )?.setData(candidateAreaCollection(candidate));
    (
      map.getSource("candidate-city-center") as
        | maplibregl.GeoJSONSource
        | undefined
    )?.setData(candidateCenterCollection(candidate));
  }, [candidate, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    featuredMarkersRef.current.forEach((marker) => marker.remove());
    featuredMarkersRef.current = FEATURED_CITIES.map((city) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-featured-marker map-city-marker";
      button.setAttribute("aria-label", `选择城市 ${city.name}`);
      button.title = `${city.name} · ${city.country}`;

      const dot = document.createElement("span");
      dot.className = "map-featured-marker-dot";
      const label = document.createElement("span");
      label.className = "map-featured-marker-label";
      label.textContent = city.name;
      button.append(dot, label);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openCity(city);
      });

      return new maplibregl.Marker({ element: button, anchor: "bottom" })
        .setLngLat([city.longitude, city.latitude])
        .addTo(map);
    });

    return () => {
      featuredMarkersRef.current.forEach((marker) => marker.remove());
      featuredMarkersRef.current = [];
    };
  }, [mapReady, openCity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const uniqueCities = new Map<string, CityVisit>();
    visits.forEach((visit) => {
      uniqueCities.set(
        `${visit.countryCode}:${normalizeCityName(visit.name)}`,
        visit,
      );
    });

    selectedMarkersRef.current.forEach((marker) => marker.remove());
    selectedMarkersRef.current = [...uniqueCities.values()].map(
      (visit, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "map-selected-marker";
        button.setAttribute("aria-label", `已打卡城市 ${visit.name}`);
        button.title = `${visit.name} · ${formatVisitDate(visit.visitedOn)}`;

        const number = document.createElement("span");
        number.textContent = String(index + 1);
        button.appendChild(number);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          focusCity(visit);
        });

        return new maplibregl.Marker({
          element: button,
          anchor: "bottom",
        })
          .setLngLat([visit.longitude, visit.latitude])
          .addTo(map);
      },
    );

    return () => {
      selectedMarkersRef.current.forEach((marker) => marker.remove());
      selectedMarkersRef.current = [];
    };
  }, [focusCity, mapReady, visits]);

  async function handleCitySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchError("请输入至少两个字的城市名");
      return;
    }

    setSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const params = new URLSearchParams({
        q: trimmed,
        format: "jsonv2",
        addressdetails: "1",
        limit: "10",
        polygon_geojson: "1",
        polygon_threshold: "0.01",
        "accept-language": "zh-CN,zh,en",
      });
      if (activeCountry?.code) {
        params.set("countrycodes", activeCountry.code.toLowerCase());
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("City search failed");

      const rawResults = (await response.json()) as NominatimResult[];
      const unique = new Map<string, CityCandidate>();
      rawResults.forEach((result) => {
        const city = normalizeCityResult(result);
        if (!city) return;
        unique.set(
          `${city.countryCode}:${normalizeCityName(city.name)}`,
          city,
        );
      });
      const normalized = [...unique.values()].slice(0, 6);
      setSearchResults(normalized);
      if (normalized.length === 0) {
        setSearchError("没有找到城市。可以换一个名称，或使用地图选城市。");
      }
    } catch {
      setSearchError("城市搜索暂时不可用，可以使用地图选城市。");
    } finally {
      setSearching(false);
    }
  }

  async function handleLandmarkSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidate) return;
    const trimmed = landmarkQuery.trim();
    if (trimmed.length < 2) {
      setLandmarkError("请输入至少两个字");
      return;
    }

    setLandmarkSearching(true);
    setLandmarkError("");

    try {
      const params = new URLSearchParams({
        q: `${trimmed}, ${candidate.name}, ${candidate.country}`,
        format: "jsonv2",
        addressdetails: "1",
        limit: "6",
        "accept-language": "zh-CN,zh,en",
      });
      if (candidate.bbox) {
        params.set(
          "viewbox",
          `${candidate.bbox[0]},${candidate.bbox[3]},${candidate.bbox[2]},${candidate.bbox[1]}`,
        );
        params.set("bounded", "1");
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Landmark search failed");
      const results = (await response.json()) as NominatimResult[];
      const nextOptions = results.map(normalizeLandmarkResult);
      const merged = new Map(
        [...landmarkOptions, ...nextOptions].map((item) => [item.id, item]),
      );
      setLandmarkOptions([...merged.values()]);
      if (nextOptions.length === 0) {
        setLandmarkError("没有找到，可以换一个地标名称");
      }
    } catch {
      setLandmarkError("地标搜索暂时不可用");
    } finally {
      setLandmarkSearching(false);
    }
  }

  function toggleLandmark(landmark: LandmarkOption) {
    setSelectedLandmarks((current) =>
      current.some((item) => item.id === landmark.id)
        ? current.filter((item) => item.id !== landmark.id)
        : [...current, landmark],
    );
  }

  function addCandidateVisit() {
    if (!candidate) return;
    if (!visitDate) {
      showToast("请选择到访日期");
      return;
    }

    const duplicate = visits.some(
      (visit) =>
        visit.countryCode === candidate.countryCode &&
        normalizeCityName(visit.name) === normalizeCityName(candidate.name) &&
        visit.visitedOn === visitDate,
    );
    if (duplicate) {
      showToast("这座城市在同一天已经记录过了");
      return;
    }

    const visit: CityVisit = {
      ...candidate,
      visitId: `${candidate.id}-${visitDate}`,
      visitedOn: visitDate,
      landmarks: selectedLandmarks,
    };
    setVisits((current) => [...current, visit]);
    setCandidate(null);
    setSelectedLandmarks([]);
    setLandmarkOptions([]);
    setLandmarkQuery("");
    setQuery("");
    showToast(`已点亮 ${candidate.country} · ${candidate.name}`);
  }

  function removeVisit(visitId: string) {
    setVisits((current) =>
      current.filter((visit) => visit.visitId !== visitId),
    );
    showToast("已移除这次城市记录");
  }

  function fitToVisits() {
    const map = mapRef.current;
    if (!map || visits.length === 0) return;
    if (visits.length === 1) {
      focusCity(visits[0]);
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    visits.forEach((visit) =>
      bounds.extend([visit.longitude, visit.latitude]),
    );
    map.fitBounds(bounds, {
      padding: { top: 135, right: 95, bottom: 105, left: 95 },
      maxZoom: 7,
      duration: 1000,
    });
  }

  function resetWorldView() {
    setActiveCountry(null);
    setCandidate(null);
    setSearchResults([]);
    setSearchError("");
    mapRef.current?.flyTo({
      center: [12, 23],
      zoom: 1.35,
      bearing: 0,
      pitch: 0,
      essential: true,
    });
  }

  return (
    <main className="atlas-shell">
      <div
        ref={mapContainerRef}
        className={`atlas-map atlas-map-flat ${
          pickMode ? "atlas-map-picking" : ""
        }`}
        role="region"
        aria-label="平面世界城市足迹地图"
      />

      <header className="atlas-header">
        <button
          type="button"
          className="atlas-brand"
          onClick={resetWorldView}
          aria-label="返回平面世界地图"
        >
          <span className="atlas-brand-mark">
            <Compass size={18} strokeWidth={2.2} />
          </span>
          <span className="atlas-brand-copy">
            <strong>远迹</strong>
            <small>FOOTPRINT ATLAS</small>
          </span>
        </button>

        <div className="atlas-step" aria-label="当前步骤">
          <span>01</span>
          <p>
            城市打卡
            <small>先选城市，再补日期与地标</small>
          </p>
        </div>

        <button
          type="button"
          className="atlas-mobile-footprints"
          onClick={() => setMobilePanelOpen((current) => !current)}
          aria-expanded={mobilePanelOpen}
        >
          <MapPin size={16} />
          {visits.length}
        </button>
      </header>

      <section className="atlas-search-wrap" aria-label="城市搜索">
        <form className="atlas-search" onSubmit={handleCitySearch}>
          <Search size={20} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchError("");
            }}
            placeholder={
              activeCountry
                ? `在${activeCountry.name}搜索城市`
                : "搜索城市，例如：上海、巴黎"
            }
            aria-label="搜索城市"
          />
          {query && !searching ? (
            <button
              type="button"
              className="atlas-icon-button"
              onClick={() => {
                setQuery("");
                setSearchResults([]);
                setSearchError("");
              }}
              aria-label="清除城市搜索"
            >
              <X size={17} />
            </button>
          ) : null}
          <button
            type="submit"
            className="atlas-search-submit"
            disabled={searching}
          >
            {searching ? (
              <LoaderCircle className="spinning" size={17} />
            ) : (
              <ArrowRight size={17} />
            )}
            <span>查找城市</span>
          </button>
        </form>

        {(searchResults.length > 0 || searchError) && (
          <div className="atlas-search-results">
            {searchError ? (
              <p className="atlas-search-message">{searchError}</p>
            ) : (
              <>
                <div className="atlas-search-results-header">
                  <span>城市结果</span>
                  <small>城市是最小打卡单位</small>
                </div>
                {searchResults.map((city) => (
                  <button
                    type="button"
                    className="atlas-search-result"
                    key={city.id}
                    onClick={() => openCity(city)}
                  >
                    <span className="atlas-result-icon">
                      <Building2 size={16} />
                    </span>
                    <span className="atlas-result-copy">
                      <strong>{city.name}</strong>
                      <small>{city.subtitle}</small>
                    </span>
                    <span className="atlas-result-level">城市</span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </>
            )}
            <div className="atlas-search-attribution">
              城市与地标搜索 © OpenStreetMap contributors
            </div>
          </div>
        )}
      </section>

      <div className="atlas-map-breadcrumb" aria-label="地图层级">
        <button type="button" onClick={resetWorldView}>
          世界
        </button>
        {activeCountry ? (
          <>
            <ChevronRight size={13} />
            <button
              type="button"
              onClick={() => {
                setCandidate(null);
                setSearchResults([]);
              }}
            >
              {activeCountry.name}
            </button>
          </>
        ) : null}
        {candidate ? (
          <>
            <ChevronRight size={13} />
            <strong>{candidate.name}</strong>
          </>
        ) : null}
        <span>
          {candidate
            ? "选择日期与城市地标"
            : activeCountry
              ? "搜索或在地图上选择城市"
              : "点击国家进入"}
        </span>
      </div>

      <aside
        className={`atlas-panel ${mobilePanelOpen ? "atlas-panel-open" : ""}`}
      >
        <div className="atlas-panel-handle" aria-hidden="true" />

        <div className="atlas-panel-intro">
          <span className="atlas-eyebrow">
            <Sparkles size={13} />
            从世界，到你真正到过的城市
          </span>
          <h1>
            点亮国家，
            <br />
            记录每一座城市。
          </h1>
          <p>
            点击国家进入，选择城市与到访日期；城市里的地标作为下一层记录。
          </p>
        </div>

        <div className="atlas-stats" aria-label="城市足迹统计">
          <div>
            <strong>{String(stats.countries).padStart(2, "0")}</strong>
            <span>国家 / 地区</span>
          </div>
          <div>
            <strong>{String(stats.cities).padStart(2, "0")}</strong>
            <span>城市</span>
          </div>
          <div>
            <strong>{String(stats.landmarks).padStart(2, "0")}</strong>
            <span>城市地标</span>
          </div>
        </div>

        <div className="atlas-panel-section">
          <div className="atlas-section-title">
            <div>
              <span>我的城市足迹</span>
              <small>{visits.length} 次到访记录</small>
            </div>
            {visits.length > 0 ? (
              <button type="button" onClick={fitToVisits}>
                <LocateFixed size={15} />
                查看全部
              </button>
            ) : null}
          </div>

          {visits.length === 0 ? (
            <div className="atlas-empty">
              <div className="atlas-empty-orbit">
                <Globe2 size={26} />
                <span />
              </div>
              <strong>从第一座城市开始点亮世界</strong>
              <p>先选择城市，再加入日期与城市地标。</p>
              <div className="atlas-suggestions">
                {FEATURED_CITIES.slice(0, 4).map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => openCity(city)}
                  >
                    {city.name}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="atlas-footprint-list atlas-city-visit-list">
              {visits.map((visit, index) => (
                <li key={visit.visitId} className="atlas-city-visit">
                  <div className="atlas-city-visit-row">
                    <button
                      type="button"
                      className="atlas-footprint-main"
                      onClick={() => focusCity(visit)}
                    >
                      <span className="atlas-footprint-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="atlas-footprint-icon">
                        <Building2 size={15} />
                      </span>
                      <span className="atlas-footprint-copy">
                        <strong>{visit.name}</strong>
                        <small>
                          {visit.country} · {formatVisitDate(visit.visitedOn)}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="atlas-remove"
                      onClick={() => removeVisit(visit.visitId)}
                      aria-label={`移除 ${visit.name} 的到访记录`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {visit.landmarks.length > 0 ? (
                    <div
                      className="atlas-visit-landmarks"
                      aria-label={`${visit.name}的城市地标`}
                    >
                      <span>
                        <Landmark size={12} />
                        城市地标
                      </span>
                      <div>
                        {visit.landmarks.map((landmark) => (
                          <button
                            type="button"
                            key={landmark.id}
                            onClick={() =>
                              mapRef.current?.flyTo({
                                center: [
                                  landmark.longitude,
                                  landmark.latitude,
                                ],
                                zoom: 14,
                                essential: true,
                              })
                            }
                          >
                            {landmark.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="atlas-panel-footer">
          <button
            type="button"
            className={`atlas-pick-button ${pickMode ? "is-active" : ""}`}
            onClick={() => setPickMode((current) => !current)}
            disabled={mapState === "unavailable"}
          >
            {pickMode ? <X size={17} /> : <Crosshair size={17} />}
            {pickMode ? "退出地图选择" : "地图选城市"}
          </button>
          <button
            type="button"
            className="atlas-next-button"
            disabled={visits.length === 0}
            onClick={() =>
              showToast(
                visits.length
                  ? `已点亮 ${stats.countries} 个国家、${stats.cities} 座城市`
                  : "请先添加一座城市",
              )
            }
          >
            完成城市选择
            <ArrowRight size={17} />
          </button>
        </div>
      </aside>

      <div className="atlas-map-tools">
        <button type="button" onClick={resetWorldView} aria-label="返回世界视图">
          <RotateCcw size={17} />
        </button>
        <span />
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
          aria-label="放大地图"
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
          aria-label="缩小地图"
        >
          <Minus size={17} />
        </button>
      </div>

      <div className="atlas-map-legend" aria-label="地图高亮图例">
        <span>
          <i className="country" />
          已去国家
        </span>
        <span>
          <i className="city" />
          已去城市
        </span>
      </div>

      {pickMode && (
        <div className="atlas-pick-hint">
          <Crosshair size={17} />
          <span>点击地图，系统会识别所在城市</span>
          <button type="button" onClick={() => setPickMode(false)}>
            取消
          </button>
        </div>
      )}

      {lookupLoading && (
        <div className="atlas-lookup">
          <LoaderCircle className="spinning" size={18} />
          正在识别城市…
        </div>
      )}

      {candidate && (
        <section className="atlas-city-composer" aria-label="添加城市到访">
          <div className="atlas-city-composer-head">
            <span className="atlas-candidate-icon">
              <Building2 size={19} />
            </span>
            <div>
              <small>添加城市到访</small>
              <h2>{candidate.name}</h2>
              <p>{candidate.subtitle}</p>
            </div>
            <button
              type="button"
              className="atlas-icon-button"
              onClick={() => setCandidate(null)}
              aria-label="关闭城市添加面板"
            >
              <X size={17} />
            </button>
          </div>

          <label className="atlas-date-field">
            <span>
              <CalendarDays size={15} />
              到访日期
            </span>
            <input
              type="date"
              value={visitDate}
              max={todayISO()}
              onChange={(event) => setVisitDate(event.target.value)}
              required
            />
          </label>

          <div className="atlas-landmark-picker">
            <button
              type="button"
              className="atlas-landmark-toggle"
              onClick={() => setLandmarksOpen((current) => !current)}
              aria-expanded={landmarksOpen}
            >
              <span>
                <Landmark size={15} />
                城市地标
                <small>可选 · 已选 {selectedLandmarks.length}</small>
              </span>
              <ChevronDown
                size={16}
                className={landmarksOpen ? "is-open" : ""}
              />
            </button>

            {landmarksOpen ? (
              <div className="atlas-landmark-body">
                {landmarkOptions.length > 0 ? (
                  <div className="atlas-landmark-options">
                    {landmarkOptions.map((landmark) => {
                      const selected = selectedLandmarks.some(
                        (item) => item.id === landmark.id,
                      );
                      return (
                        <button
                          type="button"
                          key={landmark.id}
                          className={selected ? "is-selected" : ""}
                          aria-pressed={selected}
                          onClick={() => toggleLandmark(landmark)}
                        >
                          <span>
                            <strong>{landmark.name}</strong>
                            <small>{landmark.subtitle}</small>
                          </span>
                          {selected ? <Check size={15} /> : <Plus size={15} />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="atlas-landmark-empty">
                    还没有推荐地标，可以搜索这座城市里的建筑或景点。
                  </p>
                )}

                <form
                  className="atlas-landmark-search"
                  onSubmit={handleLandmarkSearch}
                >
                  <Search size={14} />
                  <input
                    value={landmarkQuery}
                    onChange={(event) => {
                      setLandmarkQuery(event.target.value);
                      setLandmarkError("");
                    }}
                    placeholder={`搜索${candidate.name}的地标`}
                    aria-label={`搜索${candidate.name}的地标`}
                  />
                  <button type="submit" disabled={landmarkSearching}>
                    {landmarkSearching ? (
                      <LoaderCircle className="spinning" size={14} />
                    ) : (
                      "搜索"
                    )}
                  </button>
                </form>
                {landmarkError ? (
                  <p className="atlas-landmark-error">{landmarkError}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="atlas-city-composer-actions">
            <button type="button" onClick={() => focusCity(candidate)}>
              <LocateFixed size={15} />
              查看城市
            </button>
            <button
              type="button"
              className="primary"
              onClick={addCandidateVisit}
            >
              <Check size={16} />
              点亮这座城市
            </button>
          </div>
        </section>
      )}

      {basemapIssue && mapReady ? (
        <div className="atlas-map-status" role="status">
          <Globe2 size={15} />
          <span>
            <strong>城市细节图层连接较慢</strong>
            平面国界、国家与城市高亮仍可正常使用。
          </span>
        </div>
      ) : null}

      {mapState === "unavailable" ? (
        <div className="atlas-map-status atlas-map-status-error" role="alert">
          <Globe2 size={15} />
          <span>
            <strong>地图暂时无法显示</strong>
            仍可通过城市搜索继续添加记录。
          </span>
        </div>
      ) : null}

      {toast && (
        <div className="atlas-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}

      {mapState === "loading" && (
        <div className="atlas-loading">
          <div className="atlas-loading-mark">
            <Globe2 size={28} />
          </div>
          <p>正在铺开平面世界地图</p>
        </div>
      )}
    </main>
  );
}
