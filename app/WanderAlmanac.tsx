"use client";

import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
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
  dimension: AlmanacDimension;
  visits: CityVisit[];
  countryMetrics: CountryMetric[];
  countryRegions: CountryRegionMap;
  primaryTitle: EvaluatedRoamingTitle;
  unlockedTitles: EvaluatedRoamingTitle[];
  selectedTitles: EvaluatedRoamingTitle[];
  onToggleTitle: (titleId: string, title: string) => void;
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

export type AlmanacDimension = "world" | "china";

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1200;
const MAX_POSTER_TITLES = 3;
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
const CHINA_MAP_CONTENT_WIDTH = 645;
const CHINA_MAP_CONTENT_HEIGHT = 420;
const CHINA_MAP_OFFSET_X = (MAP_WIDTH - CHINA_MAP_CONTENT_WIDTH) / 2;
const CHINA_MAP_OFFSET_Y = (MAP_HEIGHT - CHINA_MAP_CONTENT_HEIGHT) / 2;
const SOUTH_CHINA_SEA_INSET_BOUNDS = {
  minLongitude: 107.5,
  maxLongitude: 122.5,
  minLatitude: 3,
  maxLatitude: 23.5,
} as const;
const SOUTH_CHINA_SEA_ISLAND_POINTS = [
  {
    id: "dongsha",
    label: "东沙群岛",
    shortLabel: "东沙",
    longitude: 116.72,
    latitude: 20.7,
    labelPosition: "left",
  },
  {
    id: "xisha",
    label: "西沙群岛",
    shortLabel: "西沙",
    longitude: 112.33,
    latitude: 16.83,
    labelPosition: "right",
  },
  {
    id: "zhongsha",
    label: "中沙群岛",
    shortLabel: "中沙",
    longitude: 114.45,
    latitude: 15.7,
    labelPosition: "below",
  },
  {
    id: "huangyan",
    label: "黄岩岛",
    shortLabel: "黄岩岛",
    longitude: 117.75,
    latitude: 15.15,
    labelPosition: "right",
  },
  {
    id: "nansha",
    label: "南沙群岛",
    shortLabel: "南沙",
    longitude: 113.9,
    latitude: 10.2,
    labelPosition: "left",
  },
  {
    id: "taiping",
    label: "太平岛",
    longitude: 114.37,
    latitude: 10.38,
  },
  {
    id: "yongshu",
    label: "永暑礁",
    longitude: 112.88,
    latitude: 9.55,
  },
  {
    id: "meiji",
    label: "美济礁",
    longitude: 115.53,
    latitude: 9.9,
  },
  {
    id: "renai",
    label: "仁爱礁",
    longitude: 115.85,
    latitude: 9.75,
  },
  {
    id: "xiyue-bei",
    label: "西月北岛",
    longitude: 115.0267,
    latitude: 11.085,
    currentName: true,
  },
  {
    id: "siling-sha",
    label: "司令沙岛",
    longitude: 115.2383,
    latitude: 8.3583,
    currentName: true,
  },
  {
    id: "yuzui",
    label: "鱼嘴礁",
    longitude: 116.6017,
    latitude: 9.7233,
    currentName: true,
  },
  {
    id: "zengmu",
    label: "曾母暗沙",
    shortLabel: "曾母暗沙",
    longitude: 112.27,
    latitude: 3.97,
    labelPosition: "right",
  },
] as const;
const SOUTH_CHINA_SEA_DASH_SEGMENTS = [
  { id: "northwest", longitude: 109.5, latitude: 18.3, rotation: 72 },
  { id: "west-upper", longitude: 108.8, latitude: 14.4, rotation: 82 },
  { id: "west-lower", longitude: 109.3, latitude: 9.8, rotation: 99 },
  { id: "southwest", longitude: 111.1, latitude: 5.5, rotation: 25 },
  { id: "south", longitude: 114.7, latitude: 4.3, rotation: -4 },
  { id: "southeast", longitude: 118.1, latitude: 6.6, rotation: -42 },
  { id: "east-lower", longitude: 120.1, latitude: 10.7, rotation: -76 },
  { id: "east-middle", longitude: 120.7, latitude: 15.1, rotation: -88 },
  { id: "east-upper", longitude: 120.3, latitude: 19.5, rotation: -106 },
] as const;

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

