# Architecture

## Overview

The app is a **multi-page vanilla JavaScript application** — no framework, no bundler, no build step. Each HTML file is a fully self-contained page that loads its own JS and the shared `i18n.js`.

---

## File responsibilities

| File | Responsibility |
|------|----------------|
| `src/js/i18n.js` | Shared across all pages. Translations (EN/ES), cookie helpers for language and default region. Loaded first on every page. |
| `src/js/app.js` | `stops.html` — two-step stop selector: choose region → search stop → navigate to station |
| `src/js/home.js` | `index.html` — greeting and feature card labels only |
| `src/js/station.js` | `station.html` — live departures with 30 s silent auto-refresh, QR code |
| `src/js/route.js` | `route.html` — full stop list for a line, direction tabs, highlight current stop |
| `src/js/planner.js` | `planner.html` — town-to-town route planner, autocomplete dropdowns, timetable parsing |
| `src/js/map.js` | `map.html` — Leaflet map with stop markers, region overlay, geolocation |
| `src/style.css` | All styles for all pages |

---

## Navigation model

All navigation uses explicit URL parameters rather than `history.back()`. Every page that can navigate forward encodes its own URL as a `from=` parameter so the destination page can set its back button's `href` directly.

```
index.html
  └─ stops.html                    (stop selector)
       └─ station.html?c=4&s=149
            └─ route.html?...&from=<encodedStationUrl>
                 └─ station.html?...&from=<encodedRouteUrl>
                      └─ (back) → route.html

  └─ planner.html
       └─ route.html?...&from=planner.html?c=4&fromN=201&toN=83
            └─ (back) → planner.html?c=4&fromN=201&toN=83  (restores results)

  └─ map.html
       └─ station.html?...&from=map.html
            └─ route.html?...&from=<encodedStationUrl>
```

### Planner state restoration

The planner is a single-page app (SPA) with three UI steps. When the user navigates away (e.g. to a route detail page) and then comes back, a fresh page load would reset to step 1 (region selector).

To avoid this, when the planner navigates to `route.html` it passes:
```
from=planner.html?c=4&fromN=201&toN=83
```

On load, `planner.js` checks for `c`, `fromN`, `toN` URL params and calls `restoreSearch()` which:
1. Fetches consortiums and nucleos
2. Sets `selectedFrom` and `selectedTo`
3. Calls `runSearch()` directly, skipping to the results step

---

## Auto-refresh (station page)

`station.js` runs a 30-second countdown after every data load:

```
initPage()
  ├─ loadStopInfo()          → sets stop name and zone
  ├─ loadDepartures(false)   → fetches data, shows spinner on first load
  └─ scheduleRefresh()       → starts 30 s countdown

scheduleRefresh()
  └─ after 30 s: loadDepartures(true)  → silent; no spinner, no board clear
                  └─ scheduleRefresh() → reschedule
```

The `silent` flag prevents any DOM changes until new data is ready, so the departure board never goes blank on background refreshes.

---

## Timetable parsing (planner)

The `horarios_origen_destino` endpoint returns a complex column-based timetable structure. Parsing steps in `planner.js`:

1. **Build column index map** from `nucleos[].colspan`:
   - Column 0 = line code (skip)
   - Columns 1..N = origin stop times
   - Columns N+1..M = destination stop times

2. **Build frequency map** from `frecuencias[].nombre`:
   - Match English/Spanish keywords ("monday to friday", "lunes a viernes", etc.)
   - Map each `acronimo` to a boolean `runsToday`

3. **Filter trips**:
   - `dias` acronimo must be in the frequency map and run today
   - Departure time must be ≥ now − 1 minute

4. **Sort and display** the next 12 departures

---

## State storage

| Data | Storage | TTL |
|------|---------|-----|
| Language preference | Cookie `lang` | 365 days |
| Default region | Cookie `defaultRegion` (JSON) | 365 days |
| Departure data | JS variable `lastServices` | Session only (re-fetched every 30 s) |
| All stops for a region | JS variable `allStops` | Session only |
| All nucleos for planner | JS variable `allNucleos` | Session only |

---

## External dependencies

All loaded from CDN — no local copies, no npm.

| Library | CDN | Used in |
|---------|-----|---------|
| Leaflet 1.9.4 | unpkg.com | `map.html` |
| CartoDB Light tiles | basemaps.cartocdn.com | `map.js` |
| QRCode.js 1.0.0 | cdnjs.cloudflare.com | `station.html` |

---

## Design decisions

**Why no framework?**
The app has simple, page-scoped logic. Each page is independent. Vanilla JS keeps the bundle size zero and removes any build complexity.

**Why multi-page instead of SPA?**
Each page has a distinct URL, so bookmarking and QR codes work naturally. The browser handles caching of shared files (CSS, i18n.js).

**Why cookies instead of localStorage?**
Cookies work in `file://` URLs and across the local HTTP server used for tests. They also survive browser restarts without any setup.

**Why `from=` param instead of `history.back()`?**
`history.back()` is unpredictable when the user arrived via a QR code, a bookmark, or a direct URL. The `from=` param makes every back button deterministic regardless of navigation history.
