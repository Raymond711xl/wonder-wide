"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import type {
  ActiveCountry,
  AtlasGeometry,
  CityCandidate,
  CityVisit,
  TravelType,
} from "./atlas-data";
import {
  chinaProvinceKey,
  normalizeCountryName,
  travelTypeScore,
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
  CONTINENT?: string;
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

type SubdivisionProperties = {
  name?: string;
  id?: string;
};

type SubdivisionFeature = {
  type: "Feature";
  properties: SubdivisionProperties;
  geometry: AtlasGeometry;
};

type SubdivisionCollection = {
  type: "FeatureCollection";
  countryCode: string;
  boundaryLabel?: string;
  attribution?: string;
  features: SubdivisionFeature[];
};

type ProjectedSubdivision = {
  id: string;
  path: string;
};

type CityCatalog = {
  source: string;
  definition: string;
  attribution: string;
  total: number;
  counts: Record<string, number>;
};

export type CountryMetric = {
  code: string;
  name: string;
  cityCount: number;
  landmarkCount: number;
  hiddenScore: number;
  heatLevel: 1 | 2 | 3 | 4;
};

type StaticAtlasMapProps = {
  visits: CityVisit[];
  activeCountry: ActiveCountry | null;
  candidate: CityCandidate | null;
  featuredCities: CityCandidate[];
  countryMetrics: CountryMetric[];
  onCountrySelect: (country: ActiveCountry) => void;
  onCityOpen: (city: CityCandidate) => void;
  onCityEdit: (city: CityVisit) => void;
};

export type StaticAtlasMapHandle = {
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusCountry: (countryCode: string) => void;
};

type CityAggregate = {
  city: CityVisit;
  sequence: number;
  travelType: TravelType;
  landmarkIds: Set<string>;
  landmarks: number;
};

const WORLD_VIEW: ViewBox = {
  x: 0,
  y: 0,
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
};

const SUBDIVISION_COUNTRIES = new Set(["CN", "ES"]);
const CHINA_PROVINCE_TOTAL = 34;

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

function visitKey(visit: Pick<CityCandidate, "countryCode" | "name">) {
  return `${visit.countryCode}:${visit.name.trim().toLowerCase()}`;
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

function mergeBounds(
  first: ProjectedBounds,
  second: ProjectedBounds,
): ProjectedBounds {
  return {
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY),
  };
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
        travelType: visit.travelType,
        landmarkIds,
        landmarks: landmarkIds.size,
      });
      return;
    }

    visit.landmarks.forEach((landmark) =>
      existing.landmarkIds.add(landmark.id),
    );
    existing.landmarks = existing.landmarkIds.size;
    if (
      travelTypeScore(visit.travelType) >
      travelTypeScore(existing.travelType)
    ) {
      existing.travelType = visit.travelType;
    }
  });

  return [...aggregates.values()];
}

function countryFill(level?: number, isActive = false) {
  if (level) return `url(#country-heat-${level})`;
  return isActive ? "#fff9ed" : "#e9e6df";
}

