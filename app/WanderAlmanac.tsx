"use client";

import {
  ArrowLeft,
  Award,
  Check,
  Download,
  Globe2,
  Share2,
  Sparkles,
} from "lucide-react";
import { toBlob } from "html-to-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chinaProvinceKey,
  normalizeCountryName,
  travelTypeScore,
  type AtlasGeometry,
  type CityVisit,
} from "./atlas-data";
import type { CountryMetric } from "./StaticAtlasMap";
import {
  type CountryRegionMap,
  type EvaluatedRoamingTitle,
} from "./roaming-titles";

type WanderAlmanacProps = {
  visits: CityVisit[];
  countryMetrics: CountryMetric[];
  countryRegions: CountryRegionMap;
  primaryTitle: EvaluatedRoamingTitle;
  unlockedTitles: EvaluatedRoamingTitle[];
  onClose: () => void;
  onNotice: (message: string) => void;
};

type CountryCollection = {
  features?: Array<{
    properties?: {
      ISO_A2_EH?: string;
      ISO_A2?: string;
      NAME?: string;
      NAME_ZH?: string;
      ADMIN?: string;
    };
    geometry?: AtlasGeometry;
  }>;
};

type MosaicPolygon = {
  rings: number[][][];
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
};

type MosaicCountry = {
  code: string;
  name: string;
  polygons: MosaicPolygon[];
};

type MosaicChinaRegion = {
  id: string;
  name: string;
  polygons: MosaicPolygon[];
};

type MosaicTile = {
  key: string;
  column: number;
  row: number;
  visited: boolean;
  heatLevel?: CountryMetric["heatLevel"];
};

type ChinaSubdivisionCollection = {
  features?: Array<{
    properties?: {
      id?: string;
      name?: string;
    };
    geometry?: AtlasGeometry;
  }>;
};

type AlmanacDimension = "world" | "china";

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1200;
const WORLD_COUNTRY_TOTAL = 173;
const CHINA_PROVINCE_TOTAL = 34;
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 470;
const MAP_COLUMNS = 68;
const MAP_ROWS = 29;
const MAP_WEST_LONGITUDE = -30;
const MAP_MIN_LATITUDE = -58;
const MAP_MAX_LATITUDE = 84;
const CHINA_MAP_COLUMNS = 58;
const CHINA_MAP_ROWS = 31;
const CHINA_MAP_MIN_LONGITUDE = 72;
const CHINA_MAP_MAX_LONGITUDE = 136;
const CHINA_MAP_MIN_LATITUDE = 17;
const CHINA_MAP_MAX_LATITUDE = 54;

function cityKey(visit: Pick<CityVisit, "countryCode" | "name">) {
  return `${visit.countryCode}:${visit.name.trim().toLowerCase()}`;
}

function landmarkKey(visit: CityVisit, landmarkId: string) {
  return `${cityKey(visit)}:${landmarkId}`;
}

