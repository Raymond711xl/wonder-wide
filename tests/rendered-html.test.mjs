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

test("renders the Footprint Atlas experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>远迹 · Footprint Atlas<\/title>/i);
  assert.match(html, /点亮国家/);
  assert.match(html, /国家看热度/);
  assert.match(html, /城市看故事/);
  assert.match(html, /城市地点/);
  assert.match(html, /FOOTPRINT ATLAS/);
  assert.match(html, /https:\/\/atlas\.example\/og\.png/);
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
  assert.match(explorer, /type="date"/);
  assert.match(explorer, /countryLevel/);
  assert.match(explorer, /stayTag/);
  assert.match(explorer, /points/);
  assert.match(staticMap, /world-countries\.geojson/);
  assert.match(staticMap, /viewBox/);
  assert.match(staticMap, /projectCoordinate/);
  assert.match(staticMap, /markerScale/);
  assert.match(staticMap, /getScreenCTM/);
  assert.match(atlasData, /"3天"/);
  assert.match(atlasData, /"常住"/);
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
});
