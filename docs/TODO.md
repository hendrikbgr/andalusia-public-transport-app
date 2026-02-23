# TODO — CTAN Bus Tracker

Feature ideas, UI/UX improvements, accessibility work, and technical debt.
Roughly grouped by area; not ordered by priority.

---

## Features

### Favourites & History
- [ ] **Saved stops** — star/bookmark any stop from the station page; show a "Saved stops" section on the home screen for one-tap access
- [ ] **Recent searches** — remember the last 5 stop selector searches (region + stop) and surface them at the top of the search list
- [ ] **Saved routes** — let users pin a planner route (e.g. "Coín → Fuengirola") to the home screen
- [ ] **Recent planner trips** — store the last few origin/destination pairs so the planner can offer quick-repeat searches

### Alerts & Notifications
- [ ] **Departure alert** — "notify me when the next bus is X minutes away" — use a Web Notification or an on-screen countdown modal
- [ ] **Service status badge** — show a red/orange badge on a stop card if that line has known disruptions (requires a disruptions/noticias endpoint or scrape `hayNoticias` field from line data — already returned by the API)

### Home Screen
- [ ] **Last viewed stop shortcut** — show a "Recently viewed" card on the home screen with the stop name and next departure time, updating silently in the background
- [ ] **Region pill** — small label on each feature card showing the default region (e.g. "Málaga") to make it feel personalised
- [ ] **PWA install banner** — add `manifest.json` + service worker so the app can be installed to the home screen on iOS/Android and work offline

### Stop Selector (stops.html)
- [ ] **Nearby stops** — add a "Near me" shortcut that uses geolocation to show stops sorted by distance (use the GPS coords already returned by the stops API)
- [ ] **Stop zone badge** — show the fare zone (A–E) on each stop card so users can quickly identify zone before tapping
- [ ] **Consortium description** — brief one-line text under the region name in the selector to help users who don't know which consortium covers their area
- [ ] **Search within all regions** — optional "search everywhere" mode when the user types a town that might span regions

### Station Page (station.html)
- [ ] **Time group headers** — group departures by hour with a sticky header (e.g. "19:00 – 20:00") to make long lists easier to scan
- [ ] **Countdown to next bus** — large-format "next bus in X min" banner at the top of the board for the single most imminent departure
- [ ] **Transfer info** — show `correspondecias` data (already returned by the stop detail API) as a small "Connects to: M-250, M-551" tag under the stop name
- [ ] **Line filter** — when there are many departures, allow filtering by line number so users can watch just the route they care about
- [ ] **Share stop** — native Web Share API button (alongside the QR button) so users can send the stop URL via SMS/WhatsApp
- [ ] **Track bus on map** — a "Track" button that opens the map page centred on the route polyline for that line

### Route Detail (route.html)
- [ ] **Route polyline on map** — use the `polilinea` array already returned by `GET /{c}/lineas/{l}` to draw the bus route on a small embedded Leaflet map at the top of the page
- [ ] **Operator info** — show `operadores` (operating company name) as a small subtitle in the header, already in the API response
- [ ] **Thermometer image** — the API returns `termometroIda`/`termometroVuelta` image URLs showing realtime crowding; display them as a toggle-able panel
- [ ] **Stop ETA** — for each stop in the list, show the scheduled passing time if available from the timetable (would require a join against line timetable data)
- [ ] **Scroll to current stop** — auto-scroll the stop list so the current stop (highlighted in blue) is visible on page load without manual scrolling

### Route Planner (planner.html)
- [ ] **Intermediate stops detail** — clicking "via X, Y, Z" on a result card should expand an inline list of all stops with scheduled times
- [ ] **Return journey** — one-tap "Plan return trip" button on the results page that swaps origin/destination and re-searches
- [ ] **Show on map** — a button on the results page that draws the route polyline on the map page
- [ ] **Tomorrow/date picker** — a simple date toggle (Today / Tomorrow / pick date) to see timetables for a different day
- [ ] **No-service reason** — when the planner returns zero results, check if the route exists but just doesn't run today (day-of-week filter) and tell the user "This route runs Mon–Fri only"

### Map (map.html)
- [ ] **Cluster markers** — at low zoom levels, group nearby stops into numbered clusters (Leaflet.markercluster plugin) to avoid visual overload
- [ ] **Search on map** — a search input at the top of the map so users can type a stop name and pan to it without browsing the list
- [ ] **Show route polyline** — when a stop popup is open, add a "Show route" button that draws the line's `polilinea` on the map
- [ ] **Filter by line** — a filter control that dims all stops except those served by a specific line code
- [ ] **User location dot** — replace the invisible geolocation pan with a persistent blue dot showing the user's current position (and update it)
- [ ] **Geolocation error handling** — if the user denies location, show a small non-blocking toast instead of silently failing
- [ ] **Offline tile cache** — cache map tiles in a service worker so the map works on flaky connections

