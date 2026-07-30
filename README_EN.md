# Wander Wide

[中文](README.md) | English

A no-login personal travel-footprint tool for keeping countries, cities, and landmarks on an explorable map, tracking progress, and generating shareable posters.

> The hosted demo is not public yet. Once the repository is published, anyone can run the project on their own computer.

## Highlights

- Search for and record countries, cities, and landmarks on a world map.
- Explore footprints, coverage, and travel titles in separate World and China views.
- Optionally record visit dates and trip types; dates are never required.
- Build a four-level country familiarity heatmap from visited cities and trip types.
- Generate a World or China footprint poster and save it as an image.
- Keep data in the current browser's `localStorage` without registration or sign-in.

## Run locally

Node.js `>=22.13.0` is required.

```bash
npm ci
npm run dev
```

Open the local URL printed in the terminal after the development server starts.

To verify and run a production build:

```bash
npm run build
npm run start
```

Base maps and administrative boundaries ship with the project. City search and landmark recommendations use OpenStreetMap's Nominatim and Overpass services, so those features require an internet connection.

## Self-hosting

The project can run independently on another person's computer and can be deployed to a Cloudflare Workers-compatible hosting environment. The current build uses Vinext and is compatible with Codex Sites. GitHub Pages is not a ready-to-use deployment target for the current build.

Browser data is isolated per visitor: there is no account system and no central database. When you share the site with friends, they create their own footprints in their own browsers and cannot see your local records.

When creating a new Codex Site from a copy of this repository, create a separate Sites project binding for that copy instead of reusing the original author's `project_id`.

## Data and privacy

- Travel records, title selections, and interface state are stored in browser `localStorage`.
- The current project does not upload personal footprint data to its own server.
- City and landmark searches send the search text and map bounds to Nominatim / Overpass.
- Clearing the site's browser data also removes locally saved footprints. Cloud sync is not included.

## Map architecture

- Local GeoJSON is projected once at startup; no remote map tiles are loaded.
- The world map uses an Atlantic seam and unfolds as Europe → Asia / China → the Americas.
- Country outlines, city markers, sequence numbers, and labels share one SVG coordinate system.
- Zooming only changes the SVG `viewBox`, so city anchors remain attached to the map.
- The map supports progressive double-click zoom, drag-to-pan, two-finger trackpad panning, and pinch zoom.
- Country markers stay compact in the world view. Country views keep country and city names visible, with collision avoidance and connector lines.
- The world view shows country familiarity and summaries; selecting a country opens its city view.
- Unvisited countries use a warm gray fill. Visited countries use four familiarity levels based on city count and trip type.
- The familiarity legend stays collapsed until hover or keyboard focus.
- Coverage changes with the world / country view. City totals follow the GeoNames `cities15000` definition.
- China and Spain use bundled geoBoundaries administrative boundaries and do not require runtime boundary requests.
- Recorded city markers are display-only and do not open an empty extra zoom level.
- Selecting a city can add up to 12 landmark recommendations while retaining manual search as a fallback.
- Trip type drives familiarity through an internal six-level weight that is not shown to the user.
- The top-level World / China switch provides independent dimensions. China counts 34 provincial-level regions and only shows China records and achievements; World remains the complete default dataset.
- Poster generation inherits the active dimension and creates either a World or China footprint map. Both views use the same visit records.
- China achievements cover geographic reach, regions, city culture, landmark collections, and travel styles. City and landmark achievements are original adaptations of public travel trends.
- World and China keep separate primary and poster-title selections. A poster always includes the primary title and supports up to three titles in total.
- Visit dates are optional. New city entries no longer default to the current date, and undated records display no date.
- Taiwan geometry and city records are grouped under China.
- Records are stored temporarily in browser `localStorage`; no login is required.

## Map data

- City statistics: GeoNames `cities15000`, CC BY 4.0.
- Internal country boundaries: geoBoundaries `gbOpen`, CC BY 4.0. China uses 34 ADM1 regions; Spain uses 52 ADM2 regions.
- World country outlines and capital data: Natural Earth, public domain.
- Online city and landmark queries: OpenStreetMap Nominatim / Overpass. Follow the respective service policies and OpenStreetMap attribution requirements.
- Run `node scripts/normalize-map-data.mjs /path/to/cities15000.txt` to recompress boundaries and regenerate city statistics.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/AtlasExplorer.tsx` | Footprint entry, search, and map interaction |
| `app/StaticAtlasMap.tsx` | World / country SVG map rendering |
| `app/WanderAlmanac.tsx` | World / China poster generation and image export |
| `app/roaming-titles.ts` | World and China travel-title rules |
| `public/data/` | Bundled maps, boundaries, and city statistics |
| `tests/` | Regression tests for build output and core interactions |

## Verification

```bash
npm run lint
npm test
```

## License status

No open-source license has been selected yet. Publishing the repository lets others inspect the source; allowing unrestricted copying, modification, and redeployment requires an explicit license. MIT License is a common default for a personal project of this kind.
