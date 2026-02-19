# CTAN Bus Tracker

A progressive web app for real-time bus departures, route planning, timetables, and an interactive stop map across the nine public transport consortiums of Andalusia, Spain.

**[🚌 Live demo → hendrikbgr.github.io/andalusia-public-transport-app/home.html](https://hendrikbgr.github.io/andalusia-public-transport-app/home.html)**

Built with vanilla JavaScript, Leaflet.js, and the public [CTAN API](https://api.ctan.es).

---

## Screenshots

| Home | Live Departures | Route Planner |
|------|----------------|---------------|
| ![Home](docs/screenshots/home.png) | ![Departures](docs/screenshots/departures.png) | ![Planner](docs/screenshots/planner.png) |

| Stop Map | Route Polyline | Full Timetable |
|----------|---------------|----------------|
| ![Map](docs/screenshots/map.png) | ![Polyline](docs/screenshots/polyline.png) | ![Timetable](docs/screenshots/timetable.png) |

---

## Features

| Page | Description |
|------|-------------|
| **Home** (`home.html`) | Dashboard with quick access to all features; shows saved stops for one-tap access |
| **Live Departures** (`station.html`) | Real-time bus board, auto-refreshes every 30 s; save stops, share via QR code, show stop on map |
| **Route Detail** (`route.html`) | All stops on a line with direction tabs; service disruption alerts; link to full timetable and map |
| **Route Planner** (`planner.html`) | Find buses between two towns; Today / Tomorrow / Pick date selector; shows all direct departures for the day |
| **Stop Map** (`map.html`) | Interactive Leaflet map of all stops in a region; tap a stop for a departures link; draws route polylines with stop filtering |
| **Full Timetable** (`timetable.html`) | Complete scrollable timetable grid for any line; tabs for each day type (weekday / Saturday / Sunday) |

### Additional features
- 🌍 **English / Spanish** language toggle, persisted via cookie
- ⭐ **Saved stops** — star any stop from its departures page; pinned to the top of the home screen
- 📍 **User location dot** — pulsing blue dot on the map that tracks your position
- 📲 **PWA** — installable on iOS/Android; offline shell cache via service worker
- 🗺️ **Route polyline** — draw a line's full route on the map with only its stops highlighted; toggle all stops on/off
- ⚠️ **Disruption alerts** — expandable alert cards on route pages when a line has active notices

---

## Project structure

```
├── home.html          # Home dashboard
├── index.html         # Stop selector (region → stop)
├── station.html       # Live departures board
├── route.html         # Route stops detail
├── planner.html       # Route planner (town-to-town)
├── map.html           # Interactive Leaflet stop map
├── timetable.html     # Full line timetable grid
│
├── manifest.json      # PWA manifest
├── sw.js              # Service worker (offline shell)
│
├── src/
│   ├── style.css      # All styles
│   └── js/
│       ├── i18n.js    # Translations, cookies, language helpers
│       ├── app.js     # Stop selector logic
│       ├── home.js    # Home page logic
│       ├── station.js # Live departures + auto-refresh + QR + save
│       ├── route.js   # Route stops + direction tabs + disruptions
│       ├── planner.js # Route planner + date picker + direct connections
│       ├── map.js     # Leaflet map + polyline + location dot
│       └── timetable.js # Full timetable grid
│
├── tests/
│   ├── conftest.py        # Shared fixtures (server, browser, constants)
│   ├── test_api.py        # Live API contract tests
│   ├── test_home.py       # Home page UI tests
│   ├── test_navigation.py # Stop selector + back-button chain
│   ├── test_timetable.py  # Station departures page tests
│   ├── test_planner.py    # Route planner UI tests
│   └── test_map.py        # Stop map UI tests
│
├── docs/
│   ├── api.md             # CTAN API endpoint reference
│   ├── architecture.md    # App architecture and design decisions
│   └── TEST_PLAN.md       # Manual test plan with real API data
│
└── run_tests.py       # Test runner (auto-installs deps)
```

---

## Running locally

No build step, no bundler, no framework — just open the HTML files:

```bash
python3 -m http.server 8787
# then open http://localhost:8787/home.html
```

---

## Running tests

```bash
# Run all tests (auto-installs deps on first run)
python3 run_tests.py

# Run a specific suite
python3 run_tests.py api          # CTAN API contract
python3 run_tests.py home         # Home page
python3 run_tests.py navigation   # Stop selector + back buttons
python3 run_tests.py timetable    # Live departures
python3 run_tests.py planner      # Route planner
python3 run_tests.py map          # Stop map
```

Tests use **pytest** + **Playwright** (headless Chromium). A `.venv` is created automatically on first run.

---

## External dependencies

| Library | Version | Usage |
|---------|---------|-------|
| [Leaflet.js](https://leafletjs.com) | 1.9.4 | Interactive map |
| [CartoDB light tiles](https://carto.com) | — | Map tile layer |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) | 1.0.0 | QR code for stop URL |

All loaded from CDN — no `npm install` required.

---

## API

All data comes from the public CTAN API:

```
https://api.ctan.es/v1/Consorcios
```

See [`docs/api.md`](docs/api.md) for a full endpoint reference.

---

## Browser support

Modern browsers with ES2020 support. Tested in Chrome and Safari on iOS / macOS.