---

## Accessibility

- [ ] **ARIA live region for departures** — wrap `#departures-board` in an `aria-live="polite"` region so screen readers announce when new departures arrive or the board updates
- [ ] **Focus management on step transitions** — when the planner or stop selector moves from one step to the next, move focus to the new step's heading so keyboard and screen reader users aren't lost
- [ ] **Keyboard navigation for dropdowns** — the planner autocomplete dropdowns should respond to `ArrowDown/Up` to move through options and `Enter` to select, matching standard combobox pattern
- [ ] **Tap target sizes** — audit all interactive elements; anything below 44×44 px (stop index numbers, back-to-region link, lang toggle) should be enlarged or padded to meet WCAG 2.5.5
- [ ] **Colour contrast audit** — `var(--text-muted)` (#6b7280) on white (#ffffff) is ~4.6:1, just passing AA for large text but failing for small body text; increase to ≥ 4.5:1 across all sizes
- [ ] **Focus ring visibility** — ensure all interactive elements show a clearly visible focus ring (currently some are suppressed by browser defaults); add `outline: 2px solid var(--brand)` + `outline-offset: 2px` globally
- [ ] **`<button>` vs `<div role="button">`** — departure cards use `role="button"` on a `<div>`; convert to real `<button>` elements or ensure all keyboard events (Enter, Space) and focus handling are complete
- [ ] **Alt text for QR code** — the generated QR `<canvas>` / `<img>` inside the overlay has no accessible description; add `aria-label` with the stop URL
- [ ] **Skip navigation link** — add a visually-hidden "Skip to main content" link as the first focusable element on every page
- [ ] **Semantic headings** — audit heading hierarchy; several pages use `<h1>` inside the header and then jump to `<div>` labels in the content; add `<h2>` for section headings
- [ ] **Reduced motion** — wrap `@keyframes fadeIn` and `@keyframes pulse` in `@media (prefers-reduced-motion: no-preference)` so users who opt out of animation don't see them
- [ ] **Language attribute update** — `document.documentElement.lang` is set on toggle (good), but `<html lang="en">` is hardcoded in all HTML files; ensure initial server-side value matches the cookie on first load (or accept the JS update is fast enough)
- [ ] **Error announcements** — when the API fails and shows a `.hint` error paragraph, add `role="alert"` so screen readers announce it without the user having to stumble upon it

---

## UI & Visual Improvements

- [ ] **Dark mode** — add a `@media (prefers-color-scheme: dark)` block (or a manual toggle saved to cookie) with a dark palette; the current CSS variable system makes this relatively straightforward
- [ ] **Skeleton screens** — replace the single spinning loader on first page load with content-shaped grey skeleton cards so the layout doesn't jump when data arrives
- [ ] **Departure card micro-animation** — when new cards append during the background day-sweep, add a subtle slide-in from below rather than instant appearance
- [ ] **Empty state illustrations** — replace the 🌙 and 🔍 emoji-only no-service messages with small SVG illustrations for a more polished feel
- [ ] **Map popup close button** — the popup currently has no close button (only closes when clicking elsewhere); add a small ✕ button for touchscreen users who struggle to click outside
- [ ] **Planner swap animation** — animate the ⇅ swap button with a brief rotation when clicked so the swap feels responsive
- [ ] **Home screen greeting animation** — fade in the greeting text on load for a friendlier first impression
- [ ] **Sticky "next departure" banner** — on the station page, keep a compact sticky strip at the top showing the next departure time so it's always visible while scrolling through the full-day list
- [ ] **Long stop names** — very long stop names (e.g. "Estación De Autobuses De Málaga") overflow the header; add `font-size` reduction or marquee behaviour at narrow widths
- [ ] **Line code colour coding** — assign a consistent colour to each line prefix (M-, A-, etc.) so users can visually scan by line rather than reading the badge text

---

## Technical & Developer

- [ ] **PWA manifest** — create `manifest.json` with name, icons, `start_url`, `display: standalone`; link from all HTML files; add a service worker for offline shell caching
- [ ] **Error boundary on API failures** — currently most errors silently show a hint; add a standardised error card with a "Retry" button and the specific endpoint that failed
- [ ] **API response caching** — cache stop list responses in `sessionStorage` with a 5-minute TTL; the stops list for a region is large (~200 KB) and rarely changes
- [ ] **Rate limiting / back-off** — if the day-sweep makes 20+ requests in quick succession and the API rate-limits, add exponential back-off with a maximum retry count
- [ ] **Test: show-on-map button** — add a Playwright test that verifies the "Show on map" button appears on stops with GPS coords and navigates to `map.html` with the correct params
- [ ] **Test: day-sweep appends cards** — add a test that opens a busy stop and waits for additional cards to appear after the initial render (confirming the background sweep fires)
- [ ] **Test: planner return journey** — once the return journey feature is built, cover it with a test
- [ ] **CSP header** — the local HTTP server doesn't set a Content Security Policy; document the recommended CSP for production deployment (block eval, restrict fetch to `api.ctan.es` and CDN origins)
- [ ] **Bundle size audit** — Leaflet (144 KB min+gz) and QRCode.js load on every page that includes them; confirm they're only loaded on the pages that need them (they currently are, but worth documenting)
- [ ] **IE / old Safari** — the app uses `Array.at()`, optional chaining, `structuredClone` etc.; audit ES2020 compatibility against the stated support target and add polyfills or fallbacks if needed

---

## Content & Localisation

- [ ] **Portuguese translation** — the app covers Andalusia but is used by Portuguese tourists too; add `pt` as a third language option
- [ ] **Consortium descriptions** — short one-liner descriptions of each of the 9 consortiums in both languages so users unfamiliar with Spanish geography can identify their area
- [ ] **Help / onboarding** — a one-time tooltip or onboarding overlay on first launch explaining the three main features and how to set a default region
- [ ] **About page** — brief page with app version, data source credit (CTAN API), open-source licence note, and a link to report issues

---

## Unused API Endpoints & Features They Could Power

The CTAN API exposes ~60 endpoints. The app currently uses only 6. Below are the unused endpoint groups and the features they could unlock.
API docs: `https://api.ctan.es/doc/`

### 🗓️ Full Timetables (`/horarios_lineas`, `/horarios_origen_destino`, `/horarios_corredor`)

- [ ] **Full line timetable page** — use `GET /{c}/horarios_lineas?idLinea=&idFrecuencia=&dia=&mes=` to show a complete printable timetable grid for a line (all departure times per nucleus, both directions, for a given day type); link from the route detail page
- [ ] **Direct connection finder** — use `GET /{c}/horarios_origen_destino?idNucleoOrigen=&idNucleoDestino=` to find all direct bus connections between two towns, including times and frequency codes; this is a lighter/faster complement to the full planner
- [ ] **Corridor timetable view** — use `GET /{c}/horarios_corredor?idCorredor=` to render a multi-line corridor timetable (e.g. the entire Costa del Sol corridor in one scrollable grid), similar to national rail departure boards
- [ ] **Day-type picker for timetables** — the timetable endpoints accept a `dia` + `mes` (or frequency ID); expose a "Weekday / Saturday / Sunday" or date picker UI so users can look up tomorrow's or next week's schedule

### 🔔 Service Alerts (`/noticias`, `/lineas/{l}/noticias`, `/infoLineasNoticias`)

- [ ] **Service alerts feed** — use `GET /{c}/noticias` to show an alerts/news page listing current disruptions, engineering works, and service changes for the whole consortium; accessible from the home screen
- [ ] **Line disruption banner** — use `GET /{c}/lineas/{l}/noticias` on the route detail page to show a prominent yellow/red warning banner when that specific line has active alerts; the `hayNoticias` boolean (already in the line API response) can be used to skip the fetch when there are none
- [ ] **Stop disruption badge** — batch-fetch alerts for all lines at a stop using `GET /{c}/infoLineasNoticias/{idLineas}` (comma-separated IDs); show a ⚠️ badge on the departure card for any line with active alerts
- [ ] **Alert detail page** — `GET /{c}/noticias/{idNoticia}` returns full bilingual title + body text; show a modal or dedicated page so the user can read the full disruption notice

### 💶 Fare Calculator (`/calculo_saltos`, `/tarifas_interurbanas`, `/tarifas_urbanas`, `/zonas`, `/saltos`)

- [ ] **Journey fare estimate** — after entering origin and destination in the planner, call `GET /{c}/calculo_saltos?idNucleoOrigen=&idNucleoDestino=` to get the number of zone jumps, then look up the price in `GET /{c}/tarifas_interurbanas`; display "Single ticket: €X.XX · Card: €X.XX" on the result card
- [ ] **Fare zone map overlay** — use `GET /{c}/zonas` (which returns `idZona`, `nombre`, `color`) to render colour-coded zone boundaries or zone labels on the Leaflet map so users can visually understand the pricing geography
- [ ] **Zone badge on stop cards** — the stop detail API already returns `idZona`; cross-reference with `GET /{c}/zonas` to show the zone name (e.g. "Zone A") rather than the raw ID in the stop header and stop selector list
- [ ] **Urban fare info** — use `GET /{c}/tarifas_urbanas` to display urban flat fares (bus/metro within the city) on a dedicated fares info page or in the consortium info panel

### 📍 Points of Interest (`/lugares_interes`, `/tipos_lugares_interes`)

- [ ] **POI map layer** — use `GET /{c}/lugares_interes` to add a toggleable map layer showing hospitals, universities, shopping centres, and airports as labelled icons; tapping a POI shows the nearest stops and a "Get me there" button
- [ ] **"Get me to…" quick search** — a home screen shortcut that lets users pick a POI category (hospital, airport, etc.) and immediately shows direct bus services to that location
- [ ] **POI categories filter** — use `GET /{c}/tipos_lugares_interes` to populate a filter chip row (🏥 Hospital · 🎓 University · ✈️ Airport) on the POI map layer

### 🎫 Ticket Sales Points (`/puntos_venta`)

- [ ] **"Where to buy" map layer** — use `GET /{c}/puntos_venta` to show a map layer of authorised ticket agents, kiosks, and consortium offices; toggleable alongside the stops layer
- [ ] **Nearest sales point** — from any stop or map view, a "Buy ticket nearby" button that calls `GET /{c}/puntos_venta?idMunicipio=&idNucleo=` and lists the nearest sales locations with their address and type

### 🚌 Lines Near Me & Transport Mode Filter (`/lineas?lat=&lon=`, `/modostransporte`)

- [ ] **Lines near me** — use `GET /{c}/lineas?lat=&lon=` (the endpoint accepts GPS coordinates to return nearby lines) to show a "Lines passing near you" card on the home screen or map; complements the existing "nearby stops" idea
- [ ] **Transport mode filter** — use `GET /{c}/modostransporte` to get the list of modes (bus, metro, tram, etc.) and add mode-filter chips to the lines list and map view; use `GET /{c}/modostransporte/{id}/lineas` to fetch lines filtered by mode

### 🏙️ Hierarchical Location Browser (`/municipios`, `/nucleos`)

- [ ] **Municipality → Nucleus → Lines drill-down** — use `GET /{c}/municipios/` → `GET /{c}/municipios/{id}/nucleos` → `GET /{c}/nucleos/{id}/lineas` to build a geographic drill-down browser as an alternative to free-text stop search; useful for users who know their town but not the stop name
- [ ] **Planner origin/destination via town name** — use `GET /{c}/nucleos` to let the planner's origin/destination fields autocomplete by town/district name (nuclei) rather than requiring the user to know the full stop name; feed the resulting `idNucleo` into `horarios_origen_destino`
- [ ] **Stops in this town** — from the nucleus/town detail, use `GET /{c}/nucleos/{idNucleo}/paradas` to list all stops in that district and let the user tap through to any stop's departure board

### 📋 Schedule Frequency Codes (`/frecuencias`, `/abreviaturas`)

- [ ] **Frequency code decoder** — use `GET /{c}/frecuencias` and `GET /{c}/abreviaturas` to replace the raw abbreviation codes shown in timetable grids (e.g. `L`, `FV`, `SAB`, `FES`) with human-readable labels ("Weekdays", "Weekdays + Saturday", "Saturdays", "Public holidays"); show as a legend under any timetable view

### ℹ️ Consortium Info & Configuration (`/configuracion`, `/att_usuario`)

- [ ] **Per-consortium help page** — use `GET /{c}/att_usuario` to show the consortium's HTML-formatted customer service contact details (phone, email, office hours) on a dedicated "Help & Contact" page
- [ ] **Consortium feature flags** — use `GET /{c}/configuracion` to read `verTarifas` (show/hide fares), `numAtencionUnica` (helpline number), `urlTwitter` / `urlFacebook` (social media links); conditionally show fare calculator and social links only for consortiums that support them
- [ ] **Social media links** — surface `urlTwitter` / `urlFacebook` from the configuration endpoint on the consortium info panel or about page so users can follow official service accounts for real-time updates

---
