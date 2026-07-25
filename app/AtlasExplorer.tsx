"use client";

import {
  ArrowLeft,
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
import {
  FEATURED_CITIES,
  LANDMARKS_BY_CITY,
  TRAVEL_TYPE_OPTIONS,
  travelTypeScore,
  type ActiveCountry,
  type AtlasGeometry,
  type CityCandidate,
  type CityVisit,
  type LandmarkOption,
  type TravelType,
} from "./atlas-data";

const STORAGE_KEY = "footprint-atlas-m1-city-visits";
const EARLIEST_VISIT_YEAR = 1900;
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

type CountryGroup = {
  metric: CountryMetric;
  visits: CityVisit[];
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

function normalizeCityName(value: string) {
  return value.trim().toLowerCase();
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
      name: visit.country,
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
  return LANDMARKS_BY_CITY[`${city.countryCode}:${city.name}`] ?? [];
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
  const country = isTaiwan ? "中国" : sourceCountry;
  const countryCode = isTaiwan ? "CN" : sourceCountryCode;

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
    const country = isTaiwan ? "中国" : String(stored.country ?? "");
    const region = stored.region ?? (isTaiwan ? "台湾" : undefined);

    return [
      {
        ...(stored as CityVisit),
        countryCode: isTaiwan ? "CN" : stored.countryCode.toUpperCase(),
        country,
        region,
        subtitle: [region, country].filter(Boolean).join(" · "),
        travelType,
        landmarks: Array.isArray(stored.landmarks) ? stored.landmarks : [],
      },
    ];
  });
}

