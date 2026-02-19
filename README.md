# CTAN Bus Tracker

A progressive web app for real-time bus stop departures, route planning, and an interactive stop map across the nine public transport consortiums of Andalusia, Spain.

Built with vanilla JavaScript, Leaflet.js, and the public [CTAN API](https://api.ctan.es).

---

## Features

| Page | Description |
|------|-------------|
| **Home** | Dashboard with links to all three features |
| **Live Departures** | Select a region and stop, view real-time bus departures (auto-refreshes every 30 s silently) |
| **Route Detail** | All stops on a line with direction tabs; tap any stop to jump to its departures |
| **Route Planner** | Find buses between two towns; results show next departures with intermediate stops |
| **Stop Map** | Interactive Leaflet map of all stops in a region; tap a stop for a departures link |

Languages supported: English and Spanish (toggle persists via cookie).

---

## Project structure

```
transport-app/
├── home.html          # Home dashboard
├── index.html         # Stop selector (region → stop)
├── station.html       # Live departures board
├── route.html         # Route stops detail
├── planner.html       # Route planner (town-to-town)
├── map.html           # Interactive Leaflet stop map
│
├── src/
│   ├── style.css      # All styles
│   └── js/
│       ├── i18n.js    # Translations, cookies, language helpers
│       ├── app.js     # Stop selector logic
│       ├── home.js    # Home page logic
│       ├── station.js # Live departures + auto-refresh
│       ├── route.js   # Route stops + direction tabs
│       ├── planner.js # Route planner logic
│       └── map.js     # Leaflet map logic
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
├── run_tests.py       # Test runner (auto-installs deps)
└── .venv/             # Python virtual environment (auto-created)
```

---

## Running locally

Open any HTML file directly in a browser, or serve from a local server (required for Playwright tests):

```bash
python3 -m http.server 8787
# then open http://localhost:8787/home.html
```

No build step, no bundler, no framework — just open the HTML files.

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

See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) for the manual test plan with expected data.

---

## External dependencies

| Library | Version | Usage |
|---------|---------|-------|
| [Leaflet.js](https://leafletjs.com) | 1.9.4 | Interactive map |
| [CartoDB light tiles](https://carto.com) | — | Map tile layer |
| [QRCode.js](https://github.com/davidshimjs/qrcodejs) | 1.0.0 | QR code for stop URL |

All loaded from CDN — no npm install required.

---

## API

All data comes from the public CTAN API:

```
https://api.ctan.es/v1/Consorcios
```

See [`docs/api.md`](docs/api.md) for a full endpoint reference.

---

## Browser support

Modern browsers with ES2020 support. Tested in Chrome and Safari on iOS/macOS.
