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
  assert.match(html, /这地球，咱晃过。/);
  assert.match(html, />国家</);
  assert.match(html, /搜索城市/);
  assert.match(html, /WANDER WIDE/);
  assert.match(html, /晃悠自由人/);
  assert.match(html, /全球足迹/);
  assert.match(html, /全球进度/);
  assert.match(html, /足迹数据/);
  assert.match(html, /生成世界打卡地图/);
  assert.match(html, /atlas-v2-scope-tabs/);
  assert.match(html, /atlas-v2-roaming-progress/);
  assert.doesNotMatch(html, /data-testid="map-coverage"/);
  assert.match(html, /atlas-v2-heat-scale/);
  assert.match(html, /atlas-v2-heat-details/);
  assert.match(html, /三分熟/);
  assert.match(html, /五分熟/);
  assert.match(html, /七分熟/);
  assert.match(html, /全熟/);
  assert.doesNotMatch(
    html,
    /WORLD COVERAGE|COUNTRIES|CITIES|MY ROAMS|DONENESS|WELL-DONE/,
  );
  assert.match(html, /https:\/\/atlas\.example\/og-wander-wide\.png/);
  assert.doesNotMatch(
    html,
    /足迹积分|中华民国|国家层|城市层|地图选城市|远迹/,
  );
  assert.doesNotMatch(html, /codex-preview|Starter Project|taking shape/i);
});

