import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://atlas.example/", {
      headers: {
        accept: "text/html",
        host: "atlas.example",
        "x-forwarded-host": "atlas.example",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Wander Wide experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>晃悠 · Wander Wide<\/title>/i);
  assert.match(html, /这地球/);
  assert.match(html, /咱晃过/);
  assert.match(html, /国家 · COUNTRIES/);
  assert.match(html, /搜索城市/);
  assert.match(html, /WANDER WIDE/);
  assert.match(html, /待出门/);
  assert.match(html, /三分熟/);
  assert.match(html, /WELL-DONE/);
  assert.match(html, /https:\/\/atlas\.example\/og-wander-wide\.png/);
  assert.doesNotMatch(
    html,
    /足迹积分|中华民国|国家层|城市层|地图选城市|远迹/,
  );
  assert.doesNotMatch(html, /codex-preview|Starter Project|taking shape/i);
});

test("keeps the two-level static atlas as a client boundary", async () => {
  const [page, explorer, staticMap, atlasData, layout, packageJson] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/AtlasExplorer.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/StaticAtlasMap.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/atlas-data.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.match(page, /<AtlasExplorer \/>/);
  assert.match(explorer, /^"use client";/);
  assert.match(explorer, /<StaticAtlasMap/);
  assert.match(explorer, /localStorage/);
  assert.match(explorer, /aria-label="到访年份"/);
  assert.match(explorer, /aria-label="到访月份"/);
  assert.match(explorer, /countryHeat/);
  assert.match(explorer, /travelType/);
  assert.match(explorer, /hiddenScore/);
  assert.match(explorer, /返回全球/);
  assert.match(explorer, /openVisitEditor/);
  assert.match(explorer, /editingVisitId/);
  assert.match(explorer, /roamingBadgeFor/);
  assert.match(explorer, /RECOMMENDED SPOTS/);
  assert.match(staticMap, /world-countries\.geojson/);
  assert.match(staticMap, /viewBox/);
  assert.match(staticMap, /projectCoordinate/);
  assert.match(staticMap, /markerScale/);
  assert.match(staticMap, /country-city-counts\.json/);
  assert.match(staticMap, /country-subdivisions/);
  assert.match(staticMap, /static-atlas-coverage/);
  assert.match(staticMap, /formatCoverage/);
  assert.match(staticMap, /GeoNames/i);
  assert.match(staticMap, /geoBoundaries/i);
  assert.match(staticMap, /onCityEdit/);
  assert.match(atlasData, /TRAVEL_TYPE_OPTIONS/);
  assert.match(atlasData, /"路过"/);
  assert.match(atlasData, /"旅游"/);
  assert.match(atlasData, /"出差"/);
  assert.match(atlasData, /"短居 \/ 留学"/);
  assert.match(atlasData, /"常住"/);
  assert.match(atlasData, /"出生地"/);
  assert.match(atlasData, /"PASSING BY"/);
  assert.match(atlasData, /"TH:曼谷"/);
  assert.match(atlasData, /normalizeCountryName/);
  assert.doesNotMatch(
    explorer,
    /type="date"|onCityFocus|focusCity|地图选城市|handlePointPick|\/reverse\?/,
  );
  assert.doesNotMatch(staticMap, /onCityFocus|focusCity/);
  assert.doesNotMatch(staticMap, /getScreenCTM|onPointPick|pickMode/);
  assert.doesNotMatch(explorer, /maplibre/i);
  assert.doesNotMatch(staticMap, /maplibre|ArcGIS|tile\.openstreetmap/i);
  assert.match(layout, /generateMetadata/);
  assert.doesNotMatch(layout, /maplibre/i);
  assert.match(packageJson, /"name": "footprint-atlas"/);
  assert.doesNotMatch(packageJson, /maplibre/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("uses one local projected SVG coordinate system without remote tiles", async () => {
  const staticMap = await readFile(
    new URL("../app/StaticAtlasMap.tsx", import.meta.url),
    "utf8",
  );

  assert.match(staticMap, /<svg/);
  assert.match(staticMap, /transform={`translate\(\$\{point\.x\}/);
  assert.match(staticMap, /scale\(\$\{markerScale\}\)/);
  assert.match(staticMap, /\/data\/world-countries\.geojson/);
  assert.doesNotMatch(staticMap, /https?:\/\/.*(?:tiles?|arcgis)/i);
});

test("ships a local flat-world country layer", async () => {
  const raw = await readFile(
    new URL("../public/data/world-countries.geojson", import.meta.url),
    "utf8",
  );
  const countries = JSON.parse(raw);

  assert.equal(countries.type, "FeatureCollection");
  assert.ok(countries.features.length >= 170);
  assert.ok(
    countries.features.every(
      (feature) =>
        feature.properties?.ISO_A2_EH && feature.properties?.NAME,
    ),
  );
  const china = countries.features.find(
    (feature) => feature.properties?.ISO_A2_EH === "CN",
  );
  const taiwan = countries.features.find(
    (feature) => feature.properties?.ISO_A2_EH === "TW",
  );
  assert.equal(china?.properties?.NAME_ZH, "中国");
  assert.equal(taiwan?.properties?.NAME_ZH, "中国台湾");
  assert.doesNotMatch(raw, /中华民国/);
});

test("ships local coverage counts and detailed country boundaries", async () => {
  const [catalogRaw, chinaRaw, spainRaw] = await Promise.all([
    readFile(
      new URL("../public/data/country-city-counts.json", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../public/data/country-subdivisions/CN.geojson",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../public/data/country-subdivisions/ES.geojson",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const catalog = JSON.parse(catalogRaw);
  const china = JSON.parse(chinaRaw);
  const spain = JSON.parse(spainRaw);

  assert.match(catalog.source, /GeoNames/);
  assert.ok(catalog.total > 30_000);
  assert.ok(catalog.counts.CN > 1_000);
  assert.ok(catalog.counts.ES > 500);
  assert.equal(catalog.counts.TW, undefined);
  assert.equal(china.type, "FeatureCollection");
  assert.ok(china.features.length > 2_000);
  assert.match(china.attribution, /geoBoundaries/);
  assert.equal(spain.type, "FeatureCollection");
  assert.ok(spain.features.length >= 50);
  assert.match(spain.attribution, /geoBoundaries/);
});

test("merges Taiwan geometry and search results into China", async () => {
  const [explorer, staticMap] = await Promise.all([
    readFile(new URL("../app/AtlasExplorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StaticAtlasMap.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(staticMap, /china\.path = `\$\{china\.path\} \$\{taiwan\.path\}`/);
  assert.match(staticMap, /country\.code !== "TW"/);
  assert.match(explorer, /sourceCountryCode === "TW"/);
  assert.match(explorer, /isTaiwan \? "CN"/);
  assert.match(explorer, /"cn,tw"/);
  assert.doesNotMatch(`${explorer}\n${staticMap}`, /中华民国/);
});

test("normalizes duplicate country labels and keeps Thailand singular", async () => {
  const [explorer, staticMap, atlasData] = await Promise.all([
    readFile(new URL("../app/AtlasExplorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StaticAtlasMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/atlas-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(atlasData, /TH: "泰国"/);
  assert.match(explorer, /normalizeCountryName\(/);
  assert.match(staticMap, /normalizeCountryName\(name, code\)/);
  assert.doesNotMatch(
    `${explorer}\n${staticMap}\n${atlasData}`,
    /泰国\s*·\s*泰[国國]/,
  );
});
