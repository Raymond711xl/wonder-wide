"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type {
  ActiveCountry,
  AtlasGeometry,
  CityCandidate,
  CityVisit,
  StayTag,
} from "./atlas-data";

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 760;
const MAP_ASPECT = MAP_WIDTH / MAP_HEIGHT;
const MIN_LATITUDE = -58;
const MAX_LATITUDE = 84;

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ProjectedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type CountryProperties = {
  ISO_A2_EH?: string;
  ISO_A2?: string;
  NAME?: string;
  NAME_ZH?: string;
  ADMIN?: string;
  LABEL_X?: number;
  LABEL_Y?: number;
};

type CountryFeature = {
  type: "Feature";
  properties: CountryProperties;
  geometry: AtlasGeometry;
};

type CountryCollection = {
  type: "FeatureCollection";
  features: CountryFeature[];
};

type ProjectedCountry = {
  code: string;
  name: string;
  path: string;
  bounds: ProjectedBounds;
  labelX: number;
  labelY: number;
};

export type CountryMetric = {
  code: string;
  name: string;
  cityCount: number;
  placeCount: number;
  points: number;
  heatLevel: 1 | 2 | 3 | 4;
  levelLabel: string;
};

type StaticAtlasMapProps = {
  visits: CityVisit[];
  activeCountry: ActiveCountry | null;
  candidate: CityCandidate | null;
  featuredCities: CityCandidate[];
  countryMetrics: CountryMetric[];
  pickMode: boolean;
  onCountrySelect: (country: ActiveCountry) => void;
  onCityOpen: (city: CityCandidate) => void;
  onCityFocus: (city: CityCandidate) => void;
  onPointPick: (longitude: number, latitude: number) => void;
  onReady?: () => void;
};

export type StaticAtlasMapHandle = {
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusCountry: (countryCode: string) => void;
  focusCity: (city: CityCandidate) => void;
};

type CityAggregate = {
  city: CityVisit;
  sequence: number;
  stayTag: StayTag;
  landmarkIds: Set<string>;
  landmarks: number;
  placeCount: number;
  points: number;
};

const WORLD_VIEW: ViewBox = {
  x: 0,
  y: 0,
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
};