export default function AtlasExplorer() {
  const mapRef = useRef<StaticAtlasMapHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
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
  const [visitTravelType, setVisitTravelType] =
    useState<TravelType>("旅游");
  const [landmarksOpen, setLandmarksOpen] = useState(false);
  const [landmarkOptions, setLandmarkOptions] = useState<LandmarkOption[]>([]);
  const [selectedLandmarks, setSelectedLandmarks] = useState<LandmarkOption[]>(
    [],
  );
  const [landmarkQuery, setLandmarkQuery] = useState("");
  const [landmarkSearching, setLandmarkSearching] = useState(false);
  const [landmarkError, setLandmarkError] = useState("");
  const [toast, setToast] = useState("");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const countryMetrics = useMemo(() => buildCountryMetrics(visits), [visits]);
  const metricByCode = useMemo(
    () => new Map(countryMetrics.map((metric) => [metric.code, metric])),
    [countryMetrics],
  );

  const stats = useMemo(() => {
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

  const countryGroups = useMemo<CountryGroup[]>(
    () =>
      countryMetrics.map((metric) => ({
        metric,
        visits: visits
          .filter((visit) => visit.countryCode === metric.code)
          .sort((left, right) => right.visitedOn.localeCompare(left.visitedOn)),
      })),
    [countryMetrics, visits],
  );

  const activeMetric = activeCountry
    ? metricByCode.get(activeCountry.code)
    : undefined;

  const showToast = useCallback((message: string) => setToast(message), []);
  const handleMapReady = useCallback(() => setMapReady(true), []);

  const selectCountry = useCallback((country: ActiveCountry) => {
    setActiveCountry(country);
    setCandidate(null);
    setSearchResults([]);
    setSearchError("");
    setPickMode(false);
  }, []);

  const selectCityCandidate = useCallback((city: CityCandidate) => {
    setCandidate(city);
    setActiveCountry({ code: city.countryCode, name: city.country });
    setVisitDate(todayISO());
    setVisitTravelType("旅游");
    setLandmarkOptions(landmarksForCity(city));
    setSelectedLandmarks([]);
    setLandmarkQuery("");
    setLandmarkError("");
    setLandmarksOpen(false);
    setSearchResults([]);
    setSearchError("");
    setPickMode(false);
  }, []);

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
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) savedVisits = migrateVisits(JSON.parse(saved));
    } catch {
      // Device-local history is helpful, but the atlas must load without it.
    }

    const hydrationTimer = window.setTimeout(() => {
      setVisits(savedVisits);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
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
        setSearchError("没有找到城市。可以换一个名称，或在地图上选择。");
      }
    } catch {
      setSearchError("城市搜索暂时不可用，可以在地图上选择城市。");
    } finally {
      setSearching(false);
    }
  }

  const handlePointPick = useCallback(
    async (longitude: number, latitude: number) => {
      setLookupLoading(true);
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          lat: String(latitude),
          lon: String(longitude),
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
        const city = normalizeCityResult(
          (await response.json()) as NominatimResult,
        );
        if (!city) throw new Error("No city found");
        selectCityCandidate(city);
        window.requestAnimationFrame(() =>
          mapRef.current?.focusCountry(city.countryCode),
        );
      } catch {
        showToast("没有辨认出城市，请使用上方搜索");
      } finally {
        setLookupLoading(false);
        setPickMode(false);
      }
    },
    [selectCityCandidate, showToast],
  );

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
      visitId: `${candidate.id}-${visitDate}-${Date.now()}`,
      visitedOn: visitDate,
      travelType: visitTravelType,
      landmarks: selectedLandmarks,
    };
    setVisits((current) => [...current, visit]);
    setCandidate(null);
    setSelectedLandmarks([]);
    setLandmarkOptions([]);
    setLandmarkQuery("");
    setQuery("");
    showToast(`已记录 ${candidate.country} · ${candidate.name}`);
  }

  function removeVisit(visitId: string) {
    setVisits((current) =>
      current.filter((visit) => visit.visitId !== visitId),
    );
    showToast("已移除这次城市记录");
  }

  function resetWorldView() {
    setActiveCountry(null);
    setCandidate(null);
    setSearchResults([]);
    setSearchError("");
    setPickMode(false);
    mapRef.current?.reset();
  }

  function showAllFootprints() {
    setActiveCountry(null);
    setCandidate(null);
    mapRef.current?.reset();
  }

  return (
    <main className="atlas-v2-shell">
      <StaticAtlasMap
        ref={mapRef}
        visits={visits}
        activeCountry={activeCountry}
        candidate={candidate}
        featuredCities={FEATURED_CITIES}
        countryMetrics={countryMetrics}
        pickMode={pickMode}
        onCountrySelect={selectCountry}
        onCityOpen={openCity}
        onPointPick={handlePointPick}
        onReady={handleMapReady}
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
            <strong>返回世界地图</strong>
            <small>退出 {activeCountry.name} 城市层</small>
          </span>
        </button>
      ) : null}

      <header className="atlas-v2-header">
        <button
          type="button"
          className="atlas-v2-brand"
          onClick={resetWorldView}
          aria-label="返回静态世界地图"
        >
          <span className="atlas-v2-brand-mark">
            <Compass size={18} strokeWidth={2.2} />
          </span>
          <span className="atlas-v2-brand-copy">
            <strong>远迹</strong>
            <small>FOOTPRINT ATLAS</small>
          </span>
        </button>

        <div className="atlas-v2-step" aria-label="当前地图架构">
          <span>{activeCountry ? "02" : "01"}</span>
          <p>
            {activeCountry ? "城市层" : "国家层"}
            <small>
              {activeCountry ? "查看城市与到访记录" : "按国家足迹浏览世界"}
            </small>
          </p>
        </div>

        <button
          type="button"
          className="atlas-v2-mobile-footprints"
          onClick={() => setMobilePanelOpen((current) => !current)}
          aria-expanded={mobilePanelOpen}
          aria-label="打开足迹信息"
        >
          <MapPin size={16} />
          {visits.length}
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
              activeCountry
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
                  <small>添加后进入国家的城市层</small>
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

      <nav
        className={`atlas-v2-breadcrumb ${activeCountry ? "has-country" : ""}`}
        aria-label="地图层级"
      >
        <strong>{activeCountry?.name ?? "世界"}</strong>
        {candidate ? (
          <>
            <ChevronRight size={13} />
            <strong>{candidate.name}</strong>
          </>
        ) : null}
        <span>
          {candidate
            ? "补充日期、出游性质与景点"
            : activeCountry
              ? "城市级静态地图"
              : "国家级静态地图"}
        </span>
      </nav>

      <aside
        className={`atlas-v2-panel ${mobilePanelOpen ? "is-open" : ""}`}
      >
        <div className="atlas-v2-panel-handle" aria-hidden="true" />
        <div className="atlas-v2-panel-intro">
          <span className="atlas-v2-eyebrow">
            <Sparkles size={13} />
            一张不漂移的两级足迹地图
          </span>
          <h1>
            国家看热度，
            <br />
            城市看故事。
          </h1>
          <p>
            世界层查看国家足迹；进入国家后，再看城市、出游性质与景点记录。
          </p>
        </div>

        <div className="atlas-v2-stats" aria-label="足迹统计">
          <div>
            <strong>{String(stats.countries).padStart(2, "0")}</strong>
            <span>国家</span>
          </div>
          <div>
            <strong>{String(stats.cities).padStart(2, "0")}</strong>
            <span>城市</span>
          </div>
          <div>
            <strong>{String(stats.landmarks).padStart(2, "0")}</strong>
            <span>地标</span>
          </div>
          <div>
            <strong>{String(stats.visits).padStart(2, "0")}</strong>
            <span>到访</span>
          </div>
        </div>

        {activeCountry ? (
          <section
            className={`atlas-v2-active-country heat-${activeMetric?.heatLevel ?? 0}`}
            aria-label={`${activeCountry.name}概览`}
          >
            <div className="atlas-v2-country-emblem">
              <Globe2 size={18} />
            </div>
            <div>
              <small>当前国家 · 城市层</small>
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
              <span>我的足迹档案</span>
              <small>{visits.length} 次到访记录</small>
            </div>
            {visits.length > 0 ? (
              <button type="button" onClick={showAllFootprints}>
                <LocateFixed size={15} />
                国家总览
              </button>
            ) : null}
          </div>

          {visits.length === 0 ? (
            <div className="atlas-v2-empty">
              <div className="atlas-v2-empty-orbit">
                <Globe2 size={26} />
                <span />
              </div>
              <strong>从第一座城市开始记录足迹</strong>
              <p>选择到访日期与出游性质，景点可以稍后再补。</p>
              <div className="atlas-v2-suggestions">
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
            <div className="atlas-v2-country-groups">
              {countryGroups.map(({ metric, visits: countryVisits }) => (
                <section
                  key={metric.code}
                  className={`atlas-v2-country-group heat-${metric.heatLevel}`}
                >
                  <button
                    type="button"
                    className="atlas-v2-country-group-head"
                    onClick={() =>
                      selectCountry({ code: metric.code, name: metric.name })
                    }
                  >
                    <span className="atlas-v2-heat-swatch" />
                    <span>
                      <strong>{metric.name}</strong>
                      <small>
                        {metric.cityCount} 城 · {metric.landmarkCount} 景点
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>

                  <ol>
                    {countryVisits.map((visit, index) => (
                      <li key={visit.visitId}>
                        <div className="atlas-v2-visit-main">
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
                        </div>
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
            className={`atlas-v2-pick-button ${pickMode ? "is-active" : ""}`}
            onClick={() => setPickMode((current) => !current)}
            disabled={!mapReady}
          >
            {pickMode ? <X size={17} /> : <Crosshair size={17} />}
            {pickMode ? "退出地图选择" : "地图选城市"}
          </button>
          <button
            type="button"
            className="atlas-v2-next-button"
            disabled={visits.length === 0}
            onClick={() =>
              showToast(
                `已记录 ${stats.countries} 个国家、${stats.cities} 座城市`,
              )
            }
          >
            完成城市选择
            <ArrowRight size={17} />
          </button>
        </div>
      </aside>

      <div className="atlas-v2-map-tools">
        <button type="button" onClick={resetWorldView} aria-label="返回世界视图">
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

      <div className="atlas-v2-map-legend" aria-label="国家热度图例">
        <b>国家足迹密度</b>
        <span>
          <i className="heat-1" />
          较少
        </span>
        <span>
          <i className="heat-2" />
          渐多
        </span>
        <span>
          <i className="heat-3" />
          丰富
        </span>
        <span>
          <i className="heat-4" />
          密集
        </span>
      </div>

      {pickMode ? (
        <div className="atlas-v2-pick-hint">
          <Crosshair size={17} />
          <span>点击静态地图上的位置，系统会识别城市</span>
          <button type="button" onClick={() => setPickMode(false)}>
            取消
          </button>
        </div>
      ) : null}

      {lookupLoading ? (
        <div className="atlas-v2-lookup">
          <LoaderCircle className="spinning" size={18} />
          正在识别城市…
        </div>
      ) : null}

      {candidate ? (
        <section className="atlas-v2-composer" aria-label="添加城市到访">
          <header>
            <span className="atlas-v2-candidate-icon">
              <Building2 size={19} />
            </span>
            <div>
              <small>添加城市到访</small>
              <h2>{candidate.name}</h2>
              <p>{candidate.subtitle}</p>
            </div>
            <button
              type="button"
              className="atlas-v2-icon-button"
              onClick={() => setCandidate(null)}
              aria-label="关闭城市添加面板"
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
              出游性质
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
                >
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
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
                景点（可选）
                <small>
                  {selectedLandmarks.length
                    ? `已选 ${selectedLandmarks.length} 个`
                    : "可以稍后补充"}
                </small>
              </span>
              <ChevronDown
                size={16}
                className={landmarksOpen ? "is-open" : ""}
              />
            </button>

            {landmarksOpen ? (
              <div className="atlas-v2-landmark-body">
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
                ) : (
                  <p>还没有推荐地点，可以搜索这座城市里的建筑或景点。</p>
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
              </div>
            ) : null}
          </div>

          <footer>
            <button
              type="button"
              className="primary"
              onClick={addCandidateVisit}
            >
              <Check size={16} />
              保存到访
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