function formatCoverage(value: number) {
  if (value === 0) return "0%";
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

function mappedLongitude(longitude: number) {
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized < MAP_WEST_LONGITUDE ? normalized + 360 : normalized;
}

function longitudeForColumn(column: number) {
  const mapped =
    MAP_WEST_LONGITUDE + ((column + 0.5) / MAP_COLUMNS) * 360;
  return mapped > 180 ? mapped - 360 : mapped;
}

function latitudeForRow(row: number) {
  return (
    MAP_MAX_LATITUDE -
    ((row + 0.5) / MAP_ROWS) * (MAP_MAX_LATITUDE - MAP_MIN_LATITUDE)
  );
}

function pointInRing(
  longitude: number,
  latitude: number,
  ring: number[][],
) {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    const currentLongitude = currentPoint?.[0] ?? 0;
    const currentLatitude = currentPoint?.[1] ?? 0;
    const previousLongitude = previousPoint?.[0] ?? 0;
    const previousLatitude = previousPoint?.[1] ?? 0;
    const crossesLatitude =
      currentLatitude > latitude !== previousLatitude > latitude;
    const intersectionLongitude =
      ((previousLongitude - currentLongitude) *
        (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude || Number.EPSILON) +
      currentLongitude;

    if (crossesLatitude && longitude < intersectionLongitude) inside = !inside;
  }

  return inside;
}

function pointInPolygon(
  longitude: number,
  latitude: number,
  polygon: MosaicPolygon,
) {
  if (
    longitude < polygon.minLongitude ||
    longitude > polygon.maxLongitude ||
    latitude < polygon.minLatitude ||
    latitude > polygon.maxLatitude ||
    !pointInRing(longitude, latitude, polygon.rings[0] ?? [])
  ) {
    return false;
  }

  return !polygon.rings
    .slice(1)
    .some((ring) => pointInRing(longitude, latitude, ring));
}

function mosaicPolygons(geometry: AtlasGeometry) {
  const sourcePolygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);

  return sourcePolygons.map((rings) => {
    const points = rings.flat();
    const longitudes = points.map((point) => point[0] ?? 0);
    const latitudes = points.map((point) => point[1] ?? 0);
    return {
      rings,
      minLongitude: Math.min(...longitudes),
      maxLongitude: Math.max(...longitudes),
      minLatitude: Math.min(...latitudes),
      maxLatitude: Math.max(...latitudes),
    };
  });
}

function buildMosaicCountry(
  code: string,
  name: string,
  geometry: AtlasGeometry,
): MosaicCountry {
  return {
    code: code === "TW" ? "CN" : code,
    name: code === "TW" ? "中国" : name,
    polygons: mosaicPolygons(geometry),
  };
}

function buildMosaicChinaRegion(
  id: string,
  name: string,
  geometry: AtlasGeometry,
): MosaicChinaRegion {
  return {
    id,
    name,
    polygons: mosaicPolygons(geometry),
  };
}

function countryAtPoint(
  countries: MosaicCountry[],
  longitude: number,
  latitude: number,
) {
  return countries.find((country) =>
    country.polygons.some((polygon) =>
      pointInPolygon(longitude, latitude, polygon),
    ),
  );
}

function chinaRegionAtPoint(
  regions: MosaicChinaRegion[],
  longitude: number,
  latitude: number,
) {
  return regions.find((region) =>
    region.polygons.some((polygon) =>
      pointInPolygon(longitude, latitude, polygon),
    ),
  );
}

function heatForVisits(visits: CityVisit[]) {
  if (visits.length === 0) return undefined;
  const cityScores = new Map<string, number>();
  visits.forEach((visit) => {
    const key = cityKey(visit);
    cityScores.set(
      key,
      Math.max(
        cityScores.get(key) ?? 0,
        travelTypeScore(visit.travelType),
      ),
    );
  });
  const cityCount = cityScores.size;
  const hiddenScore = [...cityScores.values()].reduce(
    (total, score) => total + score,
    0,
  );
  if (cityCount >= 4 || hiddenScore >= 12) return 4 as const;
  if (cityCount >= 3 || hiddenScore >= 8) return 3 as const;
  if (cityCount >= 2 || hiddenScore >= 4) return 2 as const;
  return 1 as const;
}

function tileColor(heatLevel?: CountryMetric["heatLevel"]) {
  if (heatLevel === 4) return "#4f2ac5";
  if (heatLevel === 3) return "#ff4f78";
  if (heatLevel === 2) return "#ff9b42";
  if (heatLevel === 1) return "#d8ff56";
  return "#fff8e8";
}

function visitTilePosition(visit: CityVisit) {
  const column = Math.max(
    0,
    Math.min(
      MAP_COLUMNS - 1,
      Math.floor(
        ((mappedLongitude(visit.longitude) - MAP_WEST_LONGITUDE) / 360) *
          MAP_COLUMNS,
      ),
    ),
  );
  const row = Math.max(
    0,
    Math.min(
      MAP_ROWS - 1,
      Math.floor(
        ((MAP_MAX_LATITUDE - visit.latitude) /
          (MAP_MAX_LATITUDE - MAP_MIN_LATITUDE)) *
          MAP_ROWS,
      ),
    ),
  );
  return { column, row };
}