function formatCoverage(visited: number, total: number) {
  if (total <= 0 || visited <= 0) return "0%";
  const percentage = (visited / total) * 100;
  if (percentage < 0.1) return "<0.1%";
  if (percentage < 10) return `${percentage.toFixed(1)}%`;
  return `${Math.round(percentage)}%`;
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
      onCountrySelect,
      onCityOpen,
      onCityEdit,
    },
    ref,
  ) {
    const [countries, setCountries] = useState<ProjectedCountry[]>([]);
    const [cityCatalog, setCityCatalog] = useState<CityCatalog | null>(null);
    const [subdivisions, setSubdivisions] = useState<ProjectedSubdivision[]>(
      [],
    );
    const [subdivisionLabel, setSubdivisionLabel] = useState("");
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
                name: normalizeCountryName(name, code),
                path: geometryPath(feature.geometry),
                bounds,
                labelX: label.x,
                labelY: label.y,
              };
            })
            .filter((country): country is ProjectedCountry => Boolean(country));

          // Taiwan is drawn as part of China. It remains an independent
          // geometry in the source dataset only so the coastline stays
          // accurate, but is never exposed as a separate country target.
          const china = projected.find((country) => country.code === "CN");
          const taiwan = projected.find((country) => country.code === "TW");
          if (china && taiwan) {
            china.path = `${china.path} ${taiwan.path}`;
            china.bounds = mergeBounds(china.bounds, taiwan.bounds);
            china.name = "中国";
          }
          setCountries(projected.filter((country) => country.code !== "TW"));
        })
        .catch(() => {
          if (!cancelled) setLoadError(true);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      fetch("/data/country-city-counts.json")
        .then((response) => {
          if (!response.ok) throw new Error("City catalog unavailable");
          return response.json() as Promise<CityCatalog>;
        })
        .then((catalog) => {
          if (!cancelled) setCityCatalog(catalog);
        })
        .catch(() => {
          if (!cancelled) setCityCatalog(null);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      if (
        !activeCountry ||
        !SUBDIVISION_COUNTRIES.has(activeCountry.code)
      ) {
        setSubdivisions([]);
        setSubdivisionLabel("");
        return () => {
          cancelled = true;
        };
      }

      setSubdivisions([]);
      setSubdivisionLabel("");
      fetch(`/data/country-subdivisions/${activeCountry.code}.geojson`)
        .then((response) => {
          if (!response.ok) throw new Error("Subdivision map unavailable");
          return response.json() as Promise<SubdivisionCollection>;
        })
        .then((collection) => {
          if (cancelled) return;
          setSubdivisions(
            collection.features.map((feature, index) => ({
              id: feature.properties.id || `${activeCountry.code}-${index}`,
              path: geometryPath(feature.geometry),
            })),
          );
          setSubdivisionLabel(collection.boundaryLabel ?? "行政区");
        })
        .catch(() => {
          if (cancelled) return;
          setSubdivisions([]);
          setSubdivisionLabel("");
        });

      return () => {
        cancelled = true;
      };
    }, [activeCountry]);

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

    const activeCatalogCities = activeCountry
      ? cityCatalog?.counts[activeCountry.code] ?? 0
      : 0;
    const isChinaProvinceScope = activeCountry?.code === "CN";
    const visitedChinaProvinces = useMemo(
      () =>
        new Set(
          visits
            .filter((visit) => visit.countryCode === "CN")
            .map(chinaProvinceKey)
            .filter(Boolean),
        ).size,
      [visits],
    );
    const activeCoverageVisited = isChinaProvinceScope
      ? visitedChinaProvinces
      : cityAggregates.length;
    const activeCoverageTotal = isChinaProvinceScope
      ? subdivisions.length || CHINA_PROVINCE_TOTAL
      : activeCatalogCities;
    const coverageLabel = formatCoverage(
      activeCoverageVisited,
      activeCoverageTotal,
    );

    const worldBadges = useMemo(() => {
      const occupied: Array<{ x: number; y: number; width: number }> = [];
      return countryMetrics
        .map((metric) => {
          const country = countryByCode.get(metric.code);
          if (!country) return null;
          const badgeWidth = Math.max(78, metric.name.length * 12 + 34);
          const width = badgeWidth + 17;
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
          return {
            metric,
            country,
            badgeWidth,
            x: country.labelX,
            y,
          };
        })
        .filter(
          (
            badge,
          ): badge is {
            metric: CountryMetric;
            country: ProjectedCountry;
            badgeWidth: number;
            x: number;
            y: number;
          } => Boolean(badge),
        );
    }, [countryByCode, countryMetrics]);

    // Marker artwork counter-scales around its exact geographic anchor. The
    // anchor itself stays in the map's SVG coordinate system at every zoom.
    const markerScale = clamp(viewBox.width / MAP_WIDTH, 0.085, 1);

    return (
      <div
        className="static-atlas-map"
        role="region"
        aria-label="晃悠双视图旅行地图"
        data-map-mode={activeCountry ? "country" : "world"}
      >
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={
            activeCountry
              ? `${activeCountry.name}${activeCountry.code === "CN" ? "省级" : "城市"}地图`
              : "全球国家地图"
          }
        >
          <defs>
            <linearGradient id="country-heat-1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffe56f" />
              <stop offset="100%" stopColor="#ffae45" />
            </linearGradient>
            <linearGradient id="country-heat-2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff9fc1" />
              <stop offset="100%" stopColor="#ff4f7b" />
            </linearGradient>
            <linearGradient id="country-heat-3" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9b78ff" />
              <stop offset="100%" stopColor="#6b3dff" />
            </linearGradient>
            <linearGradient id="country-heat-4" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#43266f" />
              <stop offset="100%" stopColor="#1d1537" />
            </linearGradient>
            <pattern
              id="atlas-grid"
              width="38"
              height="38"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 38 0 L 0 0 0 38" fill="none" stroke="#241a4f" strokeOpacity=".075" />
            </pattern>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="static-atlas-ocean" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#atlas-grid)" />

          <g className="static-atlas-countries">
            {countries.map((country) => {
              const metric = metricByCode.get(country.code);
              const isActive = activeCountry?.code === country.code;
              const isDimmed = Boolean(activeCountry && !isActive);
              const canEnterCountry = !activeCountry;
              const activate = () => {
                if (!canEnterCountry) return;
                onCountrySelect({ code: country.code, name: country.name });
              };
              return (
                <path
                  key={country.code}
                  d={country.path}
                  role={canEnterCountry ? "button" : undefined}
                  tabIndex={canEnterCountry ? 0 : undefined}
                  aria-label={canEnterCountry ? `进入${country.name}` : undefined}
                  className={[
                    "static-country-shape",
                    metric ? `is-visited heat-${metric.heatLevel}` : "",
                    isActive ? "is-active" : "",
                    isDimmed ? "is-dimmed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  fillRule="evenodd"
                  style={{
                    fill: countryFill(metric?.heatLevel, isActive),
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (canEnterCountry) activate();
                  }}
                  onKeyDown={
                    canEnterCountry
                      ? (event) => keyboardActivate(event, activate)
                      : undefined
                  }
                >
                  <title>
                    {metric
                      ? `${country.name} · ${metric.cityCount} 座城市 · ${metric.landmarkCount} 个景点`
                      : country.name}
                  </title>
                </path>
              );
            })}
          </g>

          {activeCountry && subdivisions.length > 0 ? (
            <g
              className="static-subdivision-boundaries"
              aria-hidden="true"
            >
              {subdivisions.map((subdivision) => (
                <path
                  key={subdivision.id}
                  d={subdivision.path}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          ) : null}

          {!activeCountry ? (
            <g className="static-country-badges" aria-label="已去国家标签">
              {worldBadges.map(
                ({ metric, country, badgeWidth, x, y }) => (
                  <g
                    key={metric.code}
                    className={`static-country-badge heat-${metric.heatLevel}`}
                    transform={`translate(${x} ${y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${metric.name}，${metric.cityCount}座城市，${metric.landmarkCount}个景点`}
                    onClick={() =>
                      onCountrySelect({
                        code: metric.code,
                        name: metric.name,
                      })
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
                      <rect
                        x="17"
                        y="-15"
                        width={badgeWidth}
                        height="30"
                        rx="10"
                      />
                      <text x="28" y="-2" className="badge-name">
                        {metric.name}
                      </text>
                      <text x="28" y="10" className="badge-meta">
                        {metric.cityCount} 城 · {metric.landmarkCount} 景点
                      </text>
                    </g>
                  </g>
                ),
              )}
            </g>
          ) : (
            <g className="static-city-layer" aria-label={`${activeCountry.name}城市节点`}>
              {cityAggregates.map((aggregate) => {
                const point = projectCoordinate(
                  aggregate.city.longitude,
                  aggregate.city.latitude,
                );
                const labelWidth = Math.max(
                  76,
                  aggregate.city.name.length * 13 + 48,
                );
                return (
                  <g
                    key={visitKey(aggregate.city)}
                    className="static-city-marker is-visited"
                    transform={`translate(${point.x} ${point.y}) scale(${markerScale})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`修改${aggregate.city.name}的到访记录`}
                    onClick={() => onCityEdit(aggregate.city)}
                    onKeyDown={(event) =>
                      keyboardActivate(event, () => onCityEdit(aggregate.city))
                    }
                  >
                    <circle className="city-halo" r="16" />
                    <circle className="city-sequence" r="11" />
                    <text className="city-number" textAnchor="middle" y="4">
                      {aggregate.sequence}
                    </text>
                    <line x1="12" y1="0" x2="20" y2="0" />
                    <rect
                      className="city-label-card"
                      x="20"
                      y="-18"
                      width={labelWidth}
                      height="36"
                      rx="10"
                    />
                    <text x="30" y="-2" className="city-label-name">
                      {aggregate.city.name}
                    </text>
                    <text x="30" y="11" className="city-label-meta">
                      {aggregate.travelType} · {aggregate.landmarks}景
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
                      width={Math.max(52, city.name.length * 12 + 20)}
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

        {activeCountry ? (
          <section
            className="static-atlas-coverage"
            data-testid="map-coverage"
            data-coverage-scope={
              isChinaProvinceScope ? "province" : "country"
            }
            aria-label={`${activeCountry.name}${isChinaProvinceScope ? "省级区域" : "城市"}覆盖率`}
          >
            <header>
              <span>
                {activeCountry.name} ·{" "}
                {isChinaProvinceScope
                  ? "PROVINCE COVERAGE"
                  : "CITY COVERAGE"}
              </span>
              <strong>{coverageLabel}</strong>
            </header>

            <div className="static-atlas-coverage-metrics">
              {isChinaProvinceScope ? (
                <>
                  <span>
                    <b>
                      {visitedChinaProvinces} /{" "}
                      {activeCoverageTotal.toLocaleString("zh-CN")}
                    </b>
                    省级区域 · PROVINCES
                  </span>
                  <span>
                    <b>{cityAggregates.length.toLocaleString("zh-CN")}</b>
                    已去城市 · CITIES
                  </span>
                </>
              ) : (
                <>
                  <span>
                    <b>
                      {cityAggregates.length.toLocaleString("zh-CN")} /{" "}
                      {activeCatalogCities
                        ? activeCatalogCities.toLocaleString("zh-CN")
                        : "—"}
                    </b>
                    收录城市 · CITIES
                  </span>
                  {subdivisions.length > 0 ? (
                    <span>
                      <b>{subdivisions.length.toLocaleString("zh-CN")}</b>
                      {subdivisionLabel}边界
                    </span>
                  ) : null}
                </>
              )}
            </div>

            <small>
              {isChinaProvinceScope
                ? "省级口径：34 个省级行政区 · GEOBOUNDARIES"
                : "城市口径：人口 > 15,000 或行政首府 · GEONAMES"}
              {!isChinaProvinceScope && subdivisions.length > 0
                ? " · BOUNDARIES: GEOBOUNDARIES"
                : ""}
            </small>
          </section>
        ) : null}

        <div className="static-map-mode-note">
          <strong>
            {activeCountry
              ? `${activeCountry.name} · ${isChinaProvinceScope ? "PROVINCES" : "CITIES"}`
              : "全球 · THE WORLD"}
          </strong>
          <span>
            {activeCountry
              ? isChinaProvinceScope
                ? "按省浏览，城市节点仍可修改 · TAP A CITY TO EDIT"
                : "点击去过的城市即可修改 · TAP A CITY TO EDIT"
              : "颜色越深，这块地越熟 · DEEPER MEANS MORE"}
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
