"use client";

import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Globe2,
  Landmark,
  LoaderCircle,
  Lock,
  LocateFixed,
  MapPin,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import StaticAtlasMap, {
  type CountryMetric,
  type StaticAtlasMapHandle,
} from "./StaticAtlasMap";
import WanderAlmanac from "./WanderAlmanac";
import {
  FEATURED_CITIES,
  chinaProvinceKey,
  formatLocationSubtitle,
  LANDMARKS_BY_CITY,
  normalizeCountryName,
  TRAVEL_TYPE_OPTIONS,
  travelTypeScore,
  type ActiveCountry,
  type AtlasGeometry,
  type CityCandidate,
  type CityVisit,
  type LandmarkOption,
  type TravelType,
} from "./atlas-data";
import {
  COUNTRY_REGION_FALLBACKS,
  evaluateRoamingTitles,
  recommendedRoamingTitle,
  ROAMING_TITLE_CATEGORIES,
  ROAMING_TITLES,
  type CountryRegionMap,
  type RoamingTitleCategoryId,
} from "./roaming-titles";

const STORAGE_KEY = "footprint-atlas-m1-city-visits";
const TITLE_STORAGE_KEY = "footprint-atlas-m1-primary-title";
const SCOPED_TITLE_STORAGE_KEY = "footprint-atlas-m2-primary-titles";
const EARLIEST_VISIT_YEAR = 1900;
const WORLD_COUNTRY_TOTAL = 173;
const CHINA_PROVINCE_TOTAL = 34;
const LANDMARK_RECOMMENDATION_LIMIT = 12;
const VALID_TRAVEL_TYPES = new Set<TravelType>(
  TRAVEL_TYPE_OPTIONS.map((option) => option.value),
);

