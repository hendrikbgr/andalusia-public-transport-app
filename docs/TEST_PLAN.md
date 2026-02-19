# End-to-End Test Plan — CTAN Bus Tracker

**API base:** `https://api.ctan.es/v1/Consorcios`
**Last verified:** 2026-02-19

---

## 1. Real reference data (verified against live API)

### Consortiums
| ID | Name | Short |
|----|------|-------|
| 1 | Área de Sevilla | CTAS |
| 2 | Bahía de Cádiz | CMTBC |
| 3 | Área de Granada | CTMGR |
| **4** | **Área de Málaga** | **CTMAM** ← primary test consortium |
| 5 | Campo de Gibraltar | CTMCG |
| 6 | Área de Almería | CTAL |
| 7 | Área de Jaén | CTJA |
| 8 | Área de Córdoba | CTCO |
| 9 | Costa de Huelva | CTHU |

### Key stops (Consortium 4 — Málaga)
| idParada | Name | Nucleo | Zona | Lat/Lon |
|----------|------|--------|------|---------|
| 149 | Terminal Muelle Heredia | Málaga | A | 36.7162, -4.4205 |
| 460 | Estacion Tren Malaga | Málaga | A | 36.7112, -4.4310 |
| 592 | A-7075 Km 8,200 | Ventorrillo de Mayo | B | 36.7763, -4.4934 |

### Key nucleos (towns) for planner
| idNucleo | Name | Zona |
|----------|------|------|
| 1 | Málaga | A |
| 51 | Arroyo de la Miel | B |
| 83 | Alhaurín el Grande | — |
| 107 | Torremolinos | B |
| 111 | Fuengirola | C |
| 201 | Coín | — |
| 202 | Antequera | E |

### Key route (Line 1 — M-110)
- **Name:** Málaga–Torremolinos–Benalmádena Costa
- **Operator:** Avanza Movilidad Integral, S.L.
- **Direction 1:** 41 stops, starts at Terminal Muelle Heredia (idParada 149)
- **Direction 2:** 42 stops (return)
- First 5 stops dir 1: 149, 460, 615, 617, 619

### Planner: Coín → Alhaurín el Grande
- **Endpoint:** `GET /4/horarios_origen_destino?idNucleoOrigen=201&idNucleoDestino=83`
- **Column layout (nucleos):** [1 col "Lines"] [2 cols "Coín"] [3 cols "Alhaurín el Grande"]
- **Frequency codes:**
  - `L-V` → Monday–Friday working days
  - `lslab` → Monday–Saturday
  - `sdf` → Saturdays, Sundays & holidays
- **Sample trips:**
  - M-230 (L-V): departs Coín 06:20, arrives Alhaurín 06:38
  - M-221 (lslab): departs Coín 06:25, arrives Alhaurín 06:41

---

## 2. Home screen (`home.html`)

| # | Action | Expected result |
|---|--------|-----------------|
| H1 | Open `home.html` | Header shows bus icon + "Bus Tracker" title + lang toggle "ES" |
| H2 | Greeting | Shows "Good morning / afternoon / evening" depending on time of day |
| H3 | Three cards visible | "Live Departures 🚏", "Route Planner 🗺️", "Stop Map 📍" |
| H4 | Tap "ES" toggle | Title changes to "Rastreador de Autobús", greeting in Spanish, cards relabelled |
| H5 | Tap "EN" toggle | Reverts to English |
| H6 | Tap "Live Departures" | Navigates to `index.html` |
| H7 | Tap "Route Planner" | Navigates to `planner.html` |
| H8 | Tap "Stop Map" | Navigates to `map.html` |

---

## 3. Stop selector (`index.html`)

| # | Action | Expected result |
|---|--------|-----------------|
| S1 | Open `index.html` | Shows 9 region cards with icons (🌻 Sevilla, ⚓ Cádiz, 🏛️ Granada, ☀️ Málaga…) |
| S2 | Tap "☀️ Área de Málaga" | Loading spinner, then search input + stop list appears |
| S3 | Search "muelle" | List filters to stops containing "muelle" (e.g. "Terminal Muelle Heredia") |
| S4 | Search "MALAGA" (uppercase) | Accent/case-insensitive match — returns Málaga stops |
| S5 | Tap "Terminal Muelle Heredia" | Navigates to `station.html?c=4&s=149` |
| S6 | Back button | Returns to region selection step |
| S7 | If default region set (cookie) | Region step skipped, goes straight to stop search |

---

## 4. Station departures (`station.html?c=4&s=149`)

| # | Action | Expected result |
|---|--------|-----------------|
| D1 | Page load | Shows stop name "Terminal Muelle Heredia", meta "Málaga · Zone A" |
| D2 | Departure cards | Each card shows: line code (e.g. "M-110"), destination, scheduled time, minutes label |
| D3 | Minutes label — imminent | Shows "Now" (EN) / "Ahora" (ES) for ≤0 min |
| D4 | Minutes label — soon | Shows e.g. "5 min" for departures within 10 min |
| D5 | Minutes label — later | Shows e.g. "25 min" in muted style |
| D6 | Countdown | Shows "Refresh in 30s" counting down each second |
| D7 | Auto-refresh fires | After 30 s, departure times update **silently** — no spinner flash, existing cards stay visible until new data replaces them |
| D8 | Tap departure card | Navigates to `route.html?c=4&l=<lineId>&s=149&from=<encodedStationUrl>` |
| D9 | Lang toggle | "Now/min" labels update without re-fetching API |
| D10 | QR button | Opens QR overlay with URL of current page |
| D11 | Back button | Returns to `index.html` (or `from=` URL if set) |
| D12 | No upcoming buses | Shows "No service" message with hint text |

