"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  WheelEvent,
} from "react";
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

export const STATIC_ATLAS_WIDTH = 1400;
export const STATIC_ATLAS_HEIGHT = 760;
const MAP_WIDTH = STATIC_ATLAS_WIDTH;
const MAP_HEIGHT = STATIC_ATLAS_HEIGHT;
const MAP_ASPECT = MAP_WIDTH / MAP_HEIGHT;
// Put the map seam in the Atlantic so the reading order becomes
// Europe → Asia / China → the Americas.
const MAP_WEST_LONGITUDE = -30;
const MIN_LATITUDE = -58;
const MAX_LATITUDE = 84;
const MIN_VIEWBOX_WIDTH = 42;

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

type PointerDrag = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewBox: ViewBox;
};

type CityCatalog = {
  source: string;
  definition: string;
  attribution: string;
  total: number;
  counts: Record<string, number>;
};

type CapitalCatalog = {
  source: string;
  sourceUrl: string;
  attribution: string;
  countryCount: number;
  capitals: Record<
    string,
    Array<{
      name: string;
      englishName: string;
      longitude: number;
      latitude: number;
    }>
  >;
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

type CountryLabelItem = {
  key: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
};

type CountryLabelPlacement = {
  x: number;
  y: number;
  lineX1: number;
  lineY1: number;
  lineX2: number;
  lineY2: number;
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

function mapLongitude(longitude: number) {
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized < MAP_WEST_LONGITUDE ? normalized + 360 : normalized;
}

export function projectCoordinate(longitude: number, latitude: number) {
  return {
    x:
      ((mapLongitude(longitude) - MAP_WEST_LONGITUDE) / 360) *
      MAP_WIDTH,
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
  let previousMappedLongitude: number | null = null;
  let segmentOpen = false;

  ring.forEach(([longitude, latitude]) => {
    const mappedLongitude = mapLongitude(longitude);
    const point = projectCoordinate(longitude, latitude);
    const crossesMapSeam =
      previousMappedLongitude !== null &&
      Math.abs(mappedLongitude - previousMappedLongitude) > 180;

    if (!segmentOpen || crossesMapSeam) {
      if (segmentOpen) path += " Z";
      path += ` M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      segmentOpen = true;
    } else {
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }
    previousMappedLongitude = mappedLongitude;
  });

  return segmentOpen ? `${path} Z` : path;
}

export function geometryPath(geometry: AtlasGeometry) {
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

function fitCountryBounds(bounds: ProjectedBounds) {
  return fitBounds(bounds, 105, 0.08);
}

function labelConnector(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const lineX2 = clamp(0, x, x + width);
  const lineY2 = clamp(0, y, y + height);
  const distance = Math.hypot(lineX2, lineY2) || 1;

  return {
    lineX1: (lineX2 / distance) * 12,
    lineY1: (lineY2 / distance) * 12,
    lineX2,
    lineY2,
  };
}

function placeCountryLabels(
  items: CountryLabelItem[],
  markerScale: number,
  viewBox: ViewBox,
) {
  const occupied: Array<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }> = [];
  const placements = new Map<string, CountryLabelPlacement>();
  const gap = 7;
  const viewport = {
    minX: viewBox.x / markerScale + 12,
    minY: viewBox.y / markerScale + 12,
    maxX: (viewBox.x + viewBox.width) / markerScale - 12,
    maxY: (viewBox.y + viewBox.height) / markerScale - 12,
  };

  items.forEach((item) => {
    const { width, height } = item;
    const compactCandidates = [
      { x: 22, y: -height / 2 },
      { x: 30, y: -height - 10 },
      { x: 30, y: 10 },
      { x: -width - 22, y: -height / 2 },
      { x: -width - 30, y: -height - 10 },
      { x: -width - 30, y: 10 },
      { x: -width / 2, y: -height - 24 },
      { x: -width / 2, y: 24 },
      { x: 48, y: -height / 2 },
      { x: -width - 48, y: -height / 2 },
      { x: 48, y: -height - 28 },
      { x: -width - 48, y: 28 },
    ];
    const radialCandidates = Array.from({ length: 48 }, (_, index) => {
      const ring = Math.floor(index / 8);
      const angle = ((index % 8) / 8) * Math.PI * 2;
      const distance = 72 + ring * 24;
      return {
        x: Math.cos(angle) * distance - width / 2,
        y: Math.sin(angle) * distance - height / 2,
      };
    });
    const candidates = [...compactCandidates, ...radialCandidates];
    const anchorX = item.anchorX / markerScale;
    const anchorY = item.anchorY / markerScale;
    let chosen = candidates.find((candidate) => {
      const box = {
        minX: anchorX + candidate.x - gap,
        minY: anchorY + candidate.y - gap,
        maxX: anchorX + candidate.x + width + gap,
        maxY: anchorY + candidate.y + height + gap,
      };
      const insideViewport =
        box.minX >= viewport.minX &&
        box.maxX <= viewport.maxX &&
        box.minY >= viewport.minY &&
        box.maxY <= viewport.maxY;
      return (
        insideViewport &&
        occupied.every(
          (other) =>
            box.maxX < other.minX ||
            box.minX > other.maxX ||
            box.maxY < other.minY ||
            box.minY > other.maxY,
        )
      );
    });

    if (!chosen) {
      chosen = {
        x:
          clamp(
            anchorX + 22,
            viewport.minX + gap,
            viewport.maxX - width - gap,
          ) - anchorX,
        y:
          clamp(
            anchorY - height / 2,
            viewport.minY + gap,
            viewport.maxY - height - gap,
          ) - anchorY,
      };
    }

    occupied.push({
      minX: anchorX + chosen.x - gap,
      minY: anchorY + chosen.y - gap,
      maxX: anchorX + chosen.x + width + gap,
      maxY: anchorY + chosen.y + height + gap,
    });
    placements.set(item.key, {
      x: chosen.x,
      y: chosen.y,
      ...labelConnector(chosen.x, chosen.y, width, height),
    });
  });

  return placements;
}

function zoomViewBox(current: ViewBox, factor: number): ViewBox {
  const width = clamp(current.width * factor, MIN_VIEWBOX_WIDTH, MAP_WIDTH);
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

function zoomViewBoxAt(
  current: ViewBox,
  factor: number,
  anchor: { x: number; y: number },
): ViewBox {
  const width = clamp(current.width * factor, MIN_VIEWBOX_WIDTH, MAP_WIDTH);
  const height = width / MAP_ASPECT;
  const anchorRatioX = clamp((anchor.x - current.x) / current.width, 0, 1);
  const anchorRatioY = clamp((anchor.y - current.y) / current.height, 0, 1);

  return {
    x: clamp(anchor.x - anchorRatioX * width, 0, MAP_WIDTH - width),
    y: clamp(anchor.y - anchorRatioY * height, 0, MAP_HEIGHT - height),
    width,
    height,
  };
}

function panViewBox(current: ViewBox, deltaX: number, deltaY: number) {
  return {
    ...current,
    x: clamp(current.x + deltaX, 0, MAP_WIDTH - current.width),
    y: clamp(current.y + deltaY, 0, MAP_HEIGHT - current.height),
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
    const [capitalCatalog, setCapitalCatalog] =
      useState<CapitalCatalog | null>(null);
    const [isCompactViewport, setIsCompactViewport] = useState(false);
    const [compactViewportWidth, setCompactViewportWidth] = useState(880);
    const [subdivisions, setSubdivisions] = useState<ProjectedSubdivision[]>(
      [],
    );
    const [viewBox, setViewBox] = useState<ViewBox>(WORLD_VIEW);
    const [loadError, setLoadError] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const pointerDragRef = useRef<PointerDrag | null>(null);

    useEffect(() => {
      const media = window.matchMedia("(max-width: 880px)");
      const updateViewport = () => {
        setIsCompactViewport(media.matches);
        setCompactViewportWidth(window.innerWidth);
      };
      updateViewport();
      media.addEventListener("change", updateViewport);
      window.addEventListener("resize", updateViewport);
      return () => {
        media.removeEventListener("change", updateViewport);
        window.removeEventListener("resize", updateViewport);
      };
    }, []);

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
      fetch("/data/world-capitals.json")
        .then((response) => {
          if (!response.ok) throw new Error("Capital catalog unavailable");
          return response.json() as Promise<CapitalCatalog>;
        })
        .then((catalog) => {
          if (!cancelled) setCapitalCatalog(catalog);
        })
        .catch(() => {
          if (!cancelled) setCapitalCatalog(null);
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
        return () => {
          cancelled = true;
        };
      }

      setSubdivisions([]);
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
        })
        .catch(() => {
          if (cancelled) return;
          setSubdivisions([]);
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
      if (country) setViewBox(fitCountryBounds(country.bounds));
    }, [activeCountry, countries.length, countryByCode]);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          const country = activeCountry
            ? countryByCode.get(activeCountry.code)
            : null;
          setViewBox(country ? fitCountryBounds(country.bounds) : WORLD_VIEW);
        },
        zoomIn() {
          setViewBox((current) => zoomViewBox(current, 0.72));
        },
        zoomOut() {
          setViewBox((current) => zoomViewBox(current, 1.38));
        },
        focusCountry(countryCode) {
          const country = countryByCode.get(countryCode);
          if (country) setViewBox(fitCountryBounds(country.bounds));
        },
      }),
      [activeCountry, countryByCode],
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

    const countrySuggestions = useMemo(() => {
      if (!activeCountry) return [];
      if (cityAggregates.length === 0) {
        return (capitalCatalog?.capitals[activeCountry.code] ?? []).map(
          (capital, index): CityCandidate => ({
            id: `capital-${activeCountry.code}-${index}`,
            name: capital.name,
            country: activeCountry.name,
            countryCode: activeCountry.code,
            region: "首都",
            subtitle: `首都 · ${activeCountry.name}`,
            longitude: capital.longitude,
            latitude: capital.latitude,
            bbox: [
              capital.longitude - 0.18,
              capital.latitude - 0.14,
              capital.longitude + 0.18,
              capital.latitude + 0.14,
            ],
          }),
        );
      }
      return featuredCities.filter(
        (city) =>
          city.countryCode === activeCountry.code &&
          !visitedCityKeys.has(visitKey(city)),
      );
    }, [
      activeCountry,
      capitalCatalog,
      cityAggregates.length,
      featuredCities,
      visitedCityKeys,
    ]);

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
      const occupied: Array<{ x: number; y: number }> = [];
      return countryMetrics
        .map((metric) => {
          const country = countryByCode.get(metric.code);
          if (!country) return null;
          const badgeWidth = Math.max(78, metric.name.length * 12 + 34);
          const offsets = [0, -32, 32, -64, 64, -96, 96];
          const offset = offsets.find((candidateOffset) =>
            occupied.every(
              (placed) =>
                Math.hypot(
                  placed.x - country.labelX,
                  placed.y - (country.labelY + candidateOffset),
                ) > 31,
            ),
          );
          const y = country.labelY + (offset ?? 112);
          occupied.push({ x: country.labelX, y });
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
    const baseMarkerScale = clamp(viewBox.width / MAP_WIDTH, 0.085, 1);
    const compactMarkerScale =
      (viewBox.width / Math.max(compactViewportWidth, 320)) *
      (activeCountry ? 1 : 0.67);
    const markerScale = isCompactViewport
      ? compactMarkerScale
      : baseMarkerScale;
    const activeCountryNameScale =
      baseMarkerScale * (isCompactViewport ? 1.12 : 1);
    const activeProjectedCountry = activeCountry
      ? countryByCode.get(activeCountry.code)
      : null;
    const countryLabelPlacements = useMemo(() => {
      if (!activeCountry) return new Map<string, CountryLabelPlacement>();

      const visitedLabels: CountryLabelItem[] = cityAggregates.map(
        (aggregate) => {
          const point = projectCoordinate(
            aggregate.city.longitude,
            aggregate.city.latitude,
          );
          return {
            key: `visited:${visitKey(aggregate.city)}`,
            anchorX: point.x,
            anchorY: point.y,
            width: Math.max(76, aggregate.city.name.length * 13 + 48),
            height: 36,
          };
        },
      );
      const suggestionLabels: CountryLabelItem[] = countrySuggestions.map(
        (city) => {
          const point = projectCoordinate(city.longitude, city.latitude);
          const label = city.id.startsWith("capital-")
            ? `首都 · ${city.name}`
            : city.name;
          return {
            key: `suggestion:${city.id}`,
            anchorX: point.x,
            anchorY: point.y,
            width: Math.max(52, label.length * 12 + 20),
            height: 26,
          };
        },
      );

      return placeCountryLabels(
        [...visitedLabels, ...suggestionLabels],
        markerScale,
        viewBox,
      );
    }, [
      activeCountry,
      cityAggregates,
      countrySuggestions,
      markerScale,
      viewBox,
    ]);

    function clientToMapPoint(
      clientX: number,
      clientY: number,
      current: ViewBox,
    ) {
      const svg = svgRef.current;
      if (!svg) {
        return {
          x: current.x + current.width / 2,
          y: current.y + current.height / 2,
        };
      }
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(
        rect.width / current.width,
        rect.height / current.height,
      );
      if (!Number.isFinite(scale) || scale <= 0) {
        return {
          x: current.x + current.width / 2,
          y: current.y + current.height / 2,
        };
      }
      const renderedWidth = current.width * scale;
      const renderedHeight = current.height * scale;
      const offsetX = (rect.width - renderedWidth) / 2;
      const offsetY = (rect.height - renderedHeight) / 2;
      return {
        x: clamp(
          current.x + (clientX - rect.left - offsetX) / scale,
          current.x,
          current.x + current.width,
        ),
        y: clamp(
          current.y + (clientY - rect.top - offsetY) / scale,
          current.y,
          current.y + current.height,
        ),
      };
    }

    function handleMapDoubleClick(event: MouseEvent<SVGSVGElement>) {
      const target = event.target as Element;
      if (target.closest('[role="button"]')) return;
      event.preventDefault();
      setViewBox((current) =>
        zoomViewBoxAt(
          current,
          0.58,
          clientToMapPoint(event.clientX, event.clientY, current),
        ),
      );
    }

    function handleMapPointerDown(event: PointerEvent<SVGSVGElement>) {
      if (event.button !== 0) return;
      const target = event.target as Element;
      if (target.closest('[role="button"]')) return;
      pointerDragRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewBox: viewBox,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }

    function handleMapPointerMove(event: PointerEvent<SVGSVGElement>) {
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const scale = Math.min(
        rect.width / drag.startViewBox.width,
        rect.height / drag.startViewBox.height,
      );
      if (!Number.isFinite(scale) || scale <= 0) return;
      const deltaX = (drag.startClientX - event.clientX) / scale;
      const deltaY = (drag.startClientY - event.clientY) / scale;
      setViewBox(
        panViewBox(drag.startViewBox, deltaX, deltaY),
      );
    }

    function finishMapDrag(event: PointerEvent<SVGSVGElement>) {
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      pointerDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsDragging(false);
    }

    function handleMapWheel(event: WheelEvent<SVGSVGElement>) {
      event.preventDefault();
      if (event.ctrlKey) {
        const zoomFactor = clamp(Math.exp(event.deltaY * 0.006), 0.72, 1.38);
        setViewBox((current) =>
          zoomViewBoxAt(
            current,
            zoomFactor,
            clientToMapPoint(event.clientX, event.clientY, current),
          ),
        );
        return;
      }

      setViewBox((current) => {
        const svg = svgRef.current;
        if (!svg) return current;
        const rect = svg.getBoundingClientRect();
        const scale = Math.min(
          rect.width / current.width,
          rect.height / current.height,
        );
        if (!Number.isFinite(scale) || scale <= 0) return current;
        const deltaMultiplier =
          event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
        return panViewBox(
          current,
          (event.deltaX * deltaMultiplier) / scale,
          (event.deltaY * deltaMultiplier) / scale,
        );
      });
    }

    return (
      <div
        className={`static-atlas-map ${isDragging ? "is-dragging" : ""}`}
        role="region"
        aria-label="晃悠双视图旅行地图"
        data-map-mode={activeCountry ? "country" : "world"}
        data-can-pan={viewBox.width < MAP_WIDTH ? "true" : "false"}
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          onDoubleClick={handleMapDoubleClick}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={finishMapDrag}
          onPointerCancel={finishMapDrag}
          onWheel={handleMapWheel}
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

          {activeCountry && activeProjectedCountry ? (
            <g
              className="static-active-country-label"
              transform={`translate(${activeProjectedCountry.labelX} ${activeProjectedCountry.labelY}) scale(${activeCountryNameScale})`}
              aria-hidden="true"
            >
              <text className="static-active-country-name" textAnchor="middle">
                {activeCountry.name}
              </text>
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
                      <rect
                        className="badge-hit-target"
                        x="-24"
                        y="-36"
                        width={badgeWidth + 66}
                        height="72"
                        rx="20"
                      />
                      <line
                        x1="0"
                        y1="0"
                        x2={(country.labelX - x) / markerScale}
                        y2={(country.labelY - y) / markerScale}
                      />
                      <circle className="badge-count-dot" r="13" />
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
                const placement =
                  countryLabelPlacements.get(
                    `visited:${visitKey(aggregate.city)}`,
                  ) ?? {
                    x: 22,
                    y: -18,
                    ...labelConnector(22, -18, labelWidth, 36),
                  };
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
                    <circle className="city-hit-target" r="22" />
                    <circle className="city-halo" r="13" />
                    <circle className="city-sequence" r="9" />
                    <text className="city-number" textAnchor="middle" y="4">
                      {aggregate.sequence}
                    </text>
                    <line
                      x1={placement.lineX1}
                      y1={placement.lineY1}
                      x2={placement.lineX2}
                      y2={placement.lineY2}
                    />
                    <rect
                      className="city-label-card"
                      x={placement.x}
                      y={placement.y}
                      width={labelWidth}
                      height="36"
                      rx="10"
                    />
                    <text
                      x={placement.x + 10}
                      y={placement.y + 16}
                      className="city-label-name"
                    >
                      {aggregate.city.name}
                    </text>
                    <text
                      x={placement.x + 10}
                      y={placement.y + 29}
                      className="city-label-meta"
                    >
                      {aggregate.travelType} · {aggregate.landmarks}景
                    </text>
                  </g>
                );
              })}

              {countrySuggestions.map((city) => {
                const point = projectCoordinate(city.longitude, city.latitude);
                const activate = () => onCityOpen(city);
                const isCapital = city.id.startsWith("capital-");
                const label = isCapital ? `首都 · ${city.name}` : city.name;
                const labelWidth = Math.max(
                  52,
                  label.length * 12 + 20,
                );
                const placement =
                  countryLabelPlacements.get(`suggestion:${city.id}`) ?? {
                    x: 18,
                    y: -13,
                    ...labelConnector(18, -13, labelWidth, 26),
                  };
                return (
                  <g
                    key={city.id}
                    className={`static-city-marker is-suggestion ${isCapital ? "is-capital" : ""}`}
                    transform={`translate(${point.x} ${point.y}) scale(${markerScale})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${isCapital ? "添加首都" : "添加城市"} ${city.name}`}
                    onClick={activate}
                    onKeyDown={(event) => keyboardActivate(event, activate)}
                  >
                    <circle className="city-hit-target" r="22" />
                    <circle className="city-suggestion-dot" r="4.5" />
                    {isCapital ? (
                      <circle className="city-capital-ring" r="8.5" />
                    ) : null}
                    <line
                      x1={placement.lineX1}
                      y1={placement.lineY1}
                      x2={placement.lineX2}
                      y2={placement.lineY2}
                    />
                    <rect
                      className="city-suggestion-card"
                      x={placement.x}
                      y={placement.y}
                      width={labelWidth}
                      height="26"
                      rx="9"
                    />
                    <text
                      x={placement.x + 11}
                      y={placement.y + 17}
                      className="city-suggestion-name"
                    >
                      {label}
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
            data-attribution={
              isChinaProvinceScope ? "geoBoundaries" : "GeoNames"
            }
          >
            <header>
              <span>
                {activeCountry.name} ·{" "}
                {isChinaProvinceScope ? "省级覆盖" : "城市覆盖"}
              </span>
              <strong>{coverageLabel}</strong>
            </header>

            <div className="static-atlas-coverage-metrics">
              <span>
                <b>
                  {activeCoverageVisited.toLocaleString("zh-CN")} /{" "}
                  {activeCoverageTotal
                    ? activeCoverageTotal.toLocaleString("zh-CN")
                    : "—"}
                </b>
                {isChinaProvinceScope ? "到访省级区域" : "到访城市"}
              </span>
            </div>
          </section>
        ) : null}

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