function southChinaSeaInsetPosition(longitude: number, latitude: number) {
  const {
    minLongitude,
    maxLongitude,
    minLatitude,
    maxLatitude,
  } = SOUTH_CHINA_SEA_INSET_BOUNDS;
  return {
    left: `${((longitude - minLongitude) / (maxLongitude - minLongitude)) * 100}%`,
    top: `${((maxLatitude - latitude) / (maxLatitude - minLatitude)) * 100}%`,
  };
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
              opacity={1}
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
                x={-tileWidth * 0.34}
                y={-tileHeight * 0.34}
                width={tileWidth * 0.68}
                height={tileHeight * 0.68}
                rx="2.5"
                fill={tileColor(pin.heatLevel)}
                stroke="#21143f"
                strokeWidth="1.5"
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

  const tileWidth = CHINA_MAP_CONTENT_WIDTH / CHINA_MAP_COLUMNS;
  const tileHeight = CHINA_MAP_CONTENT_HEIGHT / CHINA_MAP_ROWS;

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
              x={CHINA_MAP_OFFSET_X + tile.column * tileWidth + 1.1}
              y={CHINA_MAP_OFFSET_Y + tile.row * tileHeight + 1.1}
              width={tileWidth - 2.2}
              height={tileHeight - 2.2}
              rx="2.2"
              fill={tileColor(tile.heatLevel)}
              opacity={1}
              className={tile.visited ? "is-visited" : ""}
            />
          ))}
        </g>

        <g className="wander-almanac-map-pins">
          {cityPins.map((pin, index) => (
            <g
              key={pin.key}
              transform={`translate(${
                CHINA_MAP_OFFSET_X +
                pin.column * tileWidth +
                tileWidth / 2
              } ${
                CHINA_MAP_OFFSET_Y + pin.row * tileHeight + tileHeight / 2
              })`}
            >
              <rect
                x={-tileWidth * 0.34}
                y={-tileHeight * 0.34}
                width={tileWidth * 0.68}
                height={tileHeight * 0.68}
                rx="2.5"
                fill={tileColor(pin.heatLevel)}
                stroke="#21143f"
                strokeWidth="1.5"
              />
              <title>{`${index + 1}. ${pin.name}`}</title>
            </g>
          ))}
        </g>
      </svg>

      <div
        className="wander-almanac-south-china-sea"
        role="img"
        aria-label="南海诸岛正北示意，标示东沙、西沙、中沙、南沙群岛、黄岩岛、曾母暗沙及现行岛礁点位"
      >
        <header>
          <strong>南海诸岛</strong>
          <small>北 ↑</small>
        </header>
        <div className="wander-almanac-south-china-sea-plot" aria-hidden="true">
          {SOUTH_CHINA_SEA_DASH_SEGMENTS.map((segment) => (
            <i
              key={segment.id}
              className="wander-almanac-south-china-sea-dash"
              style={{
                ...southChinaSeaInsetPosition(
                  segment.longitude,
                  segment.latitude,
                ),
                transform: `translate(-50%, -50%) rotate(${segment.rotation}deg)`,
              }}
            />
          ))}
          {SOUTH_CHINA_SEA_ISLAND_POINTS.map((point) => (
            <span
              key={point.id}
              className={[
                "wander-almanac-south-china-sea-island",
                "currentName" in point ? "is-current-name" : "",
                "labelPosition" in point
                  ? `label-${point.labelPosition}`
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={southChinaSeaInsetPosition(
                point.longitude,
                point.latitude,
              )}
              title={point.label}
            >
              <i />
              {"shortLabel" in point ? (
                <small>{point.shortLabel}</small>
              ) : null}
            </span>
          ))}
        </div>
      </div>

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
  dimension,
  visits,
  countryMetrics,
  countryRegions,
  primaryTitle,
  unlockedTitles,
  selectedTitles,
  onToggleTitle,
  onClose,
  onNotice,
}: WanderAlmanacProps) {
  const posterRef = useRef<HTMLElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [mapReady, setMapReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [achievementPickerOpen, setAchievementPickerOpen] = useState(false);

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
        visits
          .map((visit) =>
            /^\d{4}-\d{2}-\d{2}$/u.test(visit.visitedOn)
              ? visit.visitedOn.slice(0, 4)
              : "",
          )
          .filter(Boolean),
      ),
    ].sort();
    if (years.length <= 1) return years[0] ?? "";
    return `${years[0]}—${years[years.length - 1]}`;
  }, [visits]);

  const stats = {
    continents: continentCount,
    countries: countryMetrics.length,
    cities: uniqueCities.size,
    landmarks: uniqueLandmarks.size,
  };
  const activeTitles = useMemo(() => {
    const selectedById = new Map(
      selectedTitles.map((title) => [title.id, title]),
    );
    const primary =
      selectedById.get(primaryTitle.id) ??
      unlockedTitles.find((title) => title.id === primaryTitle.id) ??
      primaryTitle;
    return [
      primary,
      ...selectedTitles.filter((title) => title.id !== primary.id),
    ].slice(0, MAX_POSTER_TITLES);
  }, [primaryTitle, selectedTitles, unlockedTitles]);
  const pickerTitles = useMemo(
    () =>
      [...unlockedTitles].sort(
        (left, right) =>
          Number(
            activeTitles.some((title) => title.id === right.id),
          ) -
            Number(activeTitles.some((title) => title.id === left.id)) ||
          right.priority - left.priority ||
          left.title.localeCompare(right.title, "zh-CN"),
      ),
    [activeTitles, unlockedTitles],
  );
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
      ? `我的「${activeTitle.title}」中国打卡地图：${chinaProvinceNames.length} 个省级区域 · ${chinaCities.size} 座城市 · ${chinaLandmarks.size} 个景点。大江南北，我晃过。`
      : `我的「${activeTitle.title}」世界打卡地图：${stats.continents} 洲 · ${stats.countries} 国 · ${stats.cities} 城 · ${stats.landmarks} 个景点。这地球，我晃过。`;

  useEffect(() => {
    const updateScale = () => {
      const availableWidth = Math.max(320, window.innerWidth - 32);
      const toolbarHeight =
        window.innerWidth <= 720 ? 228 : window.innerWidth <= 1100 ? 156 : 108;
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
      const yearSuffix = yearRange ? `-${yearRange.replace("—", "-")}` : "";
      link.download = `我的${dimension === "china" ? "中国" : "世界"}打卡地图${yearSuffix}.png`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      showFeedback(`${dimension === "china" ? "中国" : "世界"}打卡地图已生成`);
      onNotice(`${dimension === "china" ? "中国" : "世界"}打卡地图已生成`);
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
      data-dimension={dimension}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wander-almanac-preview-title"
    >
      <header className="wander-almanac-toolbar">
        <button type="button" onClick={onClose}>
          <ArrowLeft size={17} />
          回到地图
        </button>
        <div className="wander-almanac-toolbar-copy">
          <small>SECOND DRAFT · 短版海报</small>
          <strong id="wander-almanac-preview-title">
            我的{dimension === "china" ? "中国" : "世界"}打卡地图
          </strong>
          <span
            className={`wander-almanac-dimension-label is-${dimension}`}
            aria-label={`当前生成${dimension === "china" ? "中国" : "世界"}内容`}
          >
            {dimension === "china" ? "中国维度" : "全球维度"}
          </span>
        </div>
        <div className="wander-almanac-toolbar-actions">
          {feedback ? (
            <span className="wander-almanac-toolbar-feedback" role="status">
              <Check size={14} />
              {feedback}
            </span>
          ) : null}
          <div className="wander-almanac-achievement-menu">
            <button
              type="button"
              aria-expanded={achievementPickerOpen}
              onClick={() => setAchievementPickerOpen((current) => !current)}
            >
              <Award size={16} />
              成就 {activeTitles.length}/{MAX_POSTER_TITLES}
              <ChevronDown
                size={14}
                className={achievementPickerOpen ? "is-open" : ""}
              />
            </button>
            {achievementPickerOpen ? (
              <div
                className="wander-almanac-achievement-picker"
                role="dialog"
                aria-label="选择海报展示成就"
              >
                <header>
                  <strong>选择海报成就</strong>
                  <small>
                    主成就固定第一，最多展示 {MAX_POSTER_TITLES} 枚
                  </small>
                </header>
                <div>
                  {pickerTitles.map((title) => {
                    const isPrimary = title.id === primaryTitle.id;
                    const isSelected = activeTitles.some(
                      (item) => item.id === title.id,
                    );
                    return (
                      <button
                        type="button"
                        key={title.id}
                        className={[
                          `tone-${title.tone}`,
                          isSelected ? "is-selected" : "",
                          isPrimary ? "is-primary-title" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={isSelected}
                        disabled={isPrimary}
                        onClick={() => onToggleTitle(title.id, title.title)}
                      >
                        <span>
                          <strong>{title.title}</strong>
                          <small>{isPrimary ? "主成就 · 固定展示" : title.description}</small>
                        </span>
                        {isSelected ? <Check size={15} /> : <Award size={15} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
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
        </div>
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
              <span>
                {dimension === "china" ? "MY CHINA MAP" : "MY WORLD MAP"}
                {yearRange ? ` · ${yearRange}` : ""}
              </span>
            </header>

            <section className="wander-almanac-hero">
              <h1>
                {dimension === "china"
                  ? "大江南北，我晃过。"
                  : "这地球，我晃过。"}
              </h1>

              {activeTitles.length ? (
                <div
                  className="wander-almanac-title-strip"
                  aria-label="我的成就"
                >
                  <header>
                    <span>我的成就</span>
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
                  <small>
                    {dimension === "china"
                      ? "MY PIXEL CHINA"
                      : "MY PIXEL WORLD"}
                  </small>
                  <h2>
                    {dimension === "china"
                      ? "我点亮的中国。"
                      : "我点亮的世界。"}
                  </h2>
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
                  <span>
                    已点亮 <b>{chinaProvinceNames.length}</b> 个省级区域
                  </span>
                ) : (
                  <span>
                    已点亮 <b>{stats.countries}</b> 个国家
                  </span>
                )}
              </footer>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