---

## 5. Route detail (`route.html?c=4&l=1&s=149&code=M-110&dest=Torremolinos&sentido=1`)

| # | Action | Expected result |
|---|--------|-----------------|
| R1 | Page load | Shows "M-110" header, "Málaga–Torremolinos–Benalmádena Costa" subtitle |
| R2 | Stop list | 41 stops shown in order for direction 1 |
| R3 | Current stop | Stop 149 (Terminal Muelle Heredia) highlighted with "●" marker |
| R4 | Direction tab | If route has direction 2, tab shows "↗ Outbound / ↙ Inbound" |
| R5 | Switch to direction 2 | Re-renders stops for return journey without API call |
| R6 | Tap any other stop | Navigates to `station.html?c=4&s=<stopId>&from=<encodedRouteUrl>` |
| R7 | Back from tapped stop | Returns to this route page |
| R8 | Back button | Returns to station page (the `from=` URL) |

---

## 6. Route Planner (`planner.html`)

| # | Action | Expected result |
|---|--------|-----------------|
| P1 | Open page | 9 region cards shown |
| P2 | Tap "Área de Málaga" | From/To input form appears |
| P3 | Type "coin" in From | Dropdown shows "Coín" (accent-insensitive match) |
| P4 | Select "Coín" | Field filled, Search button still disabled until To is set |
| P5 | Type "alhaurin" in To | Dropdown shows "Alhaurín el Grande" |
| P6 | Select "Alhaurín el Grande" | Search button enabled |
| P7 | Tap Search | Results list for Coín → Alhaurín |
| P8 | Weekday result | M-230 at 06:20 from Coín shown (L-V service) |
| P9 | Weekend result | M-221 (lslab) shown on Saturdays; sdf services on Sun/holidays |
| P10 | Past departures | Trips already departed not shown (filtered to future only) |
| P11 | Tap a result card | Navigates to `route.html?c=4&l=<lineId>&...&from=planner.html?c=4&fromN=201&toN=83` |
| P12 | Back from route | Returns to planner **with results still showing** (not region selector) |
| P13 | Swap button | Reverses From/To; search re-runs |
| P14 | Dropdown attachment | Dropdown has no gap/seam with input field; bottom corners of input are squared off |

---

## 7. Stop Map (`map.html`)

| # | Action | Expected result |
|---|--------|-----------------|
| M1 | Open page | Region overlay shown with 9 region cards |
| M2 | If default region cookie set | Region overlay skipped, map loads immediately for that region |
| M3 | Tap "Área de Málaga" | Overlay hides, map renders with all Málaga stops as blue dots |
| M4 | Map fit | Map bounds fit all stops in the region (padded) |
| M5 | Geolocation granted | Map pans and zooms to user's current location (zoom 13) |
| M6 | Geolocation denied | Map stays on default regional view — no error shown |
| M7 | Tap a stop dot | Popup appears with stop name, nucleo · municipio, "View departures →" button |
| M8 | Popup button text | Button text is white (readable on blue background) |
| M9 | Tap "View departures →" | Navigates to `station.html?c=4&s=<stopId>&from=map.html` |
| M10 | Back from station | Returns to `map.html` |
| M11 | "Change region" pill | Overlay re-appears; selecting new region replaces markers |
| M12 | Zoom/pan | Works smoothly; stop dots remain clickable at all zoom levels |
| M13 | Stops without coords | Filtered out — no markers at 0,0 or null coordinates |

---

## 8. Navigation chain integrity

| Scenario | Expected back chain |
|----------|---------------------|
| index → station → route → stop B station | Back from stop B → route → station → index |
| map → station → route → stop B station | Back from stop B → route → station → map |
| planner → route → stop station | Back from station → route → planner (with results) |
| planner → route (back) | Back from route → planner (with results, not region selector) |

---

## 9. Language switching

| # | Check | Expected |
|---|-------|----------|
| L1 | Toggle on any page | All text updates instantly, no page reload |
| L2 | Navigate to another page | Chosen language persists (stored in cookie) |
| L3 | Station page — toggle during live data | "Now/min" labels re-render from cached data, no API call |
| L4 | Planner results visible — toggle | All labels update; trip times remain correct |

---

## 10. Error states

| # | Scenario | Expected |
|---|----------|----------|
| E1 | API unreachable on region load | "Could not load regions." hint text shown |
| E2 | Stop has no departures today | "No service" card with hint "Check back later" |
| E3 | Station URL missing `c` or `s` param | Redirected to `index.html` immediately |
| E4 | Map: stop coordinates are 0,0 or null | Stop filtered out, not plotted |
| E5 | Map: region API fails | "Could not load regions." shown in overlay |

---

## 11. Known API behaviour notes

- `GET /paradas/{id}/servicios?horaIni=<time>` — `horaIni` format must be `DD-MM-YYYY+HH:MM` (not `HH:MM` alone; the app constructs this via `formatDateForAPI()`)
- The timetable `horas[]` array: index 0 is always the line code column (skip it). Actual times start at index 1, mapped by `nucleos[].colspan`.
- `frecuencias[].acronimo` values seen in wild: `"L-V"`, `"lslab"`, `"sdf"`, `"diari"` — match by `nombre` string for day filtering.
- Stop coords `"0"` or `""` for latitude/longitude indicate no GPS data — must be filtered before plotting.