const STAY_RANK: Record<StayTag, number> = {
  "3天": 1,
  "5天": 2,
  "1个月": 3,
  留学: 4,
  常住: 5,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function projectCoordinate(longitude: number, latitude: number) {
  return {
    x: ((longitude + 180) / 360) * MAP_WIDTH,
    y:
      ((MAX_LATITUDE - clamp(latitude, MIN_LATITUDE, MAX_LATITUDE)) /
        (MAX_LATITUDE - MIN_LATITUDE)) *
      MAP_HEIGHT,
  };
}

function unprojectCoordinate(x: number, y: number) {
  return {
    longitude: (x / MAP_WIDTH) * 360 - 180,
    latitude:
      MAX_LATITUDE -
      (y / MAP_HEIGHT) * (MAX_LATITUDE - MIN_LATITUDE),
  };
}

function visitKey(visit: Pick<CityCandidate, "countryCode" | "name">) {
  return `${visit.countryCode}:${visit.name.trim().toLowerCase()}`;
}

export function cityPlaceCount(visit: Pick<CityVisit, "landmarks">) {
  return 1 + visit.landmarks.length;
}

function walkCoordinates(
  coordinates: unknown,
  callback: (longitude: number, latitude: number) => void,
) {
  if (
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    callback(coordinates[0], coordinates[1]);
    return;
  }
  if (Array.isArray(coordinates)) {
    coordinates.forEach((coordinate) => walkCoordinates(coordinate, callback));
  }
}

function geometryBounds(geometry: AtlasGeometry): ProjectedBounds {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  walkCoordinates(geometry.coordinates, (longitude, latitude) => {
    const point = projectCoordinate(longitude, latitude);
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.maxY = Math.max(bounds.maxY, point.y);
  });

  return bounds;
}

function ringPath(ring: number[][]) {
  let path = "";
  let previousLongitude: number | null = null;
  let segmentOpen = false;

  ring.forEach(([longitude, latitude]) => {
    const point = projectCoordinate(longitude, latitude);
    const crossesDateLine =
      previousLongitude !== null &&
      Math.abs(longitude - previousLongitude) > 180;

    if (!segmentOpen || crossesDateLine) {
      if (segmentOpen) path += " Z";
      path += ` M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      segmentOpen = true;
    } else {
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }
    previousLongitude = longitude;
  });

  return segmentOpen ? `${path} Z` : path;
}

function geometryPath(geometry: AtlasGeometry) {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);

  return polygons
    .flatMap((polygon) => polygon.map((ring) => ringPath(ring)))
    .join(" ");
}

function fitBounds(
  bounds: ProjectedBounds,
  minimumWidth = 150,
  paddingRatio = 0.16,
): ViewBox {
  const rawWidth = Math.max(1, bounds.maxX - bounds.minX);
  const rawHeight = Math.max(1, bounds.maxY - bounds.minY);
  let width = Math.max(minimumWidth, rawWidth * (1 + paddingRatio * 2));
  let height = Math.max(90, rawHeight * (1 + paddingRatio * 2));

  if (width / height > MAP_ASPECT) {
    height = width / MAP_ASPECT;
  } else {
    width = height * MAP_ASPECT;
  }

  width = Math.min(MAP_WIDTH, width);
  height = Math.min(MAP_HEIGHT, height);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: clamp(centerX - width / 2, 0, MAP_WIDTH - width),
    y: clamp(centerY - height / 2, 0, MAP_HEIGHT - height),
    width,
    height,
  };
}

function zoomViewBox(current: ViewBox, factor: number): ViewBox {
  const width = clamp(current.width * factor, 115, MAP_WIDTH);
  const height = width / MAP_ASPECT;
  const centerX = current.x + current.width / 2;
  const centerY = current.y + current.height / 2;
  return {
    x: clamp(centerX - width / 2, 0, MAP_WIDTH - width),
    y: clamp(centerY - height / 2, 0, MAP_HEIGHT - height),
    width,
    height,
  };
}

function aggregateVisits(visits: CityVisit[], countryCode: string) {
  const aggregates = new Map<string, CityAggregate>();

  visits.forEach((visit, index) => {
    if (visit.countryCode !== countryCode) return;
    const key = visitKey(visit);
    const existing = aggregates.get(key);
    if (!existing) {
      const landmarkIds = new Set(visit.landmarks.map((landmark) => landmark.id));
      aggregates.set(key, {
        city: visit,
        sequence: index + 1,
        stayTag: visit.stayTag,
        landmarkIds,
        landmarks: landmarkIds.size,
        placeCount: 1 + landmarkIds.size,
        points: 1 + landmarkIds.size,
      });
      return;
    }

    visit.landmarks.forEach((landmark) =>
      existing.landmarkIds.add(landmark.id),
    );
    existing.landmarks = existing.landmarkIds.size;
    existing.placeCount = 1 + existing.landmarkIds.size;
    existing.points = 1 + existing.landmarkIds.size;
    if (STAY_RANK[visit.stayTag] > STAY_RANK[existing.stayTag]) {
      existing.stayTag = visit.stayTag;
    }
  });

  return [...aggregates.values()];
}

function heatFill(level?: number) {
  return level ? `url(#country-heat-${level})` : "#ece9df";
}

function keyboardActivate(
  event: KeyboardEvent<SVGGElement | SVGPathElement>,
  action: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

const StaticAtlasMap = forwardRef<StaticAtlasMapHandle, StaticAtlasMapProps>(
  function StaticAtlasMap(
    {
      visits,
      activeCountry,
      candidate,
      featuredCities,
      countryMetrics,
      pickMode,
      onCountrySelect,
      onCityOpen,
      onCityFocus,
      onPointPick,
      onReady,
    },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [countries, setCountries] = useState<ProjectedCountry[]>([]);
    const [viewBox, setViewBox] = useState<ViewBox>(WORLD_VIEW);
    const [loadError, setLoadError] = useState(false);

    const countryByCode = useMemo(
      () => new Map(countries.map((country) => [country.code, country])),
      [countries],
    );
    const metricByCode = useMemo(
      () => new Map(countryMetrics.map((metric) => [metric.code, metric])),
      [countryMetrics],
    );

    useEffect(() => {
      let cancelled = false;
      fetch("/data/world-countries.geojson")
        .then((response) => {
          if (!response.ok) throw new Error("Country map unavailable");
          return response.json() as Promise<CountryCollection>;
        })
        .then((collection) => {
          if (cancelled) return;
          const projected = collection.features
            .map((feature): ProjectedCountry | null => {
              const code = String(
                feature.properties.ISO_A2_EH ??
                  feature.properties.ISO_A2 ??
                  "",
              );
              if (!code || code === "-99" || code === "AQ") return null;
              const name = String(
                feature.properties.NAME_ZH ??
                  feature.properties.NAME ??
                  feature.properties.ADMIN ??
                  code,
              );
              const bounds = geometryBounds(feature.geometry);
              const label =
                typeof feature.properties.LABEL_X === "number" &&
                typeof feature.properties.LABEL_Y === "number"
                  ? projectCoordinate(
                      feature.properties.LABEL_X,
                      feature.properties.LABEL_Y,
                    )
                  : {
                      x: (bounds.minX + bounds.maxX) / 2,
                      y: (bounds.minY + bounds.maxY) / 2,
                    };
              return {
                code,
                name,
                path: geometryPath(feature.geometry),
                bounds,
                labelX: label.x,
                labelY: label.y,
              };
            })
            .filter((country): country is ProjectedCountry => Boolean(country));
          setCountries(projected);
          onReady?.();
        })
        .catch(() => {
          if (!cancelled) setLoadError(true);
        });
      return () => {
        cancelled = true;
      };
    }, [onReady]);

    useEffect(() => {
      if (countries.length === 0) return;
      if (!activeCountry) {
        setViewBox(WORLD_VIEW);
        return;
      }
      const country = countryByCode.get(activeCountry.code);
      if (country) setViewBox(fitBounds(country.bounds));
    }, [activeCountry, countries.length, countryByCode]);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          setViewBox(WORLD_VIEW);
        },
        zoomIn() {
          setViewBox((current) => zoomViewBox(current, 0.72));
        },
        zoomOut() {
          setViewBox((current) => zoomViewBox(current, 1.38));
        },
        focusCountry(countryCode) {
          const country = countryByCode.get(countryCode);
          if (country) setViewBox(fitBounds(country.bounds));
        },
        focusCity(city) {
          const point = projectCoordinate(city.longitude, city.latitude);
          const width = 190;
          const height = width / MAP_ASPECT;
          setViewBox({
            x: clamp(point.x - width / 2, 0, MAP_WIDTH - width),
            y: clamp(point.y - height / 2, 0, MAP_HEIGHT - height),
            width,
            height,
          });
        },
      }),
      [countryByCode],
    );

    const cityAggregates = useMemo(
      () =>
        activeCountry
          ? aggregateVisits(visits, activeCountry.code)
          : ([] as CityAggregate[]),
      [activeCountry, visits],
    );

    const visitedCityKeys = useMemo(
      () => new Set(cityAggregates.map((aggregate) => visitKey(aggregate.city))),
      [cityAggregates],
    );

    const countrySuggestions = useMemo(
      () =>
        activeCountry
          ? featuredCities.filter(
              (city) =>
                city.countryCode === activeCountry.code &&
                !visitedCityKeys.has(visitKey(city)),
            )
          : [],
      [activeCountry, featuredCities, visitedCityKeys],
    );

    const worldBadges = useMemo(() => {
      const occupied: Array<{ x: number; y: number; width: number }> = [];
      return countryMetrics
        .map((metric) => {
          const country = countryByCode.get(metric.code);
          if (!country) return null;
          const width = 118;
          const offsets = [0, -38, 38, -76, 76];
          const offset = offsets.find((candidateOffset) =>
            occupied.every(
              (placed) =>
                Math.abs(placed.x - country.labelX) > (placed.width + width) / 2 ||
                Math.abs(placed.y - (country.labelY + candidateOffset)) > 30,
            ),
          );
          const y = country.labelY + (offset ?? 92);
          occupied.push({ x: country.labelX, y, width });
          return { metric, country, x: country.labelX, y };
        })
        .filter(
          (
            badge,
          ): badge is {
            metric: CountryMetric;
            country: ProjectedCountry;
            x: number;
            y: number;
          } => Boolean(badge),
        );
    }, [countryByCode, countryMetrics]);

    // Marker artwork counter-scales around its exact geographic anchor. The
    // anchor itself stays in the map's SVG coordinate system at every zoom.
    const markerScale = clamp(viewBox.width / MAP_WIDTH, 0.085, 1);

    function pointFromEvent(event: MouseEvent<SVGElement>) {
      const svg = svgRef.current;
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix) return null;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(matrix.inverse());
      return unprojectCoordinate(local.x, local.y);
    }

    function pickAtEvent(event: MouseEvent<SVGElement>) {
      const location = pointFromEvent(event);
      if (location) onPointPick(location.longitude, location.latitude);
    }

    return (
      <div
        className={`static-atlas-map ${pickMode ? "is-picking" : ""}`}
        role="region"
        aria-label="两级静态世界足迹地图"
        data-map-mode={activeCountry ? "country" : "world"}
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={
            activeCountry
              ? `${activeCountry.name}城市级静态地图`
              : "国家级静态世界地图"
          }
          onClick={(event) => {
            if (pickMode && event.target === event.currentTarget) {
              pickAtEvent(event);
            }
          }}
        >
          <defs>
            <linearGradient id="country-heat-1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f6d889" />
              <stop offset="100%" stopColor="#e8b45c" />
            </linearGradient>
            <linearGradient id="country-heat-2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#efb969" />
              <stop offset="100%" stopColor="#d77a49" />
            </linearGradient>
            <linearGradient id="country-heat-3" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d97850" />
              <stop offset="100%" stopColor="#ad4439" />
            </linearGradient>
            <linearGradient id="country-heat-4" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9b3e38" />
              <stop offset="100%" stopColor="#542a32" />
            </linearGradient>
            <pattern
              id="atlas-grid"
              width="38"
              height="38"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 38 0 L 0 0 0 38" fill="none" stroke="#1b4646" strokeOpacity=".045" />
            </pattern>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="static-atlas-ocean" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#atlas-grid)" />

          <g className="static-atlas-countries">
            {countries.map((country) => {
              const metric = metricByCode.get(country.code);
              const isActive = activeCountry?.code === country.code;
              const isDimmed = Boolean(activeCountry && !isActive);
              const activate = () => {
                if (pickMode) return;
                onCountrySelect({ code: country.code, name: country.name });
              };
              return (
                <path
                  key={country.code}
                  d={country.path}
                  role="button"
                  tabIndex={0}
                  aria-label={`进入${country.name}`}
                  className={[
                    "static-country-shape",
                    metric ? `is-visited heat-${metric.heatLevel}` : "",
                    isActive ? "is-active" : "",
                    isDimmed ? "is-dimmed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  fillRule="evenodd"
                  style={{ fill: heatFill(metric?.heatLevel) }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (pickMode) {
                      pickAtEvent(event);
                    } else {
                      activate();
                    }
                  }}
                  onKeyDown={(event) => keyboardActivate(event, activate)}
                >
                  <title>
                    {metric
                      ? `${country.name} · ${metric.cityCount} 城 · ${metric.points} 分`
                      : country.name}
                  </title>
                </path>
              );
            })}
          </g>

          {!activeCountry ? (
            <g className="static-country-badges" aria-label="已去国家标签">
              {worldBadges.map(({ metric, country, x, y }) => (
                <g
                  key={metric.code}
                  className={`static-country-badge heat-${metric.heatLevel}`}
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${metric.name}，${metric.cityCount}座城市，${metric.points}分`}
                  onClick={() =>
                    onCountrySelect({ code: metric.code, name: metric.name })
                  }
                  onKeyDown={(event) =>
                    keyboardActivate(event, () =>
                      onCountrySelect({
                        code: metric.code,
                        name: metric.name,
                      }),
                    )
                  }
                >
                  <g transform={`scale(${markerScale})`}>
                    <line
                      x1="0"
                      y1="0"
                      x2={(country.labelX - x) / markerScale}
                      y2={(country.labelY - y) / markerScale}
                    />
                    <circle r="13" />
                    <text className="badge-count" textAnchor="middle" y="4">
                      {metric.cityCount}
                    </text>
                    <rect x="17" y="-15" width="101" height="30" rx="10" />
                    <text x="28" y="-2" className="badge-name">
                      {metric.name}
                    </text>
                    <text x="28" y="10" className="badge-meta">
                      {metric.cityCount} 城 · {metric.points} 分
                    </text>
                  </g>
                </g>
              ))}
            </g>
          ) : (
            <g className="static-city-layer" aria-label={`${activeCountry.name}城市节点`}>
              {cityAggregates.map((aggregate) => {
                const point = projectCoordinate(
                  aggregate.city.longitude,
                  aggregate.city.latitude,
                );
                const labelWidth = Math.max(
                  116,
                  aggregate.city.name.length * 16 + 72,
                );
                const activate = () => onCityFocus(aggregate.city);
                return (
                  <g
                    key={visitKey(aggregate.city)}
                    className="static-city-marker is-visited"
                    transform={`translate(${point.x} ${point.y}) scale(${markerScale})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${aggregate.city.name}，${aggregate.stayTag}，${aggregate.placeCount}个地点，${aggregate.points}分`}
                    onClick={activate}
                    onKeyDown={(event) => keyboardActivate(event, activate)}
                  >
                    <circle className="city-halo" r="16" />
                    <circle className="city-sequence" r="11" />
                    <text className="city-number" textAnchor="middle" y="4">
                      {aggregate.sequence}
                    </text>
                    <line x1="12" y1="0" x2="22" y2="0" />
                    <rect
                      className="city-label-card"
                      x="22"
                      y="-21"
                      width={labelWidth}
                      height="42"
                      rx="11"
                    />
                    <text x="34" y="-3" className="city-label-name">
                      {aggregate.city.name}
                    </text>
                    <text x="34" y="13" className="city-label-meta">
                      {aggregate.stayTag} · {aggregate.placeCount} 地 · {aggregate.points} 分
                    </text>
                  </g>
                );
              })}

              {countrySuggestions.map((city) => {
                const point = projectCoordinate(city.longitude, city.latitude);
                const activate = () => onCityOpen(city);
                return (
                  <g
                    key={city.id}
                    className="static-city-marker is-suggestion"
                    transform={`translate(${point.x} ${point.y}) scale(${markerScale})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`添加城市 ${city.name}`}
                    onClick={activate}
                    onKeyDown={(event) => keyboardActivate(event, activate)}
                  >
                    <circle className="city-suggestion-dot" r="6" />
                    <line x1="8" y1="0" x2="16" y2="0" />
                    <rect
                      className="city-suggestion-card"
                      x="16"
                      y="-13"
                      width={Math.max(66, city.name.length * 15 + 25)}
                      height="26"
                      rx="9"
                    />
                    <text x="27" y="4" className="city-suggestion-name">
                      {city.name}
                    </text>
                  </g>
                );
              })}

              {candidate && candidate.countryCode === activeCountry.code ? (
                <g
                  className="static-candidate-marker"
                  transform={`translate(${projectCoordinate(candidate.longitude, candidate.latitude).x} ${projectCoordinate(candidate.longitude, candidate.latitude).y}) scale(${markerScale})`}
                  aria-label={`当前城市 ${candidate.name}`}
                >
                  <circle className="candidate-pulse" r="19" />
                  <circle className="candidate-core" r="8" />
                </g>
              ) : null}
            </g>
          )}
        </svg>

        <div className="static-map-mode-note">
          <strong>{activeCountry ? `${activeCountry.name} · 城市层` : "世界 · 国家层"}</strong>
          <span>
            {activeCountry
              ? "所有城市节点与国家底图使用同一坐标系"
              : "颜色越深，代表城市与地点积分越高"}
          </span>
        </div>

        {countries.length === 0 && !loadError ? (
          <div className="static-map-loading" role="status">
            正在铺开静态世界地图…
          </div>
        ) : null}
        {loadError ? (
          <div className="static-map-loading is-error" role="alert">
            静态地图数据暂时无法读取
          </div>
        ) : null}
      </div>
    );
  },
);

export default StaticAtlasMap;
