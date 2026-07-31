# Wander Wide

[中文](README.md) | English

A no-login personal travel-footprint tool for keeping countries, cities, and landmarks on an explorable map, tracking progress, and generating shareable posters.

## Product overview

Wonder Wide is a personal travel-footprint map. Move between World and China views, record cities and landmarks, track coverage and travel titles, then generate a poster you can save and share.

- Search for and record countries, cities, and landmarks on a world map.
- Explore footprints, coverage, and travel titles in separate World and China views.
- Optionally record visit dates and trip types; dates are never required.
- Build a four-level country familiarity heatmap from visited cities and trip types.
- Generate a World or China footprint poster and save it as an image.
- Keep data in the current browser without registration or sign-in.

### Product preview

<table>
  <tr>
    <td width="25%"><img src="docs/images/world-atlas.png" alt="World footprint map" width="100%"></td>
    <td width="25%"><img src="docs/images/china-atlas.png" alt="China footprint map" width="100%"></td>
    <td width="25%"><img src="docs/images/world-poster.png" alt="World footprint poster" width="100%"></td>
    <td width="25%"><img src="docs/images/china-poster.png" alt="China footprint poster" width="100%"></td>
  </tr>
  <tr>
    <td align="center">World footprint</td>
    <td align="center">China footprint</td>
    <td align="center">World poster</td>
    <td align="center">China poster</td>
  </tr>
</table>

## How to use

> The easiest path is to give the live site URL or GitHub URL to an Agent with web and Sites capabilities. You do not need to install or understand the deployment toolchain.

### Option 1: Use the existing site (recommended)

Send this prompt to your Agent:

```text
Open Wonder Wide and help me start recording my travel footprint:
https://yuanji-footprint-atlas.wan7ran.chatgpt.site
```

The Agent opens the current site directly. No deployment is needed.

### Option 2: Deploy your own copy

If you want an independent site address, send this prompt to your Agent:

```text
Deploy an independent copy of Wonder Wide from this GitHub repository.
Use Codex Sites, create a new Site on the first deployment, keep it private by default, and do not reuse the repository author's project binding:
https://github.com/Raymond711xl/wonder-wide
```

The Agent retrieves the code, validates it, creates an independent Site, publishes it, and returns the final URL. The user does not need to run commands manually.

| What you need | URL to give the Agent |
| --- | --- |
| Start immediately without a separate address | [Live site](https://yuanji-footprint-atlas.wan7ran.chatgpt.site) |
| Own an independent copy | [GitHub repository](https://github.com/Raymond711xl/wonder-wide) |

To share with friends, send them the same live-site URL. A new independent copy stays private by default; ask the Agent to adjust its access when needed.

In both cases, footprints stay in the browser that opened the site. They do not sync automatically across browsers, devices, Agents, or independent deployments.

## Data and privacy

- Travel records, title selections, and interface state are stored in browser `localStorage`.
- The current project does not upload personal footprint data to its own server.
- City and landmark searches send the search text and map bounds to Nominatim / Overpass.
- Clearing the site's browser data also removes locally saved footprints. Cloud sync is not included.

<details>
<summary>Development and technical reference</summary>

### Local development

Maintainers need Node.js `>=22.13.0`.

```bash
npm ci
npm run dev
```

To verify and run a production build:

```bash
npm run build
npm run start
```

Base maps and administrative boundaries ship with the project. City search and landmark recommendations use OpenStreetMap's Nominatim and Overpass services, so those features require an internet connection.

### Map architecture

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

### Map data

- City statistics: GeoNames `cities15000`, CC BY 4.0.
- Internal country boundaries: geoBoundaries `gbOpen`, CC BY 4.0. China uses 34 ADM1 regions; Spain uses 52 ADM2 regions.
- World country outlines and capital data: Natural Earth, public domain.
- Online city and landmark queries: OpenStreetMap Nominatim / Overpass. Follow the respective service policies and OpenStreetMap attribution requirements.
- Run `node scripts/normalize-map-data.mjs /path/to/cities15000.txt` to recompress boundaries and regenerate city statistics.

### Project structure

| Path | Purpose |
| --- | --- |
| `app/AtlasExplorer.tsx` | Footprint entry, search, and map interaction |
| `app/StaticAtlasMap.tsx` | World / country SVG map rendering |
| `app/WanderAlmanac.tsx` | World / China poster generation and image export |
| `app/roaming-titles.ts` | World and China travel-title rules |
| `public/data/` | Bundled maps, boundaries, and city statistics |
| `tests/` | Regression tests for build output and core interactions |
| `AGENTS.md` | Agent usage, validation, and independent deployment rules |

### Verification

```bash
npm run lint
npm test
```

</details>

## License status

No open-source license has been selected yet. The repository is available for inspection, hands-on use, and personal deployments authorized by the author. Unrestricted copying, modification, and redistribution still require an explicit license. MIT License is a common default for a personal project of this kind.
