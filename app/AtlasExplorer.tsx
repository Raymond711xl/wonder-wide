"use client";

import {
  ArrowRight,
  Building2,
  Check,
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

type PlaceLevel = "country" | "city" | "landmark" | "custom";
type MapLoadState = "loading" | "ready" | "fallback" | "unavailable";

type FootprintPlace = {
  id: string;
  name: string;
  subtitle: string;
  country: string;
  countryCode: string;
  city?: string;
  level: PlaceLevel;
  longitude: number;
  latitude: number;
  source: "featured" | "search" | "map";
};

type NominatimResult = {
  osm_id: number;
  osm_type: string;
  display_name: string;
  name?: string;
  type: string;
  class: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

const STORAGE_KEY = "footprint-atlas-m0-places";

const FEATURED_PLACES: FootprintPlace[] = [
  {
    id: "featured-the-bund",
    name: "外滩",
    subtitle: "上海 · 中国",
    country: "中国",
    countryCode: "CN",
    city: "上海",
    level: "landmark",
    longitude: 121.4904,
    latitude: 31.2401,
    source: "featured",
  },
  {
    id: "featured-forbidden-city",
    name: "故宫博物院",
    subtitle: "北京 · 中国",
    country: "中国",
    countryCode: "CN",
    city: "北京",
    level: "landmark",
    longitude: 116.397,
    latitude: 39.9163,
    source: "featured",
  },
  {
    id: "featured-shibuya",
    name: "涩谷十字路口",
    subtitle: "东京 · 日本",
    country: "日本",
    countryCode: "JP",
    city: "东京",
    level: "landmark",
    longitude: 139.7006,
    latitude: 35.6595,
    source: "featured",
  },
  {
    id: "featured-eiffel",
    name: "埃菲尔铁塔",
    subtitle: "巴黎 · 法国",
    country: "法国",
    countryCode: "FR",
    city: "巴黎",
    level: "landmark",
    longitude: 2.2945,
    latitude: 48.8584,
    source: "featured",
  },
  {
    id: "featured-colosseum",
    name: "罗马斗兽场",
    subtitle: "罗马 · 意大利",
    country: "意大利",
    countryCode: "IT",
    city: "罗马",
    level: "landmark",
    longitude: 12.4922,
    latitude: 41.8902,
    source: "featured",
  },
  {
    id: "featured-hallgrimskirkja",
    name: "哈尔格林姆斯教堂",
    subtitle: "雷克雅未克 · 冰岛",
    country: "冰岛",
    countryCode: "IS",
    city: "雷克雅未克",
    level: "landmark",
    longitude: -21.9266,
    latitude: 64.1417,
    source: "featured",
  },
  {
    id: "featured-liberty",
    name: "自由女神像",
    subtitle: "纽约 · 美国",
    country: "美国",
    countryCode: "US",
    city: "纽约",
    level: "landmark",
    longitude: -74.0445,
    latitude: 40.6892,
    source: "featured",
  },
  {
    id: "featured-opera-house",
    name: "悉尼歌剧院",
    subtitle: "悉尼 · 澳大利亚",
    country: "澳大利亚",
    countryCode: "AU",
    city: "悉尼",
    level: "landmark",
    longitude: 151.2153,
    latitude: -33.8568,
    source: "featured",
  },
  {
    id: "featured-giza",
    name: "吉萨金字塔群",
    subtitle: "吉萨 · 埃及",
    country: "埃及",
    countryCode: "EG",
    city: "吉萨",
    level: "landmark",
    longitude: 31.1342,
    latitude: 29.9792,
    source: "featured",
  },
  {
    id: "featured-table-mountain",
    name: "桌山",
    subtitle: "开普敦 · 南非",
    country: "南非",
    countryCode: "ZA",
    city: "开普敦",
    level: "landmark",
    longitude: 18.4098,
    latitude: -33.9628,
    source: "featured",
  },
  {
    id: "featured-marina-bay",
    name: "滨海湾",
    subtitle: "新加坡",
    country: "新加坡",
    countryCode: "SG",
    city: "新加坡",
    level: "landmark",
    longitude: 103.859,
    latitude: 1.2834,
    source: "featured",
  },
  {
    id: "featured-christ",
    name: "基督像",
    subtitle: "里约热内卢 · 巴西",
    country: "巴西",
    countryCode: "BR",
    city: "里约热内卢",
    level: "landmark",
    longitude: -43.2105,
    latitude: -22.9519,
    source: "featured",
  },
];

const LEVEL_META: Record<
  PlaceLevel,
  { label: string; icon: typeof Globe2 }
> = {
  country: { label: "国家 / 地区", icon: Globe2 },
  city: { label: "城市", icon: Building2 },
  landmark: { label: "地标", icon: Landmark },
  custom: { label: "自定义地点", icon: MapPin },
};

const WORLD_STYLE = "https://demotiles.maplibre.org/globe.json";
const MAP_LOAD_TIMEOUT_MS = 8000;
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Footprint Atlas lightweight map",
  sources: {},
  layers: [
    {
      id: "paper-background",
      type: "background",
      paint: {
        "background-color": "#d7e4e1",
      },
    },
  ],
};

function levelFromResult(result: NominatimResult): PlaceLevel {
  if (result.type === "country") return "country";
  if (
    ["city", "town", "village", "municipality", "borough"].includes(
      result.type,
    )
  ) {
    return "city";
  }
  return "landmark";
}

function normalizeResult(
  result: NominatimResult,
  source: "search" | "map",
): FootprintPlace {
  const address = result.address ?? {};
  const level = levelFromResult(result);
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county;
  const country = address.country ?? (level === "country" ? result.name : "");
  const name =
    result.name ??
    (level === "country" ? country : result.display_name.split(",")[0]) ??
    "未命名地点";
  const subtitleParts = [city && city !== name ? city : undefined, country].filter(
    Boolean,
  );

  return {
    id: `${source}-${result.osm_type}-${result.osm_id}`,
    name,
    subtitle: subtitleParts.join(" · ") || result.display_name,
    country: country || "未知国家 / 地区",
    countryCode: (address.country_code ?? "").toUpperCase(),
    city: city || (level === "city" ? name : undefined),
    level,
    longitude: Number(result.lon),
    latitude: Number(result.lat),
    source,
  };
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(3)}°${value >= 0 ? positive : negative}`;
}

export default function AtlasExplorer() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedMarkersRef = useRef<maplibregl.Marker[]>([]);
  const featuredMarkersRef = useRef<maplibregl.Marker[]>([]);
  const pickModeRef = useRef(false);
  const lastLookupRef = useRef(0);

  const [mapState, setMapState] = useState<MapLoadState>("loading");
  const mapReady = mapState === "ready" || mapState === "fallback";
  const [selected, setSelected] = useState<FootprintPlace[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FootprintPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pickMode, setPickMode] = useState(false);
  const [candidate, setCandidate] = useState<FootprintPlace | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const stats = useMemo(() => {
    const countries = new Set(
      selected
        .map((place) => place.countryCode || place.country)
        .filter(Boolean),
    );
    const cities = new Set(
      selected
        .map((place) => {
          const city = place.city ?? (place.level === "city" ? place.name : "");
          return city ? `${place.countryCode || place.country}:${city}` : "";
        })
        .filter(Boolean),
    );
    const landmarks = selected.filter(
      (place) => place.level === "landmark" || place.level === "custom",
    ).length;

    return {
      countries: countries.size,
      cities: cities.size,
      landmarks,
    };
  }, [selected]);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  const addPlace = useCallback(
    (place: FootprintPlace) => {
      setSelected((current) => {
        const duplicate = current.some(
          (item) =>
            item.id === place.id ||
            (Math.abs(item.longitude - place.longitude) < 0.0001 &&
              Math.abs(item.latitude - place.latitude) < 0.0001),
        );
        if (duplicate) {
          showToast("这个地点已经在你的足迹里了");
          return current;
        }
        showToast(`已留下足迹：${place.name}`);
        return [...current, place];
      });
      setCandidate(null);
      setCandidateName("");
      setSearchResults([]);
    },
    [showToast],
  );

  const removePlace = useCallback(
    (id: string) => {
      setSelected((current) => current.filter((place) => place.id !== id));
      showToast("已从足迹中移除");
    },
    [showToast],
  );

  useEffect(() => {
    let savedPlaces: FootprintPlace[] | null = null;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FootprintPlace[];
        if (Array.isArray(parsed)) savedPlaces = parsed;
      }
    } catch {
      // Keep the prototype usable even if browser storage is unavailable.
    }

    const hydrationTimer = window.setTimeout(() => {
      if (savedPlaces) setSelected(savedPlaces);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    } catch {
      // Device-local persistence is a convenience in M0, not a blocker.
    }
  }, [hydrated, selected]);

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
    let fallbackStarted = false;
    let fallbackSafetyTimer: number | undefined;

    const finishStartup = (state: "ready" | "fallback") => {
      if (destroyed || startupSettled) return;
      startupSettled = true;
      window.clearTimeout(primaryLoadTimer);
      window.clearTimeout(fallbackSafetyTimer);
      setMapState(state);

      try {
        map.setProjection({ type: "globe" });
      } catch {
        // The map remains fully usable when a renderer falls back to Mercator.
      }
    };

    const startFallback = () => {
      if (destroyed || startupSettled || fallbackStarted) return;
      fallbackStarted = true;
      window.clearTimeout(primaryLoadTimer);

      const handleFallbackStyleLoad = () => finishStartup("fallback");
      map.once("style.load", handleFallbackStyleLoad);

      try {
        map.setStyle(FALLBACK_STYLE);
        fallbackSafetyTimer = window.setTimeout(() => {
          if (destroyed || startupSettled) return;
          startupSettled = true;
          setMapState("unavailable");
        }, 3000);
      } catch {
        map.off("style.load", handleFallbackStyleLoad);
        startupSettled = true;
        setMapState("unavailable");
      }
    };

    const primaryLoadTimer = window.setTimeout(
      startFallback,
      MAP_LOAD_TIMEOUT_MS,
    );

    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: WORLD_STYLE,
        center: [18, 22],
        zoom: 1.25,
        minZoom: 0.7,
        maxZoom: 18,
        attributionControl: false,
        renderWorldCopies: true,
      });
    } catch {
      window.clearTimeout(primaryLoadTimer);
      startupSettled = true;
      const unavailableTimer = window.setTimeout(
        () => setMapState("unavailable"),
        0,
      );
      return () => window.clearTimeout(unavailableTimer);
    }

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      "top-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.once("load", () => finishStartup("ready"));
    map.on("error", () => {
      if (!startupSettled) startFallback();
    });

    map.on("click", async (event) => {
      if (!pickModeRef.current) return;

      const now = Date.now();
      if (now - lastLookupRef.current < 1200) return;
      lastLookupRef.current = now;
      setLookupLoading(true);

      const longitude = event.lngLat.lng;
      const latitude = event.lngLat.lat;

      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          lat: String(latitude),
          lon: String(longitude),
          zoom: "18",
          addressdetails: "1",
          "accept-language": "zh-CN,zh,en",
        });
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
          { headers: { Accept: "application/json" } },
        );

        if (!response.ok) throw new Error("Reverse lookup failed");
        const result = (await response.json()) as NominatimResult;
        const place = normalizeResult(result, "map");
        setCandidate(place);
        setCandidateName(place.name);
      } catch {
        const fallback: FootprintPlace = {
          id: `map-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
          name: "我的自定义地点",
          subtitle: `${formatCoordinate(latitude, "N", "S")} · ${formatCoordinate(
            longitude,
            "E",
            "W",
          )}`,
          country: "待确认",
          countryCode: "",
          level: "custom",
          longitude,
          latitude,
          source: "map",
        };
        setCandidate(fallback);
        setCandidateName(fallback.name);
      } finally {
        setLookupLoading(false);
        setPickMode(false);
      }
    });

    mapRef.current = map;
    return () => {
      destroyed = true;
      window.clearTimeout(primaryLoadTimer);
      window.clearTimeout(fallbackSafetyTimer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    featuredMarkersRef.current.forEach((marker) => marker.remove());
    featuredMarkersRef.current = FEATURED_PLACES.map((place) => {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = "map-featured-marker";
      markerButton.setAttribute("aria-label", `探索 ${place.name}`);
      markerButton.title = `${place.name} · ${place.subtitle}`;

      const dot = document.createElement("span");
      dot.className = "map-featured-marker-dot";
      const label = document.createElement("span");
      label.className = "map-featured-marker-label";
      label.textContent = place.name;
      markerButton.append(dot, label);

      markerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        setCandidate(place);
        setCandidateName(place.name);
        map.flyTo({
          center: [place.longitude, place.latitude],
          zoom: Math.max(map.getZoom(), 7),
          essential: true,
        });
      });

      return new maplibregl.Marker({
        element: markerButton,
        anchor: "bottom",
      })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);
    });

    return () => {
      featuredMarkersRef.current.forEach((marker) => marker.remove());
      featuredMarkersRef.current = [];
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    selectedMarkersRef.current.forEach((marker) => marker.remove());
    selectedMarkersRef.current = selected.map((place, index) => {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = "map-selected-marker";
      markerButton.setAttribute("aria-label", `已选择 ${place.name}`);
      markerButton.title = `${place.name} · 已加入足迹`;

      const number = document.createElement("span");
      number.textContent = String(index + 1);
      markerButton.appendChild(number);
      markerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        map.flyTo({
          center: [place.longitude, place.latitude],
          zoom: Math.max(map.getZoom(), 8),
          essential: true,
        });
      });

      return new maplibregl.Marker({
        element: markerButton,
        anchor: "bottom",
      })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);
    });

    return () => {
      selectedMarkersRef.current.forEach((marker) => marker.remove());
      selectedMarkersRef.current = [];
    };
  }, [mapReady, selected]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchError("请输入至少两个字");
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
        limit: "6",
        "accept-language": "zh-CN,zh,en",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Search failed");
      const results = (await response.json()) as NominatimResult[];
      const normalized = results.map((result) =>
        normalizeResult(result, "search"),
      );
      setSearchResults(normalized);
      if (normalized.length === 0) {
        setSearchError("没有找到。可以放大地图后使用自由落点。");
      }
    } catch {
      setSearchError("地点搜索暂时不可用，可以使用自由落点。");
    } finally {
      setSearching(false);
    }
  }

  function focusPlace(place: FootprintPlace) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: place.level === "country" ? 4.5 : place.level === "city" ? 8 : 13,
      essential: true,
    });
  }

  function addSearchResult(place: FootprintPlace) {
    focusPlace(place);
    addPlace(place);
    setQuery("");
  }

  function addCandidate() {
    if (!candidate) return;
    addPlace({
      ...candidate,
      name: candidateName.trim() || candidate.name,
    });
  }

  function fitToSelected() {
    const map = mapRef.current;
    if (!map || selected.length === 0) return;
    if (selected.length === 1) {
      focusPlace(selected[0]);
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    selected.forEach((place) =>
      bounds.extend([place.longitude, place.latitude]),
    );
    map.fitBounds(bounds, {
      padding: { top: 130, right: 90, bottom: 100, left: 90 },
      maxZoom: 8,
      duration: 1100,
    });
  }

  function resetWorldView() {
    mapRef.current?.flyTo({
      center: [18, 22],
      zoom: 1.25,
      bearing: 0,
      pitch: 0,
      essential: true,
    });
  }

  return (
    <main className="atlas-shell">
      <div
        ref={mapContainerRef}
        className={`atlas-map ${pickMode ? "atlas-map-picking" : ""}`}
        role="region"
        aria-label="可探索的世界足迹地图"
      />

      <header className="atlas-header">
        <button
          type="button"
          className="atlas-brand"
          onClick={resetWorldView}
          aria-label="返回世界地图"
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
            探索世界
            <small>选择你去过的地方</small>
          </p>
        </div>

        <button
          type="button"
          className="atlas-mobile-footprints"
          onClick={() => setMobilePanelOpen((current) => !current)}
          aria-expanded={mobilePanelOpen}
        >
          <MapPin size={16} />
          {selected.length}
        </button>
      </header>

      <section className="atlas-search-wrap" aria-label="地点搜索">
        <form className="atlas-search" onSubmit={handleSearch}>
          <Search size={20} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchError("");
            }}
            placeholder="搜索国家、城市或地标"
            aria-label="搜索国家、城市或地标"
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
              aria-label="清除搜索"
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
            <span>查找</span>
          </button>
        </form>

        {(searchResults.length > 0 || searchError) && (
          <div className="atlas-search-results">
            {searchError ? (
              <p className="atlas-search-message">{searchError}</p>
            ) : (
              <>
                <div className="atlas-search-results-header">
                  <span>搜索结果</span>
                  <small>点击 + 加入足迹</small>
                </div>
                {searchResults.map((place) => {
                  const meta = LEVEL_META[place.level];
                  const Icon = meta.icon;
                  return (
                    <button
                      type="button"
                      className="atlas-search-result"
                      key={place.id}
                      onClick={() => addSearchResult(place)}
                    >
                      <span className="atlas-result-icon">
                        <Icon size={16} />
                      </span>
                      <span className="atlas-result-copy">
                        <strong>{place.name}</strong>
                        <small>{place.subtitle}</small>
                      </span>
                      <span className="atlas-result-level">{meta.label}</span>
                      <Plus size={17} />
                    </button>
                  );
                })}
              </>
            )}
            <div className="atlas-search-attribution">
              地点搜索 © OpenStreetMap contributors
            </div>
          </div>
        )}
      </section>

      <aside
        className={`atlas-panel ${mobilePanelOpen ? "atlas-panel-open" : ""}`}
      >
        <div className="atlas-panel-handle" aria-hidden="true" />

        <div className="atlas-panel-intro">
          <span className="atlas-eyebrow">
            <Sparkles size={13} />
            你的世界，从一次点击开始
          </span>
          <h1>
            把去过的地方，
            <br />
            留在这张地图上。
          </h1>
          <p>
            搜索地点，或打开自由落点后直接点击地图。时间和照片都可以以后再补。
          </p>
        </div>

        <div className="atlas-stats" aria-label="足迹统计">
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
            <span>地标</span>
          </div>
        </div>

        <div className="atlas-panel-section">
          <div className="atlas-section-title">
            <div>
              <span>我的足迹</span>
              <small>{selected.length} 个已选地点</small>
            </div>
            {selected.length > 0 ? (
              <button type="button" onClick={fitToSelected}>
                <LocateFixed size={15} />
                查看全部
              </button>
            ) : null}
          </div>

          {selected.length === 0 ? (
            <div className="atlas-empty">
              <div className="atlas-empty-orbit">
                <Globe2 size={26} />
                <span />
              </div>
              <strong>地图还在等你的第一枚足迹</strong>
              <p>可以从这些地标开始，也可以搜索任何地方。</p>
              <div className="atlas-suggestions">
                {FEATURED_PLACES.slice(0, 4).map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => {
                      setCandidate(place);
                      setCandidateName(place.name);
                      focusPlace(place);
                    }}
                  >
                    {place.name}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="atlas-footprint-list">
              {selected.map((place, index) => {
                const meta = LEVEL_META[place.level];
                const Icon = meta.icon;
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      className="atlas-footprint-main"
                      onClick={() => focusPlace(place)}
                    >
                      <span className="atlas-footprint-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="atlas-footprint-icon">
                        <Icon size={15} />
                      </span>
                      <span className="atlas-footprint-copy">
                        <strong>{place.name}</strong>
                        <small>{place.subtitle}</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="atlas-remove"
                      onClick={() => removePlace(place.id)}
                      aria-label={`移除 ${place.name}`}
                    >
                      <X size={15} />
                    </button>
                  </li>
                );
              })}
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
            {pickMode ? "退出自由落点" : "自由落点"}
          </button>
          <button
            type="button"
            className="atlas-next-button"
            disabled={selected.length === 0}
            onClick={() =>
              showToast(
                selected.length
                  ? "M0 已记录足迹；下一阶段将开放时间整理"
                  : "请先选择一个地点",
              )
            }
          >
            完成选点
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
          onClick={() => mapRef.current?.zoomIn({ duration: 350 })}
          aria-label="放大地图"
        >
          <Plus size={17} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut({ duration: 350 })}
          aria-label="缩小地图"
        >
          <Minus size={17} />
        </button>
      </div>

      {pickMode && (
        <div className="atlas-pick-hint">
          <Crosshair size={17} />
          <span>点击地图上的任意位置</span>
          <button type="button" onClick={() => setPickMode(false)}>
            取消
          </button>
        </div>
      )}

      {lookupLoading && (
        <div className="atlas-lookup">
          <LoaderCircle className="spinning" size={18} />
          正在辨认这个地点…
        </div>
      )}

      {candidate && (
        <section className="atlas-candidate" aria-label="地点确认">
          <div className="atlas-candidate-top">
            <span className="atlas-candidate-icon">
              <MapPin size={19} />
            </span>
            <div>
              <small>{LEVEL_META[candidate.level].label}</small>
              <input
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                aria-label="地点名称"
              />
            </div>
            <button
              type="button"
              className="atlas-icon-button"
              onClick={() => setCandidate(null)}
              aria-label="关闭地点确认"
            >
              <X size={17} />
            </button>
          </div>
          <p>{candidate.subtitle}</p>
          <div className="atlas-candidate-actions">
            <button type="button" onClick={() => focusPlace(candidate)}>
              <LocateFixed size={15} />
              定位
            </button>
            <button type="button" className="primary" onClick={addCandidate}>
              <Check size={16} />
              加入我的足迹
            </button>
          </div>
        </section>
      )}

      {toast && (
        <div className="atlas-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}

      {mapState === "fallback" && (
        <div className="atlas-map-status" role="status">
          <Globe2 size={15} />
          <span>
            <strong>轻量地图模式</strong>
            底图服务暂时无法连接，搜索与自由落点仍可继续。
          </span>
        </div>
      )}

      {mapState === "unavailable" && (
        <div className="atlas-map-status atlas-map-status-error" role="alert">
          <Globe2 size={15} />
          <span>
            <strong>地图暂时无法显示</strong>
            仍可通过上方搜索添加地点。
          </span>
        </div>
      )}

      {mapState === "loading" && (
        <div className="atlas-loading">
          <div className="atlas-loading-mark">
            <Globe2 size={28} />
          </div>
          <p>正在展开世界地图</p>
        </div>
      )}
    </main>
  );
}