test("keeps the two-level static atlas as a client boundary", async () => {
  const [
    page,
    explorer,
    staticMap,
    atlasData,
    roamingTitles,
    wanderAlmanac,
    globalsCss,
    staticCss,
    almanacCss,
    smileySansFont,
    layout,
    packageJson,
  ] = await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/AtlasExplorer.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/StaticAtlasMap.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/atlas-data.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/roaming-titles.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/WanderAlmanac.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../app/static-atlas.css", import.meta.url), "utf8"),
      readFile(new URL("../app/wander-almanac.css", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../public/fonts/SmileySans-Oblique.ttf.woff2",
          import.meta.url,
        ),
      ),
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
  assert.match(explorer, /evaluateRoamingTitles/);
  assert.match(explorer, /type AtlasScope = "world" \| "china"/);
  assert.match(explorer, /SCOPED_TITLE_STORAGE_KEY/);
  assert.match(explorer, /scopeVisits/);
  assert.match(explorer, /data-scope=\{scope\}/);
  assert.match(explorer, /aria-label="足迹维度"/);
  assert.match(explorer, /中国成就册/);
  assert.match(explorer, /生成中国打卡地图/);
  assert.match(explorer, /生成世界打卡地图/);
  assert.match(explorer, /<WanderAlmanac/);
  assert.match(roamingTitles, /高加索三兄弟/);
  assert.match(roamingTitles, /南法松弛派/);
  assert.match(roamingTitles, /新马泰三连晃/);
  assert.match(roamingTitles, /极光带候场人/);
  assert.match(explorer, /WORLD_COUNTRY_TOTAL/);
  assert.match(explorer, /atlas-v2-roaming-progress/);
  assert.match(explorer, /为你推荐/);
  assert.match(explorer, /LANDMARK_RECOMMENDATION_LIMIT = 12/);
  assert.match(explorer, /fetchRecommendedLandmarks/);
  assert.match(explorer, /overpass-api\.de\/api\/interpreter/);
  assert.match(explorer, /正在为你整理这座城市的推荐景点/);
  assert.match(staticCss, /--atlas-type-title: 22px/);
  assert.match(staticCss, /--atlas-type-note: 12px/);
  assert.match(staticCss, /--atlas-type-aux: 9px/);
  assert.match(staticCss, /static-country-badge:hover \.badge-name/);
  assert.match(staticCss, /static-city-marker:hover \.city-label-card/);
  assert.match(staticCss, /atlas-v2-heat-scale/);
  assert.match(staticCss, /atlas-v2-heat-details/);
  assert.match(
    staticCss,
    /data-map-mode="country"[\s\S]*static-city-marker \.city-label-card/,
  );
  assert.match(staticMap, /world-countries\.geojson/);
  assert.match(staticMap, /viewBox/);
  assert.match(staticMap, /projectCoordinate/);
  assert.match(staticMap, /MAP_WEST_LONGITUDE = -30/);
  assert.match(staticMap, /mapLongitude/);
  assert.match(staticMap, /markerScale/);
  assert.match(staticMap, /fitCountryBounds/);
  assert.match(staticMap, /placeCountryLabels/);
  assert.match(staticMap, /static-active-country-name/);
  assert.match(staticMap, /badge-count-dot/);
  assert.match(staticMap, /country-city-counts\.json/);
  assert.match(staticMap, /country-subdivisions/);
  assert.match(staticMap, /static-atlas-coverage/);
  assert.match(staticMap, /formatCoverage/);
  assert.match(staticMap, /CHINA_PROVINCE_TOTAL/);
  assert.match(staticMap, /chinaProvinceKey/);
  assert.match(staticMap, /省级覆盖/);
  assert.match(staticMap, /MIN_VIEWBOX_WIDTH = 42/);
  assert.match(staticMap, /zoomViewBoxAt/);
  assert.match(staticMap, /panViewBox/);
  assert.match(staticMap, /onDoubleClick=\{handleMapDoubleClick\}/);
  assert.match(staticMap, /onPointerDown=\{handleMapPointerDown\}/);
  assert.match(staticMap, /onWheel=\{handleMapWheel\}/);
  assert.match(staticMap, /pointerDragRef/);
  assert.match(staticMap, /Math\.max\(\s*76/);
  assert.match(staticMap, /GeoNames/i);
  assert.match(staticMap, /geoBoundaries/i);
  assert.match(staticMap, /onCityEdit/);
  assert.match(
    wanderAlmanac,
    /我的\{dimension === "china" \? "中国" : "世界"\}打卡地图/,
  );
  assert.match(wanderAlmanac, /MY PIXEL WORLD/);
  assert.match(wanderAlmanac, /MY CHINA MAP/);
  assert.match(wanderAlmanac, /我点亮的世界。/);
  assert.match(wanderAlmanac, /我点亮的中国。/);
  assert.match(wanderAlmanac, /这地球，我晃过。/);
  assert.match(wanderAlmanac, /大江南北，我晃过。/);
  assert.match(wanderAlmanac, /POSTER_HEIGHT = 1200/);
  assert.match(wanderAlmanac, /activeTitles\.length/);
  assert.match(wanderAlmanac, /type AlmanacDimension = "world" \| "china"/);
  assert.match(wanderAlmanac, /dimension: AlmanacDimension/);
  assert.match(wanderAlmanac, /data-dimension=\{dimension\}/);
  assert.match(wanderAlmanac, /MosaicChinaMap/);
  assert.match(
    wanderAlmanac,
    /\/data\/country-subdivisions\/CN\.geojson/,
  );
  assert.match(wanderAlmanac, /CHINA_PROVINCE_TOTAL = 34/);
  assert.match(wanderAlmanac, /chinaFeaturedTitles/);
  assert.match(wanderAlmanac, /chinaProvinceKey/);
  assert.match(wanderAlmanac, /马赛克中国地图/);
  assert.match(wanderAlmanac, /dimension === "china" \? "中国" : "地球"/);
  assert.doesNotMatch(wanderAlmanac, /setDimension|selectDimension/);
  assert.match(wanderAlmanac, /MAP_COLUMNS = 68/);
  assert.match(wanderAlmanac, /toBlob/);
  assert.match(wanderAlmanac, /复制文案/);
  assert.match(wanderAlmanac, /保存图片/);
  assert.doesNotMatch(wanderAlmanac, /skipFonts/);
  assert.match(globalsCss, /font-family: "Smiley Sans"/);
  assert.match(globalsCss, /SmileySans-Oblique\.ttf\.woff2/);
  assert.match(globalsCss, /--font-sans:/);
  assert.ok(smileySansFont.byteLength > 1_000_000);
  assert.match(almanacCss, /\.wander-almanac-poster/);
  assert.match(almanacCss, /\.wander-almanac-map/);
  assert.match(almanacCss, /\.wander-almanac-dimension-label/);
  assert.match(staticCss, /\.atlas-v2-scope-tabs/);
  assert.match(staticCss, /\[data-scope="china"\]/);
  assert.doesNotMatch(
    `${globalsCss}\n${staticCss}\n${almanacCss}`,
    /Songti SC|STSong|Iowan Old Style|Georgia,\s*serif/,
  );
  assert.match(almanacCss, /--almanac-type-title: 54px/);
  assert.match(almanacCss, /--almanac-type-content: 34px/);
  assert.match(almanacCss, /--almanac-type-label: 24px/);
  assert.doesNotMatch(staticMap, /static-map-mode-note/);
  assert.doesNotMatch(explorer, /BACK TO WORLD|WORLD COVERAGE|MAKE MY MAP/);
  assert.match(atlasData, /TRAVEL_TYPE_OPTIONS/);
  assert.match(atlasData, /"路过"/);
  assert.match(atlasData, /"旅游"/);
  assert.match(atlasData, /"出差"/);
  assert.match(atlasData, /"短居 \/ 留学"/);
  assert.match(atlasData, /"常住"/);
  assert.match(atlasData, /"出生地"/);
  assert.doesNotMatch(atlasData, /PASSING BY|HOLIDAY|LIVING HERE/);
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
  assert.match(layout, /wander-almanac\.css/);
  assert.doesNotMatch(layout, /maplibre/i);
  assert.match(packageJson, /"name": "footprint-atlas"/);
  assert.match(packageJson, /"html-to-image"/);
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
  assert.equal(china.boundaryLevel, "ADM1");
  assert.equal(china.boundaryLabel, "省级区域");
  assert.equal(china.features.length, 34);
  assert.ok(
    china.features.some(
      (feature) => feature.properties?.name === "Taiwan Province",
    ),
  );
  assert.ok(
    china.features.every(
      (feature) => feature.properties?.name && feature.properties?.id,
    ),
  );
  assert.match(china.attribution, /geoBoundaries/);
  assert.equal(spain.type, "FeatureCollection");
  assert.equal(spain.boundaryLevel, "ADM2");
  assert.equal(spain.features.length, 52);
  assert.ok(
    spain.features.every(
      (feature) => feature.properties?.name && feature.properties?.id,
    ),
  );
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