type NominatimResult = {
  place_id: number;
  osm_id?: number;
  osm_type?: string;
  display_name: string;
  name?: string;
  type: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
  geojson?: {
    type?: string;
    coordinates?: unknown;
  };
  address?: Record<string, string>;
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

type AtlasScope = "world" | "china";

type ScopedTitleIds = Record<AtlasScope, string | null>;

type VisitGroup = {
  id: string;
  label: string;
  meta: string;
  heatLevel: CountryMetric["heatLevel"];
  visits: CityVisit[];
  country?: ActiveCountry;
};

type CountryRegionCollection = {
  features?: Array<{
    properties?: {
      ISO_A2_EH?: string;
      ISO_A2?: string;
      CONTINENT?: string;
      SUBREGION?: string;
    };
  }>;
};

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatVisitDate(value: string) {
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const fallback = todayISO().split("-").map(Number);
  return {
    year: Number.isFinite(year) ? year : fallback[0],
    month: Number.isFinite(month) ? month : fallback[1],
    day: Number.isFinite(day) ? day : fallback[2],
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function makeISODate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatCoveragePercent(visited: number, total: number) {
  if (visited <= 0 || total <= 0) return "0%";
  const percentage = (visited / total) * 100;
  if (percentage < 0.1) return "<0.1%";
  if (percentage < 10) return `${percentage.toFixed(1)}%`;
  return `${Math.round(percentage)}%`;
}

function normalizeCityName(value: string) {
  return value.trim().toLowerCase();
}

function cityNameStem(value: string) {
  return normalizeCityName(value)
    .replace(/[市區区縣县]$/u, "")
    .replace(/[·•・／/\s]/g, "");
}

function cityKey(city: Pick<CityCandidate, "countryCode" | "name">) {
  return `${city.countryCode}:${normalizeCityName(city.name)}`;
}

function landmarkKey(
  visit: Pick<CityCandidate, "countryCode" | "name">,
  landmark: LandmarkOption,
) {
  return `${cityKey(visit)}:${landmark.id}`;
}

function countryHeat(cityCount: number, hiddenScore: number) {
  if (cityCount >= 4 || hiddenScore >= 12) {
    return 4 as const;
  }
  if (cityCount >= 3 || hiddenScore >= 8) {
    return 3 as const;
  }
  if (cityCount >= 2 || hiddenScore >= 4) {
    return 2 as const;
  }
  return 1 as const;
}

function buildCountryMetrics(visits: CityVisit[]): CountryMetric[] {
  const accumulators = new Map<
    string,
    {
      name: string;
      cities: Set<string>;
      landmarks: Set<string>;
      cityScores: Map<string, number>;
    }
  >();

  visits.forEach((visit) => {
    const current = accumulators.get(visit.countryCode) ?? {
      name: normalizeCountryName(visit.country, visit.countryCode),
      cities: new Set<string>(),
      landmarks: new Set<string>(),
      cityScores: new Map<string, number>(),
    };
    const key = cityKey(visit);
    current.cities.add(key);
    current.cityScores.set(
      key,
      Math.max(
        current.cityScores.get(key) ?? 0,
        travelTypeScore(visit.travelType),
      ),
    );
    visit.landmarks.forEach((landmark) =>
      current.landmarks.add(landmarkKey(visit, landmark)),
    );
    accumulators.set(visit.countryCode, current);
  });

  return [...accumulators.entries()]
    .map(([code, item]) => {
      const cityCount = item.cities.size;
      const landmarkCount = item.landmarks.size;
      const hiddenScore = [...item.cityScores.values()].reduce(
        (total, score) => total + score,
        0,
      );
      return {
        code,
        name: item.name,
        cityCount,
        landmarkCount,
        hiddenScore,
        heatLevel: countryHeat(cityCount, hiddenScore),
      };
    })
    .sort(
      (left, right) =>
        right.heatLevel - left.heatLevel ||
        right.hiddenScore - left.hiddenScore ||
        right.cityCount - left.cityCount,
    );
}

function travelTypeDescription(travelType: TravelType) {
  return (
    TRAVEL_TYPE_OPTIONS.find((option) => option.value === travelType)
      ?.description ?? "到访"
  );
}

function landmarksForCity(city: CityCandidate) {
  const direct = LANDMARKS_BY_CITY[`${city.countryCode}:${city.name}`];
  if (direct) return direct;

  const namedMatch = FEATURED_CITIES.find(
    (featured) =>
      featured.countryCode === city.countryCode &&
      cityNameStem(featured.name) === cityNameStem(city.name),
  );
  const nearbyMatch = FEATURED_CITIES.filter(
    (featured) => featured.countryCode === city.countryCode,
  )
    .map((featured) => ({
      featured,
      distance:
        (featured.longitude - city.longitude) ** 2 +
        (featured.latitude - city.latitude) ** 2,
    }))
    .sort((left, right) => left.distance - right.distance)
    .find((match) => match.distance < 1.5)?.featured;
  const knownCity = namedMatch ?? nearbyMatch;
  return knownCity
    ? LANDMARKS_BY_CITY[`${knownCity.countryCode}:${knownCity.name}`] ?? []
    : [];
}

function normalizeCityResult(result: NominatimResult): CityCandidate | null {
  const address = result.address ?? {};
  const cityName =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.city_district ??
    result.name;
  const sourceCountry = address.country;
  const sourceCountryCode = address.country_code?.toUpperCase();
  if (!cityName || !sourceCountry || !sourceCountryCode) return null;
  const isTaiwan = sourceCountryCode === "TW";
  const countryCode = isTaiwan ? "CN" : sourceCountryCode;
  const country = normalizeCountryName(sourceCountry, countryCode);

  const region =
    address.state ??
    address.province ??
    address.region ??
    address.county ??
    (isTaiwan ? "台湾" : undefined);
  const geometry =
    result.geojson?.type === "Polygon" ||
    result.geojson?.type === "MultiPolygon"
      ? ({
          type: result.geojson.type,
          coordinates: result.geojson.coordinates,
        } as AtlasGeometry)
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
    subtitle: formatLocationSubtitle(region, country),
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

function landmarkCategory(tags: Record<string, string>) {
  const category = tags.tourism ?? tags.historic ?? "";
  const labels: Record<string, string> = {
    attraction: "人气景点",
    museum: "博物馆",
    gallery: "美术馆",
    viewpoint: "观景地",
    zoo: "动物园",
    theme_park: "主题乐园",
    monument: "纪念地标",
    memorial: "纪念地标",
    castle: "历史建筑",
    archaeological_site: "历史遗址",
  };
  return labels[category] ?? "城市地标";
}

function recommendationScore(
  element: OverpassElement,
  city: CityCandidate,
) {
  const tags = element.tags ?? {};
  const longitude = element.lon ?? element.center?.lon ?? city.longitude;
  const latitude = element.lat ?? element.center?.lat ?? city.latitude;
  const distance =
    (longitude - city.longitude) ** 2 + (latitude - city.latitude) ** 2;
  return (
    (tags.wikidata ? 8 : 0) +
    (tags.wikipedia ? 6 : 0) +
    (tags.tourism === "attraction" ? 3 : 0) +
    (tags.tourism === "museum" ? 2 : 0) -
    distance
  );
}

async function fetchRecommendedLandmarks(city: CityCandidate) {
  const [west, south, east, north] = city.bbox ?? [
    city.longitude - 0.18,
    city.latitude - 0.14,
    city.longitude + 0.18,
    city.latitude + 0.14,
  ];
  const bounds = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:14];
(
  nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park)$"]["name"](${bounds});
  nwr["historic"~"^(monument|memorial|castle|archaeological_site)$"]["name"](${bounds});
);
out center 80;`;
  const params = new URLSearchParams({ data: query });
  const response = await fetch(
    `https://overpass-api.de/api/interpreter?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error("Landmark recommendations failed");

  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const unique = new Map<string, LandmarkOption>();
  [...(payload.elements ?? [])]
    .sort(
      (left, right) =>
        recommendationScore(right, city) - recommendationScore(left, city),
    )
    .forEach((element) => {
      const tags = element.tags ?? {};
      const name =
        tags["name:zh-Hans"] ?? tags["name:zh"] ?? tags.name ?? "";
      const longitude = element.lon ?? element.center?.lon;
      const latitude = element.lat ?? element.center?.lat;
      if (
        !name.trim() ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude)
      ) {
        return;
      }
      const key = normalizeCityName(name).replace(/\s+/g, "");
      if (unique.has(key)) return;
      const area =
        tags["addr:district"] ??
        tags["addr:suburb"] ??
        tags["addr:quarter"];
      unique.set(key, {
        id: `landmark-osm-${element.type}-${element.id}`,
        name: name.trim(),
        subtitle: [landmarkCategory(tags), area].filter(Boolean).join(" · "),
        longitude: longitude as number,
        latitude: latitude as number,
      });
    });

  return [...unique.values()].slice(0, LANDMARK_RECOMMENDATION_LIMIT);
}

function migrateVisits(value: unknown): CityVisit[] {
  if (!Array.isArray(value)) return [];
  const legacyTravelTypes: Record<string, TravelType> = {
    "3天": "旅游",
    "5天": "旅游",
    "1个月": "短居 / 留学",
    留学: "短居 / 留学",
    常住: "常住",
  };

  return value.flatMap((item): CityVisit[] => {
    if (
      !item ||
      typeof item !== "object" ||
      !("visitId" in item) ||
      !("countryCode" in item) ||
      !("name" in item) ||
      !("longitude" in item) ||
      !("latitude" in item)
    ) {
      return [];
    }

    const stored = item as Partial<CityVisit> & {
      stayTag?: unknown;
      countryCode: string;
    };
    const requestedTravelType =
      typeof stored.travelType === "string" ? stored.travelType : "";
    const travelType = VALID_TRAVEL_TYPES.has(
      requestedTravelType as TravelType,
    )
      ? (requestedTravelType as TravelType)
      : legacyTravelTypes[String(stored.stayTag ?? "")] ?? "旅游";
    const isTaiwan = stored.countryCode.toUpperCase() === "TW";
    const countryCode = isTaiwan ? "CN" : stored.countryCode.toUpperCase();
    const country = normalizeCountryName(
      String(stored.country ?? countryCode),
      countryCode,
    );
    const region = stored.region ?? (isTaiwan ? "台湾" : undefined);

    return [
      {
        ...(stored as CityVisit),
        countryCode,
        country,
        region,
        subtitle: formatLocationSubtitle(region, country),
        travelType,
        landmarks: Array.isArray(stored.landmarks) ? stored.landmarks : [],
      },
    ];
  });
}

export default function AtlasExplorer() {
  const mapRef = useRef<StaticAtlasMapHandle | null>(null);
  const landmarkRecommendationRequest = useRef(0);
  const [visits, setVisits] = useState<CityVisit[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [scope, setScope] = useState<AtlasScope>("world");
  const [activeCountry, setActiveCountry] = useState<ActiveCountry | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CityCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [candidate, setCandidate] = useState<CityCandidate | null>(null);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [visitTravelType, setVisitTravelType] =
    useState<TravelType>("旅游");
  const [landmarksOpen, setLandmarksOpen] = useState(false);
  const [landmarkOptions, setLandmarkOptions] = useState<LandmarkOption[]>([]);
  const [landmarkRecommendationsLoading, setLandmarkRecommendationsLoading] =
    useState(false);
  const [selectedLandmarks, setSelectedLandmarks] = useState<LandmarkOption[]>(
    [],
  );
  const [landmarkQuery, setLandmarkQuery] = useState("");
  const [landmarkSearching, setLandmarkSearching] = useState(false);
  const [landmarkError, setLandmarkError] = useState("");
  const [toast, setToast] = useState("");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [countryRegions, setCountryRegions] = useState<CountryRegionMap>({
    ...COUNTRY_REGION_FALLBACKS,
  });
  const [titleLibraryOpen, setTitleLibraryOpen] = useState(false);
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [activeTitleCategory, setActiveTitleCategory] = useState<
    "all" | RoamingTitleCategoryId
  >("all");
  const [selectedTitleIds, setSelectedTitleIds] = useState<ScopedTitleIds>({
    world: null,
    china: null,
  });

  const countryMetrics = useMemo(() => buildCountryMetrics(visits), [visits]);
  const evaluatedTitles = useMemo(
    () => evaluateRoamingTitles(visits, countryRegions),
    [countryRegions, visits],
  );
  const scopeTitles = useMemo(
    () =>
      evaluatedTitles.filter((title) =>
        scope === "china"
          ? title.category === "china"
          : title.category !== "china",
      ),
    [evaluatedTitles, scope],
  );
  const unlockedTitles = useMemo(
    () => scopeTitles.filter((title) => title.unlocked),
    [scopeTitles],
  );
  const recommendedTitle = useMemo(
    () => recommendedRoamingTitle(scopeTitles),
    [scopeTitles],
  );
  const selectedTitleId = selectedTitleIds[scope];
  const selectedTitle = useMemo(
    () =>
      scopeTitles.find(
        (title) => title.id === selectedTitleId && title.unlocked,
      ),
    [scopeTitles, selectedTitleId],
  );
  const roamingBadge = selectedTitle ?? recommendedTitle ?? scopeTitles[0];
  const visibleTitles = useMemo(
    () =>
      scopeTitles
        .filter(
          (title) =>
            activeTitleCategory === "all" ||
            title.category === activeTitleCategory,
        )
        .sort(
          (left, right) =>
            Number(right.unlocked) - Number(left.unlocked) ||
            right.progress - left.progress ||
            right.priority - left.priority,
        ),
    [activeTitleCategory, scopeTitles],
  );
  const availableTitleCategories = useMemo(
    () =>
      ROAMING_TITLE_CATEGORIES.filter((category) =>
        scope === "china" ? category.id === "china" : category.id !== "china",
      ),
    [scope],
  );
  const chinaVisits = useMemo(
    () => visits.filter((visit) => visit.countryCode === "CN"),
    [visits],
  );
  const chinaProvinceCount = useMemo(
    () =>
      new Set(
        chinaVisits.map(chinaProvinceKey).filter(Boolean),
      ).size,
    [chinaVisits],
  );
  const metricByCode = useMemo(
    () => new Map(countryMetrics.map((metric) => [metric.code, metric])),
    [countryMetrics],
  );

  const worldStats = useMemo(() => {
    const cities = new Set(visits.map(cityKey));
    const landmarks = new Set(
      visits.flatMap((visit) =>
        visit.landmarks.map((landmark) => landmarkKey(visit, landmark)),
      ),
    );
    return {
      countries: countryMetrics.length,
      cities: cities.size,
      landmarks: landmarks.size,
      visits: visits.length,
    };
  }, [countryMetrics.length, visits]);
  const chinaStats = useMemo(() => {
    const cities = new Set(chinaVisits.map(cityKey));
    const landmarks = new Set(
      chinaVisits.flatMap((visit) =>
        visit.landmarks.map((landmark) => landmarkKey(visit, landmark)),
      ),
    );
    return {
      provinces: chinaProvinceCount,
      cities: cities.size,
      landmarks: landmarks.size,
      visits: chinaVisits.length,
    };
  }, [chinaProvinceCount, chinaVisits]);
  const scopeVisits = scope === "china" ? chinaVisits : visits;
  const scopeCoverage =
    scope === "china"
      ? formatCoveragePercent(chinaProvinceCount, CHINA_PROVINCE_TOTAL)
      : formatCoveragePercent(worldStats.countries, WORLD_COUNTRY_TOTAL);
  const scopeStatRows: Array<[number, string]> =
    scope === "china"
      ? [
          [chinaStats.provinces, "省级"],
          [chinaStats.cities, "城市"],
          [chinaStats.landmarks, "景点"],
          [chinaStats.visits, "到访"],
        ]
      : [
          [worldStats.countries, "国家"],
          [worldStats.cities, "城市"],
          [worldStats.landmarks, "景点"],
          [worldStats.visits, "到访"],
        ];

  const selectedDateParts = useMemo(() => dateParts(visitDate), [visitDate]);
  const todayParts = useMemo(() => dateParts(todayISO()), []);
  const yearOptions = useMemo(
    () =>
      Array.from(
        { length: todayParts.year - EARLIEST_VISIT_YEAR + 1 },
        (_, index) => todayParts.year - index,
      ),
    [todayParts.year],
  );
  const maximumMonth =
    selectedDateParts.year === todayParts.year ? todayParts.month : 12;
  const maximumDay = Math.min(
    daysInMonth(selectedDateParts.year, selectedDateParts.month),
    selectedDateParts.year === todayParts.year &&
      selectedDateParts.month === todayParts.month
      ? todayParts.day
      : Number.POSITIVE_INFINITY,
  );

  const visitGroups = useMemo<VisitGroup[]>(() => {
    if (scope === "world") {
      return countryMetrics.map((metric) => ({
        id: metric.code,
        label: metric.name,
        meta: `${metric.cityCount} 城 · ${metric.landmarkCount} 景点`,
        heatLevel: metric.heatLevel,
        visits: visits
          .filter((visit) => visit.countryCode === metric.code)
          .sort((left, right) => right.visitedOn.localeCompare(left.visitedOn)),
        country: { code: metric.code, name: metric.name },
      }));
    }

    const grouped = new Map<string, CityVisit[]>();
    chinaVisits.forEach((visit) => {
      const province = chinaProvinceKey(visit) || visit.region || "其他地区";
      grouped.set(province, [...(grouped.get(province) ?? []), visit]);
    });
    return [...grouped.entries()]
      .map(([province, provinceVisits]) => {
        const cityCount = new Set(provinceVisits.map(cityKey)).size;
        const landmarkCount = new Set(
          provinceVisits.flatMap((visit) =>
            visit.landmarks.map((landmark) => landmarkKey(visit, landmark)),
          ),
        ).size;
        const hiddenScore = provinceVisits.reduce(
          (total, visit) => total + travelTypeScore(visit.travelType),
          0,
        );
        return {
          id: `CN:${province}`,
          label: province,
          meta: `${cityCount} 城 · ${landmarkCount} 景点`,
          heatLevel: countryHeat(cityCount, hiddenScore),
          visits: [...provinceVisits].sort((left, right) =>
            right.visitedOn.localeCompare(left.visitedOn),
          ),
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  }, [chinaVisits, countryMetrics, scope, visits]);

  const scopeCountryMetrics = useMemo(
    () => buildCountryMetrics(scopeVisits),
    [scopeVisits],
  );

  const activeMetric = activeCountry
    ? metricByCode.get(activeCountry.code)
    : undefined;

  const showToast = useCallback((message: string) => setToast(message), []);

  const selectCountry = useCallback((country: ActiveCountry) => {
    const nextScope: AtlasScope =
      country.code.toUpperCase() === "CN" ? "china" : "world";
    landmarkRecommendationRequest.current += 1;
    setLandmarkRecommendationsLoading(false);
    setScope(nextScope);
    setActiveTitleCategory(nextScope === "china" ? "china" : "all");
    setActiveCountry({
      code: country.code,
      name: normalizeCountryName(country.name, country.code),
    });
    setCandidate(null);
    setEditingVisitId(null);
    setSearchResults([]);
    setSearchError("");
  }, []);

  const loadLandmarkRecommendations = useCallback(
    async (city: CityCandidate, seeded: LandmarkOption[]) => {
      const requestId = ++landmarkRecommendationRequest.current;
      setLandmarkRecommendationsLoading(true);
      try {
        const discovered = await fetchRecommendedLandmarks(city);
        if (requestId !== landmarkRecommendationRequest.current) return;
        setLandmarkOptions((current) => {
          const merged = new Map<string, LandmarkOption>();
          [...current, ...seeded, ...discovered].forEach((landmark) => {
            const key = normalizeCityName(landmark.name).replace(/\s+/g, "");
            if (!merged.has(key)) merged.set(key, landmark);
          });
          return [...merged.values()].slice(
            0,
            LANDMARK_RECOMMENDATION_LIMIT,
          );
        });
      } catch {
        // Curated recommendations and manual search remain available offline.
      } finally {
        if (requestId === landmarkRecommendationRequest.current) {
          setLandmarkRecommendationsLoading(false);
        }
      }
    },
    [],
  );

  const selectCityCandidate = useCallback(
    (city: CityCandidate) => {
      const country = normalizeCountryName(city.country, city.countryCode);
      const normalizedCity = {
        ...city,
        country,
        subtitle: formatLocationSubtitle(city.region, country),
      };
      const seeded = landmarksForCity(normalizedCity);
      const nextScope: AtlasScope =
        city.countryCode === "CN" ? "china" : "world";
      setCandidate(normalizedCity);
      setEditingVisitId(null);
      setScope(nextScope);
      setActiveTitleCategory(nextScope === "china" ? "china" : "all");
      setActiveCountry({ code: city.countryCode, name: country });
      setVisitDate(todayISO());
      setVisitTravelType("旅游");
      setLandmarkOptions(seeded);
      setSelectedLandmarks([]);
      setLandmarkQuery("");
      setLandmarkError("");
      setLandmarksOpen(true);
      setSearchResults([]);
      setSearchError("");
      void loadLandmarkRecommendations(normalizedCity, seeded);
    },
    [loadLandmarkRecommendations],
  );

  const openVisitEditor = useCallback(
    (visit: CityVisit) => {
      const country = normalizeCountryName(visit.country, visit.countryCode);
      const normalizedVisit = {
        ...visit,
        country,
        subtitle: formatLocationSubtitle(visit.region, country),
      };
      const recommendations = landmarksForCity(normalizedVisit);
      const mergedLandmarks = new Map(
        [...recommendations, ...visit.landmarks].map((landmark) => [
          landmark.id,
          landmark,
        ]),
      );
      const seeded = [...mergedLandmarks.values()];
      const nextScope: AtlasScope =
        visit.countryCode === "CN" ? "china" : "world";
      setCandidate(normalizedVisit);
      setEditingVisitId(visit.visitId);
      setScope(nextScope);
      setActiveTitleCategory(nextScope === "china" ? "china" : "all");
      setActiveCountry({ code: visit.countryCode, name: country });
      setVisitDate(visit.visitedOn);
      setVisitTravelType(visit.travelType);
      setLandmarkOptions(seeded);
      setSelectedLandmarks(visit.landmarks);
      setLandmarkQuery("");
      setLandmarkError("");
      setLandmarksOpen(true);
      setSearchResults([]);
      setSearchError("");
      void loadLandmarkRecommendations(normalizedVisit, seeded);
    },
    [loadLandmarkRecommendations],
  );

  const openCity = useCallback(
    (city: CityCandidate) => {
      selectCityCandidate(city);
      window.requestAnimationFrame(() =>
        mapRef.current?.focusCountry(city.countryCode),
      );
    },
    [selectCityCandidate],
  );

  useEffect(() => {
    let savedVisits: CityVisit[] = [];
    let savedTitleIds: ScopedTitleIds = { world: null, china: null };
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) savedVisits = migrateVisits(JSON.parse(saved));
      const savedScopedTitles = window.localStorage.getItem(
        SCOPED_TITLE_STORAGE_KEY,
      );
      if (savedScopedTitles) {
        const parsed = JSON.parse(savedScopedTitles) as Partial<ScopedTitleIds>;
        savedTitleIds = {
          world: typeof parsed.world === "string" ? parsed.world : null,
          china: typeof parsed.china === "string" ? parsed.china : null,
        };
      } else {
        const legacyTitleId = window.localStorage.getItem(TITLE_STORAGE_KEY);
        const legacyTitle = ROAMING_TITLES.find(
          (title) => title.id === legacyTitleId,
        );
        if (legacyTitleId) {
          savedTitleIds[
            legacyTitle?.category === "china" ? "china" : "world"
          ] = legacyTitleId;
        }
      }
    } catch {
      // Device-local history is helpful, but the atlas must load without it.
    }

    const hydrationTimer = window.setTimeout(() => {
      setVisits(savedVisits);
      setSelectedTitleIds(savedTitleIds);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world-countries.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("Country regions unavailable");
        return response.json() as Promise<CountryRegionCollection>;
      })
      .then((collection) => {
        if (cancelled) return;
        const regions: CountryRegionMap = {
          ...COUNTRY_REGION_FALLBACKS,
        };
        collection.features?.forEach((feature) => {
          const properties = feature.properties;
          const code = String(
            properties?.ISO_A2_EH ?? properties?.ISO_A2 ?? "",
          ).toUpperCase();
          const continent = String(properties?.CONTINENT ?? "");
          const subregion = String(properties?.SUBREGION ?? "");
          if (!code || code === "-99" || !continent) return;
          regions[code] = { continent, subregion };
        });
        if (regions.CN) regions.TW = regions.CN;
        setCountryRegions(regions);
      })
      .catch(() => {
        if (!cancelled) {
          setCountryRegions({ ...COUNTRY_REGION_FALLBACKS });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch {
      // The atlas remains usable without local persistence.
    }
  }, [hydrated, visits]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        SCOPED_TITLE_STORAGE_KEY,
        JSON.stringify(selectedTitleIds),
      );
    } catch {
      // Choosing a title still works for the current session.
    }
  }, [hydrated, selectedTitleIds]);

  useEffect(() => {
    if (!titleLibraryOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setTitleLibraryOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [titleLibraryOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
        params.set(
          "countrycodes",
          activeCountry.code === "CN"
            ? "cn,tw"
            : activeCountry.code.toLowerCase(),
        );
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
        if (city) unique.set(cityKey(city), city);
      });
      const normalized = [...unique.values()].slice(0, 6);
      setSearchResults(normalized);
      if (normalized.length === 0) {
        setSearchError("没有找到城市，换个名字再搜一次吧。");
      }
    } catch {
      setSearchError("城市搜索暂时走丢了，请稍后再试。");
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
      const merged = new Map(
        [...landmarkOptions, ...results.map(normalizeLandmarkResult)].map(
          (item) => [item.id, item],
        ),
      );
      setLandmarkOptions([...merged.values()]);
      if (results.length === 0) {
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

  function updateVisitDate(
    part: "year" | "month" | "day",
    value: number,
  ) {
    let { year, month, day } = selectedDateParts;
    if (part === "year") year = value;
    if (part === "month") month = value;
    if (part === "day") day = value;

    const allowedMonth = year === todayParts.year ? todayParts.month : 12;
    month = clampNumber(month, 1, allowedMonth);
    const allowedDay = Math.min(
      daysInMonth(year, month),
      year === todayParts.year && month === todayParts.month
        ? todayParts.day
        : Number.POSITIVE_INFINITY,
    );
    day = clampNumber(day, 1, allowedDay);
    setVisitDate(makeISODate(year, month, day));
  }

  function closeComposer() {
    landmarkRecommendationRequest.current += 1;
    setLandmarkRecommendationsLoading(false);
    setCandidate(null);
    setEditingVisitId(null);
    setSelectedLandmarks([]);
    setLandmarkOptions([]);
    setLandmarkQuery("");
    setLandmarkError("");
  }

  function saveCandidateVisit() {
    if (!candidate) return;
    if (!visitDate) {
      showToast("请选择到访日期");
      return;
    }
    const duplicate = visits.some(
      (visit) =>
        visit.visitId !== editingVisitId &&
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
      visitId:
        editingVisitId ?? `${candidate.id}-${visitDate}-${Date.now()}`,
      visitedOn: visitDate,
      travelType: visitTravelType,
      landmarks: selectedLandmarks,
    };
    setVisits((current) =>
      editingVisitId
        ? current.map((item) =>
            item.visitId === editingVisitId ? visit : item,
          )
        : [...current, visit],
    );
    const wasEditing = Boolean(editingVisitId);
    closeComposer();
    setQuery("");
    showToast(
      wasEditing
        ? `已更新 ${candidate.country} · ${candidate.name}`
        : `已记录 ${candidate.country} · ${candidate.name}`,
    );
  }

  function removeVisit(visitId: string) {
    setVisits((current) =>
      current.filter((visit) => visit.visitId !== visitId),
    );
    if (editingVisitId === visitId) closeComposer();
    showToast("已移除这次城市记录");
  }

  function selectScope(nextScope: AtlasScope) {
    landmarkRecommendationRequest.current += 1;
    setLandmarkRecommendationsLoading(false);
    setScope(nextScope);
    setActiveTitleCategory(nextScope === "china" ? "china" : "all");
    setTitleLibraryOpen(false);
    setAlmanacOpen(false);
    setActiveCountry(
      nextScope === "china" ? { code: "CN", name: "中国" } : null,
    );
    closeComposer();
    setQuery("");
    setSearchResults([]);
    setSearchError("");
    window.requestAnimationFrame(() => {
      if (nextScope === "china") {
        mapRef.current?.focusCountry("CN");
      } else {
        mapRef.current?.reset();
      }
    });
  }

  function resetWorldView() {
    selectScope("world");
  }

  function showAllFootprints() {
    closeComposer();
    if (scope === "china") {
      setActiveCountry({ code: "CN", name: "中国" });
      window.requestAnimationFrame(() => mapRef.current?.focusCountry("CN"));
    } else {
      setActiveCountry(null);
      mapRef.current?.reset();
    }
  }

  function openTitleLibrary() {
    closeComposer();
    setActiveTitleCategory(scope === "china" ? "china" : "all");
    setTitleLibraryOpen(true);
  }

  function openAlmanac() {
    if (scopeVisits.length === 0) return;
    closeComposer();
    setTitleLibraryOpen(false);
    setMobilePanelOpen(false);
    setAlmanacOpen(true);
  }

  function choosePrimaryTitle(titleId: string, title: string) {
    setSelectedTitleIds((current) => ({ ...current, [scope]: titleId }));
    showToast(
      `已把「${title}」设为${scope === "china" ? "中国" : "全球"}主成就`,
    );
  }

  return (
    <main className="atlas-v2-shell" data-scope={scope}>
      <StaticAtlasMap
        ref={mapRef}
        visits={visits}
        activeCountry={activeCountry}
        candidate={candidate}
        featuredCities={FEATURED_CITIES}
        countryMetrics={countryMetrics}
        onCountrySelect={selectCountry}
        onCityOpen={openCity}
        onCityEdit={openVisitEditor}
      />

      {activeCountry ? (
        <button
          type="button"
          className="atlas-v2-world-back"
          onClick={resetWorldView}
        >
          <span className="atlas-v2-world-back-icon">
            <ArrowLeft size={19} />
          </span>
          <span>
            <strong>返回全球</strong>
            <small>
              {scope === "china"
                ? "离开中国维度"
                : `离开 ${activeCountry.name}`}
            </small>
          </span>
        </button>
      ) : null}

      <header className="atlas-v2-header">
        <button
          type="button"
          className="atlas-v2-brand"
          onClick={() => selectScope("world")}
          aria-label="返回全球足迹"
        >
          <span className="atlas-v2-brand-mark">
            <Compass size={18} strokeWidth={2.2} />
          </span>
          <span className="atlas-v2-brand-copy">
            <strong>晃悠</strong>
            <small>WANDER WIDE</small>
          </span>
        </button>

        <nav className="atlas-v2-scope-tabs" aria-label="足迹维度">
          <button
            type="button"
            className={scope === "world" ? "is-active" : ""}
            aria-pressed={scope === "world"}
            onClick={() => selectScope("world")}
          >
            全球
          </button>
          <button
            type="button"
            className={scope === "china" ? "is-active" : ""}
            aria-pressed={scope === "china"}
            onClick={() => selectScope("china")}
          >
            中国
          </button>
        </nav>

        <button
          type="button"
          className="atlas-v2-mobile-footprints"
          onClick={() => setMobilePanelOpen((current) => !current)}
          aria-expanded={mobilePanelOpen}
          aria-label="打开足迹信息"
        >
          <MapPin size={16} />
          {scopeVisits.length}
        </button>
      </header>

      <section className="atlas-v2-search-wrap" aria-label="城市搜索">
        <form className="atlas-v2-search" onSubmit={handleCitySearch}>
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchError("");
            }}
            placeholder={
              scope === "china"
                ? "搜索中国城市，例如：上海、成都"
                : activeCountry
                ? `在${activeCountry.name}搜索城市`
                : "搜索城市，例如：上海、巴黎"
            }
            aria-label="搜索城市"
          />
          {query && !searching ? (
            <button
              type="button"
              className="atlas-v2-icon-button"
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
            className="atlas-v2-search-submit"
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
          <div className="atlas-v2-search-results">
            {searchError ? (
              <p>{searchError}</p>
            ) : (
              <>
                <header>
                  <span>城市结果</span>
                  <small>选一座，继续补全记录</small>
                </header>
                {searchResults.map((city) => (
                  <button
                    type="button"
                    key={city.id}
                    onClick={() => openCity(city)}
                  >
                    <span className="atlas-v2-result-icon">
                      <Building2 size={16} />
                    </span>
                    <span>
                      <strong>{city.name}</strong>
                      <small>{city.subtitle}</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </>
            )}
            <footer>城市与地标搜索 © OpenStreetMap contributors</footer>
          </div>
        )}
      </section>

      {scope === "world" && !activeCountry ? (
        <nav className="atlas-v2-breadcrumb" aria-label="地图位置">
          <strong>全球</strong>
          <span>国家地图</span>
        </nav>
      ) : null}

      <aside
        className={`atlas-v2-panel ${mobilePanelOpen ? "is-open" : ""}`}
      >
        <div className="atlas-v2-panel-handle" aria-hidden="true" />
        <div className="atlas-v2-panel-intro">
          <span className="atlas-v2-eyebrow">
            {scope === "china" ? "中国足迹" : "全球足迹"}
          </span>
          <h1>
            {scope === "china" ? "大江南北，咱晃过。" : "这地球，咱晃过。"}
          </h1>
        </div>

        <section
          className={`atlas-v2-roaming-badge tone-${roamingBadge.tone}`}
          aria-label={`当前成就：${roamingBadge.title}`}
        >
          <span className="atlas-v2-roaming-badge-icon">
            <Award size={18} />
          </span>
          <span>
            <small>成就</small>
            <strong>{roamingBadge.title}</strong>
          </span>
          <p>{roamingBadge.description}</p>
          <div
            className="atlas-v2-roaming-progress"
            aria-label={`${scope === "china" ? "中国" : "全球"}进度 ${scopeCoverage}`}
          >
            <span>
              <small>{scope === "china" ? "中国进度" : "全球进度"}</small>
              <b>
                {scope === "china"
                  ? `${chinaProvinceCount} / ${CHINA_PROVINCE_TOTAL} 省级 · ${chinaStats.cities} 城市`
                  : `${worldStats.countries} / ${WORLD_COUNTRY_TOTAL} 国家 · ${worldStats.cities} 城市`}
              </b>
            </span>
            <strong>{scopeCoverage}</strong>
          </div>
          <button
            type="button"
            className="atlas-v2-title-library-link"
            onClick={openTitleLibrary}
          >
            <BookOpen size={13} />
            查看全部成就
            <b>
              {unlockedTitles.length} / {scopeTitles.length}
            </b>
            <ChevronRight size={13} />
          </button>
        </section>

        <section
          className="atlas-v2-stats-section"
          aria-labelledby="atlas-v2-stats-heading"
        >
          <span className="atlas-v2-section-kicker" id="atlas-v2-stats-heading">
            足迹数据
          </span>
          <div className="atlas-v2-stats" aria-label="足迹统计">
            {scopeStatRows.map(([value, label]) => (
              <div key={label}>
                <strong>{String(value).padStart(2, "0")}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {scope === "world" && activeCountry ? (
          <section
            className={`atlas-v2-active-country heat-${activeMetric?.heatLevel ?? 0}`}
            aria-label={`${activeCountry.name}概览`}
          >
            <div className="atlas-v2-country-emblem">
              <Globe2 size={18} />
            </div>
            <div>
              <small>正在晃悠</small>
              <strong>{activeCountry.name}</strong>
              <span>
                {activeMetric
                  ? `${activeMetric.cityCount} 座城市 · ${activeMetric.landmarkCount} 个景点`
                  : "尚未记录城市"}
              </span>
            </div>
          </section>
        ) : null}

        <section className="atlas-v2-panel-section">
          <div className="atlas-v2-section-title">
            <div>
              <span>打卡记录</span>
              <small>
                {scope === "china" ? "中国 · " : "全球 · "}
                {scopeVisits.length} 次到访
              </small>
            </div>
            {scopeVisits.length > 0 ? (
              <button type="button" onClick={showAllFootprints}>
                <LocateFixed size={15} />
                {scope === "china" ? "中国总览" : "全球总览"}
              </button>
            ) : null}
          </div>

          {scopeVisits.length === 0 ? (
            <div className="atlas-v2-empty">
              <div className="atlas-v2-empty-orbit">
                <Globe2 size={26} />
                <span />
              </div>
              <strong>
                {scope === "china"
                  ? "先记录一座中国城市"
                  : "先随便晃一座城市"}
              </strong>
              <p>选日期与到访方式，我们会顺手推荐景点。</p>
              <div className="atlas-v2-suggestions">
                {FEATURED_CITIES.filter(
                  (city) => scope === "world" || city.countryCode === "CN",
                )
                  .slice(0, 4)
                  .map((city) => (
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
            <div className="atlas-v2-country-groups">
              {visitGroups.map((group) => (
                <section
                  key={group.id}
                  className={`atlas-v2-country-group heat-${group.heatLevel}`}
                >
                  {group.country ? (
                    <button
                      type="button"
                      className="atlas-v2-country-group-head"
                      onClick={() => selectCountry(group.country!)}
                    >
                      <span className="atlas-v2-heat-swatch" />
                      <span>
                        <strong>{group.label}</strong>
                        <small>{group.meta}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ) : (
                    <div className="atlas-v2-country-group-head is-static">
                      <span className="atlas-v2-heat-swatch" />
                      <span>
                        <strong>{group.label}</strong>
                        <small>{group.meta}</small>
                      </span>
                      <MapPin size={14} />
                    </div>
                  )}

                  <ol>
                    {group.visits.map((visit, index) => (
                      <li key={visit.visitId}>
                        <button
                          type="button"
                          className="atlas-v2-visit-main"
                          onClick={() => openVisitEditor(visit)}
                          aria-label={`修改 ${visit.name} 的到访记录`}
                        >
                          <span className="atlas-v2-visit-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="atlas-v2-visit-copy">
                            <strong>{visit.name}</strong>
                            <small>
                              {formatVisitDate(visit.visitedOn)} ·{" "}
                              {travelTypeDescription(visit.travelType)}
                            </small>
                          </span>
                          <span className="atlas-v2-travel-tag">
                            {visit.travelType}
                          </span>
                          <span
                            className="atlas-v2-landmark-count"
                            aria-label={`${visit.landmarks.length}个景点`}
                          >
                            <Landmark size={12} />
                            {visit.landmarks.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="atlas-v2-remove"
                          onClick={() => removeVisit(visit.visitId)}
                          aria-label={`移除 ${visit.name} 的到访记录`}
                        >
                          <X size={14} />
                        </button>
                        <div className="atlas-v2-visit-details">
                          <span>
                            <Landmark size={12} />
                            {visit.landmarks.length
                              ? visit.landmarks
                                  .map((landmark) => landmark.name)
                                  .join(" · ")
                              : "仅记录城市"}
                          </span>
                          <span className="atlas-v2-edit-cue">
                            <Pencil size={11} />
                            修改
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </section>

        <div className="atlas-v2-panel-footer">
          <button
            type="button"
            className="atlas-v2-next-button"
            disabled={scopeVisits.length === 0}
            onClick={openAlmanac}
          >
            {scope === "china" ? "生成中国打卡地图" : "生成世界打卡地图"}
            <ArrowRight size={17} />
          </button>
        </div>
      </aside>

      <div className="atlas-v2-map-tools">
        <button
          type="button"
          onClick={() => mapRef.current?.reset()}
          aria-label="重置当前地图视野"
        >
          <RotateCcw size={17} />
        </button>
        <span />
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="放大静态地图"
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="缩小静态地图"
        >
          <Minus size={17} />
        </button>
      </div>

      <div
        className="atlas-v2-map-legend"
        aria-label="国家熟度图例，悬停或聚焦查看说明"
        tabIndex={0}
      >
        <b>熟度</b>
        <span className="atlas-v2-heat-scale" aria-hidden="true">
          <i className="heat-1" />
          <i className="heat-2" />
          <i className="heat-3" />
          <i className="heat-4" />
        </span>
        <div className="atlas-v2-heat-details">
          <p>颜色越深，代表你在这个国家留下的足迹越丰富。</p>
          <div className="atlas-v2-heat-key">
            <span>
              <i className="heat-1" />
              <strong>三分熟</strong>
              <small>足迹刚刚点亮</small>
            </span>
            <span>
              <i className="heat-2" />
              <strong>五分熟</strong>
              <small>去过不止一处</small>
            </span>
            <span>
              <i className="heat-3" />
              <strong>七分熟</strong>
              <small>多城或深度停留</small>
            </span>
            <span>
              <i className="heat-4" />
              <strong>全熟</strong>
              <small>高频到访或长期生活</small>
            </span>
          </div>
        </div>
      </div>

      {titleLibraryOpen ? (
        <div
          className="atlas-v2-title-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTitleLibraryOpen(false);
            }
          }}
        >
          <section
            className="atlas-v2-title-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="roaming-title-library-heading"
          >
            <header className="atlas-v2-title-dialog-header">
              <div>
                <span>
                  <Sparkles size={14} />
                  {scope === "china"
                    ? "CHINA ACHIEVEMENTS"
                    : "WORLD ACHIEVEMENTS"}
                </span>
                <h2 id="roaming-title-library-heading">
                  {scope === "china" ? "中国成就册" : "全球成就册"}
                </h2>
                <p>
                  {scope === "china"
                    ? "按省级足迹解锁中国成就，并单独选择中国主成就。"
                    : "按全球足迹解锁成就，并单独选择全球主成就。"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTitleLibraryOpen(false)}
                aria-label={`关闭${scope === "china" ? "中国" : "全球"}成就册`}
              >
                <X size={18} />
              </button>
            </header>

            <div
              className={`atlas-v2-title-hero tone-${roamingBadge.tone}`}
            >
              <span className="atlas-v2-title-hero-icon">
                <Award size={24} />
              </span>
              <div>
                <small>
                  {selectedTitle ? "你选择的主成就" : "系统推荐主成就"}
                </small>
                <strong>{roamingBadge.title}</strong>
                <p>{roamingBadge.description}</p>
              </div>
              <div className="atlas-v2-title-unlock-count">
                <strong>{String(unlockedTitles.length).padStart(2, "0")}</strong>
                <span>
                  已解锁
                  <small>共 {scopeTitles.length} 枚</small>
                </span>
              </div>
            </div>

            <nav
              className="atlas-v2-title-categories"
              aria-label="成就分类"
            >
              {scope === "world" ? (
                <button
                  type="button"
                  className={activeTitleCategory === "all" ? "is-active" : ""}
                  aria-pressed={activeTitleCategory === "all"}
                  onClick={() => setActiveTitleCategory("all")}
                >
                  全部
                  <b>{scopeTitles.length}</b>
                </button>
              ) : null}
              {availableTitleCategories.map((category) => {
                const categoryTitles = scopeTitles.filter(
                  (title) => title.category === category.id,
                );
                const unlockedCount = categoryTitles.filter(
                  (title) => title.unlocked,
                ).length;
                return (
                  <button
                    type="button"
                    key={category.id}
                    className={
                      activeTitleCategory === category.id ? "is-active" : ""
                    }
                    aria-pressed={activeTitleCategory === category.id}
                    onClick={() => setActiveTitleCategory(category.id)}
                    title={category.description}
                  >
                    {category.label}
                    <b>
                      {unlockedCount}/{categoryTitles.length}
                    </b>
                  </button>
                );
              })}
            </nav>

            <div className="atlas-v2-title-grid">
              {visibleTitles.map((title) => {
                const category = ROAMING_TITLE_CATEGORIES.find(
                  (item) => item.id === title.category,
                );
                const isPrimary = roamingBadge.id === title.id;
                return (
                  <article
                    key={title.id}
                    className={[
                      "atlas-v2-title-card",
                      `tone-${title.tone}`,
                      title.unlocked ? "is-unlocked" : "is-locked",
                      isPrimary ? "is-primary" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="atlas-v2-title-card-head">
                      <span>
                        {title.unlocked ? (
                          <Award size={16} />
                        ) : (
                          <Lock size={14} />
                        )}
                      </span>
                      <small>{category?.label}</small>
                      {isPrimary ? <b>主成就</b> : null}
                    </div>
                    <strong>{title.title}</strong>
                    <p>{title.description}</p>
                    {title.unlocked ? (
                      <button
                        type="button"
                        disabled={isPrimary}
                        onClick={() =>
                          choosePrimaryTitle(title.id, title.title)
                        }
                      >
                      {isPrimary ? (
                        <>
                          <Check size={13} />
                          当前主成就
                        </>
                      ) : (
                        <>
                          <Star size={13} />
                          设为主成就
                        </>
                        )}
                      </button>
                    ) : (
                      <div className="atlas-v2-title-progress-wrap">
                        <div className="atlas-v2-title-progress">
                          <span
                            style={{
                              width: `${Math.max(4, title.progress * 100)}%`,
                            }}
                          />
                        </div>
                        <small>{title.progressLabel}</small>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <footer className="atlas-v2-title-dialog-footer">
              <span>
                <BookOpen size={13} />
                {scope === "china"
                  ? "中国成就随省级足迹自动解锁。"
                  : "全球成就随足迹自动解锁，不做排名。"}
              </span>
              <span>两个维度的主成就互不覆盖。</span>
            </footer>
          </section>
        </div>
      ) : null}

      {almanacOpen ? (
        <WanderAlmanac
          dimension={scope}
          visits={scopeVisits}
          countryMetrics={scopeCountryMetrics}
          countryRegions={countryRegions}
          primaryTitle={roamingBadge}
          unlockedTitles={unlockedTitles}
          onClose={() => setAlmanacOpen(false)}
          onNotice={showToast}
        />
      ) : null}

      {candidate ? (
        <section
          className="atlas-v2-composer"
          aria-label={editingVisitId ? "修改城市到访" : "添加城市到访"}
        >
          <header>
            <span className="atlas-v2-candidate-icon">
              <Building2 size={19} />
            </span>
            <div>
              <small>
                {editingVisitId
                  ? "修改这次晃悠"
                  : "添加城市到访"}
              </small>
              <h2>{candidate.name}</h2>
              <p>{candidate.subtitle}</p>
            </div>
            <button
              type="button"
              className="atlas-v2-icon-button"
              onClick={closeComposer}
              aria-label="关闭城市编辑面板"
            >
              <X size={17} />
            </button>
          </header>

          <div className="atlas-v2-date-field">
            <span>
              <CalendarDays size={15} />
              到访日期
            </span>
            <div className="atlas-v2-date-selects">
              <label>
                <small>年</small>
                <select
                  value={selectedDateParts.year}
                  aria-label="到访年份"
                  onChange={(event) =>
                    updateVisitDate("year", Number(event.target.value))
                  }
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year} 年
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <small>月</small>
                <select
                  value={selectedDateParts.month}
                  aria-label="到访月份"
                  onChange={(event) =>
                    updateVisitDate("month", Number(event.target.value))
                  }
                >
                  {Array.from({ length: maximumMonth }, (_, index) => index + 1).map(
                    (month) => (
                      <option key={month} value={month}>
                        {month} 月
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <small>日</small>
                <select
                  value={selectedDateParts.day}
                  aria-label="到访日期"
                  onChange={(event) =>
                    updateVisitDate("day", Number(event.target.value))
                  }
                >
                  {Array.from({ length: maximumDay }, (_, index) => index + 1).map(
                    (day) => (
                      <option key={day} value={day}>
                        {day} 日
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </div>

          <fieldset className="atlas-v2-travel-picker">
            <legend>
              <MapPin size={15} />
              怎么晃的
            </legend>
            <div>
              {TRAVEL_TYPE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={
                    visitTravelType === option.value ? "is-selected" : ""
                  }
                  aria-pressed={visitTravelType === option.value}
                  onClick={() => setVisitTravelType(option.value)}
                  title={option.description}
                >
                  <strong>{option.label}</strong>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="atlas-v2-landmark-picker">
            <button
              type="button"
              className="atlas-v2-landmark-toggle"
              onClick={() => setLandmarksOpen((current) => !current)}
              aria-expanded={landmarksOpen}
            >
              <span>
                <Landmark size={15} />
                为你推荐
                <small>
                  {landmarkRecommendationsLoading
                    ? `正在搜罗${candidate.name}的好去处…`
                    : selectedLandmarks.length
                    ? `已选 ${selectedLandmarks.length} 个`
                    : landmarkOptions.length
                      ? `${landmarkOptions.length} 个推荐，可多选`
                      : "也可以自己搜索"}
                </small>
              </span>
              <ChevronDown
                size={16}
                className={landmarksOpen ? "is-open" : ""}
              />
            </button>

            {landmarksOpen ? (
              <div className="atlas-v2-landmark-body">
                <p className="atlas-v2-landmark-helper">
                  点「＋」加入足迹；没有想要的，可以在下方直接搜索。
                </p>
                {landmarkOptions.length > 0 ? (
                  <div className="atlas-v2-landmark-options">
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
                ) : landmarkRecommendationsLoading ? (
                  <p className="atlas-v2-landmark-loading">
                    <LoaderCircle className="spinning" size={13} />
                    正在为你整理这座城市的推荐景点…
                  </p>
                ) : (
                  <p>暂时没捞到推荐，试试搜索建筑、博物馆或公园。</p>
                )}

                <form
                  className="atlas-v2-landmark-search"
                  onSubmit={handleLandmarkSearch}
                >
                  <Search size={14} />
                  <input
                    value={landmarkQuery}
                    onChange={(event) => {
                      setLandmarkQuery(event.target.value);
                      setLandmarkError("");
                    }}
                    placeholder={`搜索${candidate.name}的地点`}
                    aria-label={`搜索${candidate.name}的地点`}
                  />
                  <button type="submit" disabled={landmarkSearching}>
                    {landmarkSearching ? (
                      <LoaderCircle className="spinning" size={14} />
                    ) : (
                      "搜索"
                    )}
                  </button>
                </form>
                {landmarkError ? <p>{landmarkError}</p> : null}
                <small className="atlas-v2-landmark-source">
                  自动推荐与搜索 © OpenStreetMap contributors
                </small>
              </div>
            ) : null}
          </div>

          <footer>
            <button
              type="button"
              className="primary"
              onClick={saveCandidateVisit}
            >
              <Check size={16} />
              {editingVisitId
                ? "保存修改"
                : "收下这次晃悠"}
            </button>
          </footer>
        </section>
      ) : null}

      {toast ? (
        <div className="atlas-v2-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      ) : null}
    </main>
  );
}
