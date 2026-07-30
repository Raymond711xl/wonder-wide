import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error(
    "Usage: node scripts/build-world-capitals.mjs <ne_10m_populated_places.geojson>",
  );
}

const root = resolve(import.meta.dirname, "..");
const countriesPath = resolve(root, "public/data/world-countries.geojson");
const outputPath = resolve(root, "public/data/world-capitals.json");

const [countryCollection, populatedPlaceCollection] = await Promise.all([
  readFile(countriesPath, "utf8").then(JSON.parse),
  readFile(resolve(sourcePath), "utf8").then(JSON.parse),
]);

const preferredCapitalNames = {
  BJ: ["Porto-Novo"],
  CI: ["Yamoussoukro"],
  CL: ["Santiago"],
  GB: ["London"],
  GE: ["Tbilisi"],
  IL: ["Jerusalem"],
  JP: ["Tokyo"],
  LK: ["Sri Jayawardenepura Kotte", "Colombo"],
  MA: ["Rabat"],
  MM: ["Naypyidaw"],
  MY: ["Kuala Lumpur"],
  NG: ["Abuja"],
  NL: ["Amsterdam"],
  PH: ["Manila"],
  PS: ["Ramallah"],
  PT: ["Lisbon"],
  RS: ["Belgrade"],
  SZ: ["Mbabane", "Lobamba"],
  TZ: ["Dodoma"],
  ZA: ["Pretoria", "Cape Town", "Bloemfontein"],
};

const manualCapitals = {
  TF: [
    {
      name: "法兰西港",
      englishName: "Port-aux-Français",
      longitude: 70.2167,
      latitude: -49.35,
    },
  ],
};

const countries = countryCollection.features
  .map((feature) => ({
    code: String(
      feature.properties.ISO_A2_EH ?? feature.properties.ISO_A2 ?? "",
    ).toUpperCase(),
    alpha3: String(feature.properties.ADM0_A3 ?? "").toUpperCase(),
  }))
  .filter(
    (country) =>
      country.code &&
      country.code !== "-99" &&
      country.code !== "AQ" &&
      country.code !== "TW",
  )
  .sort((left, right) => left.code.localeCompare(right.code));

function isCapital(feature) {
  const properties = feature.properties ?? {};
  return (
    /Admin-0.*capital/i.test(String(properties.FEATURECLA ?? "")) ||
    Number(properties.ADM0CAP) === 1 ||
    Number(properties.CAPALT) === 1
  );
}

function matchesCountry(feature, country) {
  const properties = feature.properties ?? {};
  return (
    String(properties.ISO_A2 ?? "").toUpperCase() === country.code ||
    String(properties.ADM0_A3 ?? "").toUpperCase() === country.alpha3
  );
}

function capitalFromFeature(feature) {
  const properties = feature.properties ?? {};
  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    name: String(properties.NAME_ZH || properties.NAME || "未命名首都"),
    englishName: String(properties.NAME || ""),
    longitude: Number(longitude),
    latitude: Number(latitude),
  };
}

function dedupeCapitals(capitals) {
  const unique = new Map();
  capitals.forEach((capital) => {
    const key = `${capital.englishName}:${capital.longitude.toFixed(4)}:${capital.latitude.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, capital);
  });
  return [...unique.values()];
}

const capitals = {};
for (const country of countries) {
  if (manualCapitals[country.code]) {
    capitals[country.code] = manualCapitals[country.code];
    continue;
  }

  let candidates = populatedPlaceCollection.features.filter(
    (feature) => matchesCountry(feature, country) && isCapital(feature),
  );

  // Puerto Rico is represented as an Admin-1 capital in Natural Earth.
  if (country.code === "PR") {
    candidates = populatedPlaceCollection.features.filter(
      (feature) =>
        matchesCountry(feature, country) &&
        String(feature.properties?.NAME ?? "") === "San Juan",
    );
  }

  const preferred = preferredCapitalNames[country.code];
  if (preferred) {
    candidates = candidates.filter((feature) =>
      preferred.includes(String(feature.properties?.NAME ?? "")),
    );
    candidates.sort(
      (left, right) =>
        preferred.indexOf(String(left.properties?.NAME ?? "")) -
        preferred.indexOf(String(right.properties?.NAME ?? "")),
    );
  } else {
    const roleFlagged = candidates.filter(
      (feature) =>
        Number(feature.properties?.ADM0CAP) === 1 ||
        Number(feature.properties?.CAPALT) === 1,
    );
    if (roleFlagged.length > 0) candidates = roleFlagged;
    candidates.sort(
      (left, right) =>
        Number(right.properties?.ADM0CAP ?? 0) -
          Number(left.properties?.ADM0CAP ?? 0) ||
        Number(right.properties?.CAPALT ?? 0) -
          Number(left.properties?.CAPALT ?? 0),
    );
    candidates = candidates.slice(0, 1);
  }

  capitals[country.code] = dedupeCapitals(candidates.map(capitalFromFeature));
}

const missing = countries
  .map((country) => country.code)
  .filter((code) => !capitals[code]?.length);
if (missing.length > 0) {
  throw new Error(`Missing capitals for: ${missing.join(", ")}`);
}

const output = {
  source:
    "Natural Earth 1:10m populated places, with a manual administrative centre fallback for TF",
  sourceUrl:
    "https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_populated_places.geojson",
  attribution: "Natural Earth (public domain)",
  countryCount: countries.length,
  capitals,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Wrote ${countries.length} country entries to ${outputPath}`,
);
