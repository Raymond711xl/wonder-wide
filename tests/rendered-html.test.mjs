import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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
  assert.match(html, /把去过的地方/);
  assert.match(html, /FOOTPRINT ATLAS/);
  assert.match(html, /https:\/\/atlas\.example\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|Starter Project|taking shape/i);
});

test("keeps the map explorer as a client boundary", async () => {
  const [page, explorer, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AtlasExplorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<AtlasExplorer \/>/);
  assert.match(explorer, /^"use client";/);
  assert.match(explorer, /maplibre-gl/);
  assert.match(explorer, /localStorage/);
  assert.match(layout, /generateMetadata/);
  assert.match(packageJson, /"name": "footprint-atlas"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("ships the MapLibre worker with the deployed client assets", async () => {
  const assetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const assets = await readdir(assetsUrl);
  const workerAsset = assets.find((file) =>
    /^maplibre-gl-worker-[A-Za-z0-9_-]+\.mjs$/.test(file),
  );
  const explorerAsset = assets.find((file) =>
    /^AtlasExplorer-[A-Za-z0-9_-]+\.js$/.test(file),
  );

  assert.ok(workerAsset, "expected a bundled MapLibre worker asset");
  assert.ok(explorerAsset, "expected the AtlasExplorer client bundle");

  const explorer = await readFile(new URL(explorerAsset, assetsUrl), "utf8");
  assert.match(explorer, new RegExp(`/assets/${workerAsset}`));
});