function chinaLongitudeForColumn(column: number) {
  return (
    CHINA_MAP_MIN_LONGITUDE +
    ((column + 0.5) / CHINA_MAP_COLUMNS) *
      (CHINA_MAP_MAX_LONGITUDE - CHINA_MAP_MIN_LONGITUDE)
  );
}

function chinaLatitudeForRow(row: number) {
  return (
    CHINA_MAP_MAX_LATITUDE -
    ((row + 0.5) / CHINA_MAP_ROWS) *
      (CHINA_MAP_MAX_LATITUDE - CHINA_MAP_MIN_LATITUDE)
  );
}

function chinaVisitTilePosition(visit: CityVisit) {
  const column = Math.max(
    0,
    Math.min(
      CHINA_MAP_COLUMNS - 1,
      Math.floor(
        ((visit.longitude - CHINA_MAP_MIN_LONGITUDE) /
          (CHINA_MAP_MAX_LONGITUDE - CHINA_MAP_MIN_LONGITUDE)) *
          CHINA_MAP_COLUMNS,
      ),
    ),
  );
  const row = Math.max(
    0,
    Math.min(
      CHINA_MAP_ROWS - 1,
      Math.floor(
        ((CHINA_MAP_MAX_LATITUDE - visit.latitude) /
          (CHINA_MAP_MAX_LATITUDE - CHINA_MAP_MIN_LATITUDE)) *
          CHINA_MAP_ROWS,
      ),
    ),
  );
  return { column, row };
}

