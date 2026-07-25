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
  Star,
  Timer,
  Trophy,
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
  cityPlaceCount,
  type CountryMetric,
  type StaticAtlasMapHandle,
} from "./StaticAtlasMap";
import {
  FEATURED_CITIES,
  LANDMARKS_BY_CITY,
  STAY_OPTIONS,
  type ActiveCountry,
  type AtlasGeometry,
  type CityCandidate,
  type CityVisit,
  type LandmarkOption,
  type StayTag,
} from "./atlas-data";

const STORAGE_KEY = "footprint-atlas-m1-city-visits";
const VALID_STAY_TAGS = new Set<StayTag>(
  STAY_OPTIONS.map((option) => option.value),
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

function countryLevel(cityCount: number, points: number) {
  if (cityCount >= 4 || points >= 12) {
    return { heatLevel: 4 as const, levelLabel: "生活版图" };
  }
  if (cityCount >= 3 || points >= 8) {
    return { heatLevel: 3 as const, levelLabel: "深度足迹" };
  }
  if (cityCount >= 2 || points >= 4) {
    return {
      heatLevel: 2 as const,
      levelLabel: cityCount >= 2 ? "多城漫游" : "城市深游",
    };
  }
  return { heatLevel: 1 as const, levelLabel: "初次点亮" };
}

function buildCountryMetrics(visits: CityVisit[]): CountryMetric[] {
  const accumulators = new Map<
    string,
    {
      name: string;
      cities: Set<string>;
      landmarks: Set<string>;
    }
  >();

  visits.forEach((visit) => {
    const current = accumulators.get(visit.countryCode) ?? {
      name: visit.country,
      cities: new Set<string>(),
      landmarks: new Set<string>(),
    };
    current.cities.add(cityKey(visit));
    visit.landmarks.forEach((landmark) =>
      current.landmarks.add(landmarkKey(visit, landmark)),
    );
    accumulators.set(visit.countryCode, current);
  });

  return [...accumulators.entries()]
    .map(([code, item]) => {
      const cityCount = item.cities.size;
      const placeCount = cityCount + item.landmarks.size;
      const level = countryLevel(cityCount, placeCount);
      return {
        code,
        name: item.name,
        cityCount,
        placeCount,
        points: placeCount,
        ...level,
      };
    })
    .sort(
      (left, right) =>
        right.heatLevel - left.heatLevel || right.points - left.points,
    );
}

function stayRank(tag: StayTag) {
  return STAY_OPTIONS.findIndex((option) => option.value === tag);
}

function stayLabel(tag: StayTag) {
  return (
    STAY_OPTIONS.find((option) => option.value === tag)?.description ?? "短途"
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
  const country = address.country;
  const countryCode = address.country_code?.toUpperCase();
  if (!cityName || !country || !countryCode) return null;

  const region =
    address.state ?? address.province ?? address.region ?? address.county;
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
  return value
    .filter(
      (item): item is CityVisit =>
        Boolean(
          item &&
            typeof item === "object" &&
            "visitId" in item &&
            "countryCode" in item &&
            "name" in item &&
            "longitude" in item &&
            "latitude" in item,
        ),
    )
    .map((visit) => ({
      ...visit,
      stayTag: VALID_STAY_TAGS.has(visit.stayTag) ? visit.stayTag : "3天",
      landmarks: Array.isArray(visit.landmarks) ? visit.landmarks : [],
    }));
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
  const [visitStayTag, setVisitStayTag] = useState<StayTag>("3天");
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
      points: cities.size + landmarks.size,
    };
  }, [countryMetrics.length, visits]);

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
    setVisitStayTag("3天");
    setLandmarkOptions(landmarksForCity(city));
    setSelectedLandmarks([]);
    setLandmarkQuery("");
    setLandmarkError("");
    setLandmarksOpen(true);
    setSearchResults([]);
    setSearchError("");
    setPickMode(false);
  }, []);

  const focusCity = useCallback((city: CityCandidate) => {
    setActiveCountry({ code: city.countryCode, name: city.country });
    window.requestAnimationFrame(() => mapRef.current?.focusCity(city));
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
      stayTag: visitStayTag,
      landmarks: selectedLandmarks,
    };
    setVisits((current) => [...current, visit]);
    setCandidate(null);
    setSelectedLandmarks([]);
    setLandmarkOptions([]);
    setLandmarkQuery("");
    setQuery("");
    showToast(
      `已点亮 ${candidate.country} · ${candidate.name}，获得 ${cityPlaceCount(visit)} 分`,
    );
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
        onCityFocus={focusCity}
        onPointPick={handlePointPick}
        onReady={handleMapReady}
      />

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
              {activeCountry ? "查看城市、停留与积分" : "按国家热度浏览世界"}
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

      <nav className="atlas-v2-breadcrumb" aria-label="地图层级">
        <button type="button" onClick={resetWorldView}>
          世界
        </button>
        {activeCountry ? (
          <>
            <ChevronRight size={13} />
            <button
              type="button"
              onClick={() => mapRef.current?.focusCountry(activeCountry.code)}
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
            ? "补充停留、日期与城市地点"
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
            世界层只表达国家与足迹强度；进入国家后，再看城市、停留方式、地点与积分。
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
            <strong>{String(stats.points).padStart(2, "0")}</strong>
            <span>积分</span>
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
                  ? `${activeMetric.cityCount} 城 · ${activeMetric.placeCount} 个地点 · ${activeMetric.points} 分`
                  : "尚未点亮城市"}
              </span>
            </div>
            <em>{activeMetric?.levelLabel ?? "等待点亮"}</em>
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
              <strong>从第一座城市开始点亮国家</strong>
              <p>每座城市 1 分；添加一个城市地点，再增加 1 分。</p>
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
                        {metric.cityCount} 城 · {metric.placeCount} 地 ·{" "}
                        {metric.points} 分
                      </small>
                    </span>
                    <em>{metric.levelLabel}</em>
                    <ChevronRight size={15} />
                  </button>

                  <ol>
                    {countryVisits.map((visit, index) => (
                      <li key={visit.visitId}>
                        <button
                          type="button"
                          className="atlas-v2-visit-main"
                          onClick={() => focusCity(visit)}
                        >
                          <span className="atlas-v2-visit-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="atlas-v2-visit-copy">
                            <strong>{visit.name}</strong>
                            <small>
                              {formatVisitDate(visit.visitedOn)} ·{" "}
                              {stayLabel(visit.stayTag)}
                            </small>
                          </span>
                          <span className={`atlas-v2-stay-tag stay-${stayRank(visit.stayTag)}`}>
                            {visit.stayTag}
                          </span>
                          <span className="atlas-v2-score">
                            +{cityPlaceCount(visit)}
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
                          <span>
                            <Trophy size={12} />
                            {cityPlaceCount(visit)} 个地点 /{" "}
                            {cityPlaceCount(visit)} 分
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
                `已点亮 ${stats.countries} 个国家、${stats.cities} 座城市，累计 ${stats.points} 分`,
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
        <span>
          <i className="heat-1" />
          初见
        </span>
        <span>
          <i className="heat-2" />
          多城
        </span>
        <span>
          <i className="heat-3" />
          深度
        </span>
        <span>
          <i className="heat-4" />
          常驻
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

          <label className="atlas-v2-date-field">
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

          <fieldset className="atlas-v2-stay-picker">
            <legend>
              <Timer size={15} />
              游玩时长 / 出行性质
            </legend>
            <div>
              {STAY_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={visitStayTag === option.value ? "is-selected" : ""}
                  aria-pressed={visitStayTag === option.value}
                  onClick={() => setVisitStayTag(option.value)}
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
                城市地点
                <small>每添加 1 个地点增加 1 分</small>
              </span>
              <span className="atlas-v2-live-score">
                <Star size={13} />
                {1 + selectedLandmarks.length} 分
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
            <button type="button" onClick={() => focusCity(candidate)}>
              <LocateFixed size={15} />
              查看城市位置
            </button>
            <button
              type="button"
              className="primary"
              onClick={addCandidateVisit}
            >
              <Check size={16} />
              点亮 · {1 + selectedLandmarks.length} 分
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
