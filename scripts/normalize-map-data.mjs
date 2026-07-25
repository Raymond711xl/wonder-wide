import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const siteRoot = path.resolve(import.meta.dirname, "..");
const geonamesPath = process.argv[2];

if (!geonamesPath) {
  throw new Error(
    "Usage: node scripts/normalize-map-data.mjs /path/to/cities15000.txt",
  );
}

const boundarySources = {
  CN: {
    file: "public/data/country-subdivisions/CN.geojson",
    level: "ADM2",
    label: "县级行政区",
  },
  ES: {
    file: "public/data/country-subdivisions/ES.geojson",
    level: "ADM2",
    label: "省级行政区",
  },
};

function roundCoordinates(value) {
  if (typeof value === "number") return Math.round(value * 10_000) / 10_000;
  if (Array.isArray(value)) return value.map(roundCoordinates);
  return value;
}

for (const [countryCode, source] of Object.entries(boundarySources)) {
  const filePath = path.join(siteRoot, source.file);
  const collection = JSON.parse(await readFile(filePath, "utf8"));
  const compact = {
    type: "FeatureCollection",
    countryCode,
    boundaryLevel: source.level,
    boundaryLabel: source.label,
    attribution: "geoBoundaries gbOpen · CC BY 4.0",
    features: collection.features.map((feature) => ({
      type: "Feature",
      properties: {
        name: feature.properties?.shapeName ?? "",
        id: feature.properties?.shapeID ?? "",
      },
      geometry: {
        type: feature.geometry.type,
        coordinates: roundCoordinates(feature.geometry.coordinates),
      },
    })),
  };
  await writeFile(filePath, JSON.stringify(compact));
}

const cityRows = (await readFile(geonamesPath, "utf8"))
  .trim()
  .split("\n");
const counts = {};

for (const row of cityRows) {
  const columns = row.split("\t");
  const countryCode = columns[8];
  if (!countryCode) continue;
  counts[countryCode] = (counts[countryCode] ?? 0) + 1;
}

// The product treats Taiwan as part of China in map geometry, search results,
// and coverage statistics.
counts.CN = (counts.CN ?? 0) + (counts.TW ?? 0);
delete counts.TW;

const sortedCounts = Object.fromEntries(
  Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
);
const cityCatalog = {
  source: "GeoNames cities15000",
  definition: "人口超过 15,000 的城市或行政首府",
  attribution: "GeoNames · CC BY 4.0",
  total: Object.values(sortedCounts).reduce((sum, count) => sum + count, 0),
  counts: sortedCounts,
};

await writeFile(
  path.join(siteRoot, "public/data/country-city-counts.json"),
  JSON.stringify(cityCatalog),
);