function MosaicWorldMap({
  visits,
  countryMetrics,
  onReady,
}: {
  visits: CityVisit[];
  countryMetrics: CountryMetric[];
  onReady: (ready: boolean) => void;
}) {
  const [tiles, setTiles] = useState<MosaicTile[]>([]);
  const [loadError, setLoadError] = useState(false);
  const metricByCode = useMemo(
    () => new Map(countryMetrics.map((metric) => [metric.code, metric])),
    [countryMetrics],
  );
  const countryPins = useMemo(() => {
    const firstVisitByCountry = new Map<string, CityVisit>();
    visits.forEach((visit) => {
      if (!firstVisitByCountry.has(visit.countryCode)) {
        firstVisitByCountry.set(visit.countryCode, visit);
      }
    });
    return [...firstVisitByCountry.values()].map((visit) => ({
      ...visitTilePosition(visit),
      code: visit.countryCode,
      name: normalizeCountryName(visit.country, visit.countryCode),
      heatLevel: metricByCode.get(visit.countryCode)?.heatLevel ?? 1,
    }));
  }, [metricByCode, visits]);

  useEffect(() => {
    let cancelled = false;
    onReady(false);

    fetch("/data/world-countries.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("World map unavailable");
        return response.json() as Promise<CountryCollection>;
      })
      .then((collection) => {
        if (cancelled) return;
        const countries = (collection.features ?? [])
          .map((feature): MosaicCountry | null => {
            const rawCode = String(
              feature.properties?.ISO_A2_EH ??
                feature.properties?.ISO_A2 ??
                "",
            ).toUpperCase();
            if (
              !rawCode ||
              rawCode === "-99" ||
              rawCode === "AQ" ||
              !feature.geometry
            ) {
              return null;
            }
            const rawName = String(
              feature.properties?.NAME_ZH ??
                feature.properties?.NAME ??
                feature.properties?.ADMIN ??
                rawCode,
            );
            return buildMosaicCountry(
              rawCode,
              normalizeCountryName(rawName, rawCode),
              feature.geometry,
            );
          })
          .filter((country): country is MosaicCountry => Boolean(country));

        const nextTiles: MosaicTile[] = [];
        for (let row = 0; row < MAP_ROWS; row += 1) {
          for (let column = 0; column < MAP_COLUMNS; column += 1) {
            const country = countryAtPoint(
              countries,
              longitudeForColumn(column),
              latitudeForRow(row),
            );
            if (!country) continue;
            const metric = metricByCode.get(country.code);
            nextTiles.push({
              key: `${row}:${column}`,
              column,
              row,
              visited: Boolean(metric),
              heatLevel: metric?.heatLevel,
            });
          }
        }

        setTiles(nextTiles);
        setLoadError(false);
        onReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        onReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [metricByCode, onReady]);

  const tileWidth = MAP_WIDTH / MAP_COLUMNS;
  const tileHeight = MAP_HEIGHT / MAP_ROWS;

  return (
    <div className="wander-almanac-map">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label={`马赛克世界地图，已点亮 ${countryMetrics.length} 个国家`}
      >
        <defs>
          <pattern
            id="wander-pixel-ocean"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <rect width="22" height="22" fill="#8edee0" />
            <path
              d="M22 0H0V22"
              fill="none"
              stroke="#21143f"
              strokeOpacity=".055"
            />
          </pattern>
        </defs>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="28" fill="#8edee0" />
        <rect
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          rx="28"
          fill="url(#wander-pixel-ocean)"
        />

        <g className="wander-almanac-map-tiles">
          {tiles.map((tile) => (
            <rect
              key={tile.key}
              x={tile.column * tileWidth + 1.25}
              y={tile.row * tileHeight + 1.25}
              width={tileWidth - 2.5}
              height={tileHeight - 2.5}
              rx="2.2"
              fill={tileColor(tile.heatLevel)}
              opacity={
                tile.visited
                  ? 1
                  : (tile.column * 3 + tile.row * 7) % 13 === 0
                    ? 0.48
                    : 0.78
              }
              className={tile.visited ? "is-visited" : ""}
            />
          ))}
        </g>

        <g className="wander-almanac-map-pins">
          {countryPins.map((pin, index) => (
            <g
              key={pin.code}
              transform={`translate(${pin.column * tileWidth + tileWidth / 2} ${
                pin.row * tileHeight + tileHeight / 2
              })`}
            >
              <rect
                x={-tileWidth * 0.5}
                y={-tileHeight * 0.5}
                width={tileWidth}
                height={tileHeight}
                rx="2.5"
                fill={tileColor(pin.heatLevel)}
              />
              <rect
                x={-tileWidth * 0.66}
                y={-tileHeight * 0.66}
                width={tileWidth * 1.32}
                height={tileHeight * 1.32}
                rx="4"
                fill="none"
                stroke="#21143f"
                strokeWidth="2.5"
              />
              <title>{`${index + 1}. ${pin.name}`}</title>
            </g>
          ))}
        </g>
      </svg>

      {tiles.length === 0 && !loadError ? (
        <div className="wander-almanac-map-status">正在拼好你的像素地球</div>
      ) : null}
      {loadError ? (
        <div className="wander-almanac-map-status">
          地图暂时没拼好，请稍后再试。
        </div>
      ) : null}
    </div>
  );
}

function MosaicChinaMap({
  visits,
  onReady,
}: {
  visits: CityVisit[];
  onReady: (ready: boolean) => void;
}) {
  const [tiles, setTiles] = useState<MosaicTile[]>([]);
  const [loadError, setLoadError] = useState(false);
  const cityPins = useMemo(() => {
    const uniqueCities = new Map<string, CityVisit[]>();
    visits.forEach((visit) => {
      const key = cityKey(visit);
      uniqueCities.set(key, [...(uniqueCities.get(key) ?? []), visit]);
    });
    return [...uniqueCities.entries()].map(([key, cityVisits]) => {
      const visit = cityVisits[0]!;
      return {
        ...chinaVisitTilePosition(visit),
        key,
        name: visit.name,
        heatLevel: heatForVisits(cityVisits),
      };
    });
  }, [visits]);

  useEffect(() => {
    let cancelled = false;
    onReady(false);

    fetch("/data/country-subdivisions/CN.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("China map unavailable");
        return response.json() as Promise<ChinaSubdivisionCollection>;
      })
      .then((collection) => {
        if (cancelled) return;
        const regions = (collection.features ?? [])
          .map((feature, index): MosaicChinaRegion | null => {
            if (!feature.geometry) return null;
            return buildMosaicChinaRegion(
              feature.properties?.id ?? `cn-region-${index}`,
              feature.properties?.name ?? `区域 ${index + 1}`,
              feature.geometry,
            );
          })
          .filter((region): region is MosaicChinaRegion => Boolean(region));
        const heatByRegion = new Map<
          string,
          CountryMetric["heatLevel"] | undefined
        >();
        regions.forEach((region) => {
          const regionVisits = visits.filter((visit) =>
            region.polygons.some((polygon) =>
              pointInPolygon(visit.longitude, visit.latitude, polygon),
            ),
          );
          heatByRegion.set(region.id, heatForVisits(regionVisits));
        });

        const nextTiles: MosaicTile[] = [];
        for (let row = 0; row < CHINA_MAP_ROWS; row += 1) {
          for (let column = 0; column < CHINA_MAP_COLUMNS; column += 1) {
            const region = chinaRegionAtPoint(
              regions,
              chinaLongitudeForColumn(column),
              chinaLatitudeForRow(row),
            );
            if (!region) continue;
            const heatLevel = heatByRegion.get(region.id);
            nextTiles.push({
              key: `${row}:${column}`,
              column,
              row,
              visited: Boolean(heatLevel),
              heatLevel,
            });
          }
        }

        setTiles(nextTiles);
        setLoadError(false);
        onReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        onReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onReady, visits]);

  const tileWidth = MAP_WIDTH / CHINA_MAP_COLUMNS;
  const tileHeight = MAP_HEIGHT / CHINA_MAP_ROWS;

  return (
    <div className="wander-almanac-map wander-almanac-china-map">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label={`马赛克中国地图，已点亮 ${
          new Set(visits.map(chinaProvinceKey).filter(Boolean)).size
        } 个省级区域`}
      >
        <defs>
          <pattern
            id="wander-pixel-china-ocean"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <rect width="22" height="22" fill="#8edee0" />
            <path
              d="M22 0H0V22"
              fill="none"
              stroke="#21143f"
              strokeOpacity=".055"
            />
          </pattern>
        </defs>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="28" fill="#8edee0" />
        <rect
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          rx="28"
          fill="url(#wander-pixel-china-ocean)"
        />

        <g className="wander-almanac-map-tiles">
          {tiles.map((tile) => (
            <rect
              key={tile.key}
              x={tile.column * tileWidth + 1.25}
              y={tile.row * tileHeight + 1.25}
              width={tileWidth - 2.5}
              height={tileHeight - 2.5}
              rx="2.2"
              fill={tileColor(tile.heatLevel)}
              opacity={
                tile.visited
                  ? 1
                  : (tile.column * 5 + tile.row * 3) % 11 === 0
                    ? 0.48
                    : 0.8
              }
              className={tile.visited ? "is-visited" : ""}
            />
          ))}
        </g>

        <g className="wander-almanac-map-pins">
          {cityPins.map((pin, index) => (
            <g
              key={pin.key}
              transform={`translate(${pin.column * tileWidth + tileWidth / 2} ${
                pin.row * tileHeight + tileHeight / 2
              })`}
            >
              <rect
                x={-tileWidth * 0.42}
                y={-tileHeight * 0.42}
                width={tileWidth * 0.84}
                height={tileHeight * 0.84}
                rx="2.5"
                fill={tileColor(pin.heatLevel)}
              />
              <rect
                x={-tileWidth * 0.62}
                y={-tileHeight * 0.62}
                width={tileWidth * 1.24}
                height={tileHeight * 1.24}
                rx="4"
                fill="none"
                stroke="#21143f"
                strokeWidth="2.5"
              />
              <title>{`${index + 1}. ${pin.name}`}</title>
            </g>
          ))}
        </g>
      </svg>

      {tiles.length === 0 && !loadError ? (
        <div className="wander-almanac-map-status">正在拼好你的像素中国</div>
      ) : null}
      {loadError ? (
        <div className="wander-almanac-map-status">
          地图暂时没拼好，请稍后再试。
        </div>
      ) : null}
    </div>
  );
}

export default function WanderAlmanac({
  visits,
  countryMetrics,
  countryRegions,
  primaryTitle,
  unlockedTitles,
  onClose,
  onNotice,
}: WanderAlmanacProps) {
  const posterRef = useRef<HTMLElement | null>(null);
  const [dimension, setDimension] = useState<AlmanacDimension>("world");
  const [previewScale, setPreviewScale] = useState(1);
  const [mapReady, setMapReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");

  const chinaVisits = useMemo(
    () => visits.filter((visit) => visit.countryCode === "CN"),
    [visits],
  );
  const uniqueCities = useMemo(
    () => new Set(visits.map((visit) => cityKey(visit))),
    [visits],
  );
  const uniqueLandmarks = useMemo(
    () =>
      new Set(
        visits.flatMap((visit) =>
          visit.landmarks.map((landmark) => landmarkKey(visit, landmark.id)),
        ),
      ),
    [visits],
  );
  const continentCount = useMemo(
    () =>
      new Set(
        countryMetrics
          .map(
            (metric) =>
              countryRegions[metric.code]?.continent ||
              (metric.code === "TW"
                ? countryRegions.CN?.continent
                : undefined),
          )
          .filter(Boolean),
      ).size,
    [countryMetrics, countryRegions],
  );
  const yearRange = useMemo(() => {
    const years = [
      ...new Set(
        visits.map((visit) => visit.visitedOn.slice(0, 4)).filter(Boolean),
      ),
    ].sort();
    if (years.length <= 1) return years[0] ?? "NOW";
    return `${years[0]}—${years[years.length - 1]}`;
  }, [visits]);

  const stats = {
    continents: continentCount,
    countries: countryMetrics.length,
    cities: uniqueCities.size,
    landmarks: uniqueLandmarks.size,
  };
  const featuredTitles = useMemo(() => {
    const primary = unlockedTitles.find(
      (title) => title.id === primaryTitle.id,
    );
    const remaining = [...unlockedTitles]
      .filter((title) => title.id !== primary?.id)
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          right.title.localeCompare(left.title),
      );
    return [...(primary ? [primary] : []), ...remaining].slice(0, 3);
  }, [primaryTitle.id, unlockedTitles]);
  const chinaFeaturedTitles = useMemo(() => {
    const unlockedChinaTitles = [...unlockedTitles]
      .filter((title) => title.category === "china")
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          right.title.localeCompare(left.title),
      );
    const chosenChinaTitle =
      primaryTitle.category === "china"
        ? unlockedChinaTitles.find((title) => title.id === primaryTitle.id)
        : unlockedChinaTitles[0];
    const selected = [
      ...(chosenChinaTitle ? [chosenChinaTitle] : []),
      ...unlockedChinaTitles.filter(
        (title) => title.id !== chosenChinaTitle?.id,
      ),
    ].slice(0, 3);
    return selected.length ? selected : featuredTitles;
  }, [featuredTitles, primaryTitle.category, primaryTitle.id, unlockedTitles]);
  const chinaProvinceNames = useMemo(
    () =>
      [
        ...new Set(
          chinaVisits.map((visit) => chinaProvinceKey(visit)).filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right, "zh-CN")),
    [chinaVisits],
  );
  const chinaCities = useMemo(
    () => new Set(chinaVisits.map((visit) => cityKey(visit))),
    [chinaVisits],
  );
  const chinaLandmarks = useMemo(
    () =>
      new Set(
        chinaVisits.flatMap((visit) =>
          visit.landmarks.map((landmark) => landmarkKey(visit, landmark.id)),
        ),
      ),
    [chinaVisits],
  );
  const worldCoverage = formatCoverage(
    (stats.countries / WORLD_COUNTRY_TOTAL) * 100,
  );
  const chinaCoverage = formatCoverage(
    (chinaProvinceNames.length / CHINA_PROVINCE_TOTAL) * 100,
  );
  const countryNames = countryMetrics.map((metric) => metric.name).join(" · ");
  const activeTitles =
    dimension === "china" ? chinaFeaturedTitles : featuredTitles;
  const activeTitle = activeTitles[0] ?? primaryTitle;
  const activeCoverage =
    dimension === "china" ? chinaCoverage : worldCoverage;
  const displayStats: Array<[number, string]> =
    dimension === "china"
      ? [
          [chinaProvinceNames.length, "省级"],
          [chinaCities.size, "城市"],
          [chinaLandmarks.size, "景点"],
          [chinaVisits.length, "到访"],
        ]
      : [
          [stats.continents, "大洲"],
          [stats.countries, "国家"],
          [stats.cities, "城市"],
          [stats.landmarks, "景点"],
        ];
  const shareText =
    dimension === "china"
      ? `我的「${activeTitle.title}」中国晃悠地图：${chinaProvinceNames.length} 个省级区域 · ${chinaCities.size} 座城市 · ${chinaLandmarks.size} 个景点。这地球，我晃过。`
      : `我的「${primaryTitle.title}」晃悠地图：${stats.continents} 洲 · ${stats.countries} 国 · ${stats.cities} 城 · ${stats.landmarks} 个景点。这地球，我晃过。`;

  useEffect(() => {
    const updateScale = () => {
      const availableWidth = Math.max(320, window.innerWidth - 32);
      const toolbarHeight = window.innerWidth <= 720 ? 138 : 92;
      const availableHeight = Math.max(
        420,
        window.innerHeight - toolbarHeight - 48,
      );
      setPreviewScale(
        Math.min(
          1,
          availableWidth / POSTER_WIDTH,
          availableHeight / POSTER_HEIGHT,
        ),
      );
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exporting) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [exporting, onClose]);

  const handleMapReady = useCallback((ready: boolean) => {
    setMapReady(ready);
  }, []);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => {
      setFeedback((current) => (current === message ? "" : current));
    }, 2200);
  }

  function selectDimension(nextDimension: AlmanacDimension) {
    if (nextDimension === dimension || exporting) return;
    setMapReady(false);
    setCopied(false);
    setFeedback("");
    setDimension(nextDimension);
  }

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      showFeedback("分享文案已复制");
      onNotice("分享文案已复制");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showFeedback("浏览器没有允许复制，请稍后再试");
      onNotice("浏览器没有允许复制，请稍后再试");
    }
  }

  async function downloadPoster() {
    const poster = posterRef.current;
    if (!poster || exporting) return;
    setExporting(true);

    try {
      await document.fonts?.ready;
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve()),
        ),
      );
      const blob = await toBlob(poster, {
        backgroundColor: "#f7f0da",
        cacheBust: true,
        canvasHeight: POSTER_HEIGHT,
        canvasWidth: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        pixelRatio: 1,
        width: POSTER_WIDTH,
      });
      if (!blob) throw new Error("Poster rendering returned no image");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `我的晃悠地图${
        dimension === "china" ? "-中国" : ""
      }-${yearRange.replace("—", "-")}.png`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      showFeedback("晃悠地图已生成");
      onNotice("晃悠地图已生成");
    } catch {
      showFeedback("图片生成失败，请稍后重试");
      onNotice("图片生成失败，请稍后重试");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="wander-almanac-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wander-almanac-preview-title"
    >
      <header className="wander-almanac-toolbar">
        <button type="button" onClick={onClose}>
          <ArrowLeft size={17} />
          回到地图
        </button>
        <div>
          <small>SECOND DRAFT · 短版海报</small>
          <strong id="wander-almanac-preview-title">我的晃悠地图</strong>
          <nav
            className="wander-almanac-dimension-switch"
            aria-label="地图生成维度"
          >
            <button
              type="button"
              className={dimension === "world" ? "is-active" : ""}
              aria-pressed={dimension === "world"}
              disabled={exporting}
              onClick={() => selectDimension("world")}
            >
              全球
            </button>
            <button
              type="button"
              className={dimension === "china" ? "is-active" : ""}
              aria-pressed={dimension === "china"}
              disabled={exporting}
              onClick={() => selectDimension("china")}
            >
              中国
            </button>
          </nav>
        </div>
        <span className="wander-almanac-toolbar-actions">
          {feedback ? (
            <span className="wander-almanac-toolbar-feedback" role="status">
              <Check size={14} />
              {feedback}
            </span>
          ) : null}
          <button type="button" onClick={copyShareText}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? "已复制" : "复制文案"}
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={downloadPoster}
            disabled={exporting || !mapReady}
          >
            {exporting ? <Sparkles size={16} /> : <Download size={16} />}
            {exporting ? "正在生成" : "保存图片"}
          </button>
        </span>
      </header>

      <main className="wander-almanac-preview">
        <div
          className="wander-almanac-poster-scale"
          style={{ zoom: previewScale }}
        >
          <article className="wander-almanac-poster" ref={posterRef}>
            <header className="wander-almanac-poster-head">
              <span>
                <Globe2 size={20} />
                WANDER WIDE
              </span>
              <span>MY MAP · {yearRange}</span>
            </header>

            <section className="wander-almanac-hero">
              <h1>这地球，我晃过。</h1>

              {activeTitles.length ? (
                <div
                  className="wander-almanac-title-strip"
                  aria-label="我的晃悠称号"
                >
                  <header>
                    <span>我的晃悠称号</span>
                    <b>
                      {dimension === "china" ? "中国" : "地球"}点亮{" "}
                      {activeCoverage}
                    </b>
                  </header>
                  <div>
                    {activeTitles.map((title, index) => (
                      <span
                        className={`wander-almanac-title-chip tone-${title.tone}`}
                        key={title.id}
                      >
                        {index === 0 ? <Award size={24} /> : null}
                        <strong>{title.title}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="wander-almanac-stats" aria-label="足迹数字">
                {displayStats.map(([value, label]) => (
                  <div key={label}>
                    <strong>{String(value).padStart(2, "0")}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="wander-almanac-map-section">
              <header>
                <div>
                  <small>MY PIXEL WORLD</small>
                  <h2>我点亮的世界。</h2>
                </div>
                <span>
                  <i />
                  点亮代表去过
                </span>
              </header>

              {dimension === "china" ? (
                <MosaicChinaMap
                  visits={chinaVisits}
                  onReady={handleMapReady}
                />
              ) : (
                <MosaicWorldMap
                  visits={visits}
                  countryMetrics={countryMetrics}
                  onReady={handleMapReady}
                />
              )}

              <footer>
                {dimension === "china" ? (
                  <>
                    <span>
                      已点亮 <b>{chinaProvinceNames.length}</b> 个省级区域
                    </span>
                    <p>
                      {chinaProvinceNames.length
                        ? `${chinaProvinceNames.join(" · ")} · 地图不排名，只记得。`
                        : "等待第一块像素亮起来"}
                    </p>
                  </>
                ) : (
                  <>
                    <span>
                      已点亮 <b>{stats.countries}</b> 个国家
                    </span>
                    <p>
                      {countryNames
                        ? `${countryNames} · 地图不排名，只记得。`
                        : "等待第一块像素亮起来"}
                    </p>
                  </>
                )}
              </footer>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
