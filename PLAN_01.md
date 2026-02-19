# PLAN_01.md — CTAN Bus Tracker: 9-Feature Implementation Plan

## Introduction

This plan covers the implementation of nine features ranked by user value. They span five existing pages and introduce one new page (`timetable.html`). Features are grouped into three tiers by dependency and risk:

- **Tier 1 — Self-contained, one page each:** Feature 25 (Location Dot), Feature 6 (PWA Banner), Feature 8 (Disruption Banner), Feature 1 (Saved Stops)
- **Tier 2 — Cross-page or new patterns:** Feature 11 (Date Picker), Feature 22 (Direct Connections), Feature 23 (Route Polyline)
- **Tier 3 — New page + new API endpoints:** Feature 21 (Timetable Page), Feature 26 (Stop ETA)

---

## Feature 1: Saved Stops

**Rank:** 1 · **Complexity:** Medium

**Description:** Users can star any stop from the station page. Saved stops appear as a dedicated "Saved Stops" section on the home screen (`index.html`) for one-tap access and can be removed from either page.

### Files to modify

| File | Change |
|------|--------|
| `station.html` | Add save button |
| `src/js/station.js` | Save/unsave logic, button render |
| `index.html` | Add saved stops section |
| `src/js/index.js` | Render saved stops list |
| `src/js/i18n.js` | New translation keys |
| `src/style.css` | New styles |

### New HTML elements

**`station.html`** — inside `.station-main`, right after `#show-on-map-btn`:

```html
<button id="save-stop-btn" class="save-stop-btn hidden" aria-label="Save this stop">
  ☆ <span id="save-stop-label">Save stop</span>
</button>
```

**`index.html`** — new section inserted inside `<main>`, after the existing `.home-card-grid` (or stop list area), as its own top-level navigation section:

```html
<div id="saved-stops-section" class="saved-stops-section hidden">
  <div class="step-label" id="saved-stops-heading">Saved Stops</div>
  <div id="saved-stops-list" class="card-list"></div>
  <p id="saved-stops-empty" class="hint hidden">No saved stops yet</p>
</div>
```

This section should appear **before** the region selector / consortium cards so it's the first thing a returning user sees.

### New CSS classes

```css
/* Save button on station page */
.save-stop-btn {
  display: block;
  width: 100%;
  text-align: center;
  margin: 0 0 14px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.save-stop-btn.saved {
  border-color: var(--brand);
  color: var(--brand);
}
.save-stop-btn.hidden { display: none !important; }

/* Saved stops section on home screen */
.saved-stops-section { margin-bottom: 24px; }
.saved-stops-section.hidden { display: none !important; }

/* Individual saved stop card */
.saved-stop-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  margin-bottom: 8px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}
.saved-stop-card-body { flex: 1; min-width: 0; }
.saved-stop-card-name { font-weight: 600; font-size: 0.95rem; truncate; }
.saved-stop-card-meta { font-size: 0.8rem; color: var(--text-muted); }
.saved-stop-remove-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.saved-stop-remove-btn:hover { color: var(--danger, #dc2626); }
```

### New JS functions — `src/js/station.js`

```js
// Cookie helpers for saved stops
function getSavedStops() {
  try { return JSON.parse(getCookie('savedStops') || '[]'); }
  catch { return []; }
}
function setSavedStops(arr) {
  setCookie('savedStops', JSON.stringify(arr.slice(0, 20)), 365);
}
function isStopSaved(idConsorcio, idParada) {
  return getSavedStops().some(
    s => String(s.idConsorcio) === String(idConsorcio) && String(s.idParada) === String(idParada)
  );
}
function saveStop(entry) {
  const arr = getSavedStops().filter(
    s => !(String(s.idConsorcio) === String(entry.idConsorcio) && String(s.idParada) === String(entry.idParada))
  );
  arr.unshift(entry); // newest first
  setSavedStops(arr);
}
function removeStop(idConsorcio, idParada) {
  setSavedStops(getSavedStops().filter(
    s => !(String(s.idConsorcio) === String(idConsorcio) && String(s.idParada) === String(idParada))
  ));
}

// Render the save/unsave button (called after loadStopInfo() resolves)
function renderSaveButton() {
  const btn = document.getElementById('save-stop-btn');
  const label = document.getElementById('save-stop-label');
  if (!stopInfo) return;
  btn.classList.remove('hidden');
  const saved = isStopSaved(CONSORCIO_ID, STOP_ID);
  btn.classList.toggle('saved', saved);
  label.textContent = saved ? t('unsaveStop') : t('saveStop');
  // Update star glyph
  btn.childNodes[0].textContent = saved ? '★ ' : '☆ ';

  btn.onclick = () => {
    if (isStopSaved(CONSORCIO_ID, STOP_ID)) {
      removeStop(CONSORCIO_ID, STOP_ID);
    } else {
      saveStop({
        idConsorcio: CONSORCIO_ID,
        idParada: STOP_ID,
        nombre: stopInfo.nombre || `Stop ${STOP_ID}`,
        nucleo: stopInfo.nucleo || '',
        municipio: stopInfo.municipio || '',
      });
    }
    renderSaveButton();
  };
}
// Call renderSaveButton() at the end of loadStopInfo()
```

### New JS functions — `src/js/index.js`

```js
// Reuse same cookie helpers (getSavedStops, removeStop) — inline or import via shared pattern
function renderSavedStops() {
  const section = document.getElementById('saved-stops-section');
  const list    = document.getElementById('saved-stops-list');
  const empty   = document.getElementById('saved-stops-empty');
  const heading = document.getElementById('saved-stops-heading');
  const stops   = getSavedStops();

  heading.textContent = t('savedStops');

  if (!stops.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = '';
  empty.classList.add('hidden');

  stops.forEach(stop => {
    const card = document.createElement('a');
    card.className = 'saved-stop-card';
    card.href = `station.html?c=${stop.idConsorcio}&s=${stop.idParada}&from=index.html`;
    card.innerHTML = `
      <div class="saved-stop-card-body">
        <div class="saved-stop-card-name">${escHtml(stop.nombre)}</div>
        <div class="saved-stop-card-meta">${escHtml([stop.nucleo, stop.municipio].filter(Boolean).join(' · '))}</div>
      </div>
      <button class="saved-stop-remove-btn" title="Remove" aria-label="Remove ${escHtml(stop.nombre)}">✕</button>
    `;
    card.querySelector('.saved-stop-remove-btn').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      removeStop(stop.idConsorcio, stop.idParada);
      renderSavedStops();
    });
    list.appendChild(card);
  });
}
// Call renderSavedStops() on page load and inside applyLang() for label updates
```

### New i18n keys (`src/js/i18n.js`)

```js
// en
saveStop:       'Save stop',
unsaveStop:     'Saved ★',
savedStops:     'Saved Stops',
savedStopsEmpty:'No saved stops yet',

// es
saveStop:       'Guardar parada',
unsaveStop:     'Guardada ★',
savedStops:     'Paradas guardadas',
savedStopsEmpty:'No hay paradas guardadas',
```

### New cookies

| Cookie | Format | TTL |
|--------|--------|-----|
| `savedStops` | JSON array of `{idConsorcio, idParada, nombre, nucleo, municipio}`, max 20 | 365 days |

### API endpoints

None new — uses data already loaded by `loadStopInfo()`.

### Dependencies

None.

---

## Feature 6: PWA Install Banner

**Rank:** 6 · **Complexity:** Low-Medium

**Description:** When the browser fires `beforeinstallprompt`, a small non-intrusive banner appears at the bottom of the home screen. The user can install the app or permanently dismiss the banner. Never shown in standalone mode or after dismissal.

### Files to create or modify

| File | Change |
|------|--------|
| `manifest.json` *(create)* | App manifest |
| `sw.js` *(create)* | Service worker, offline shell |
| `icons/icon-192.png` *(create)* | App icon asset |
| `icons/icon-512.png` *(create)* | App icon asset |
| `index.html` | Add banner HTML + manifest link + SW registration |
| All other HTML files | Add `<link rel="manifest">` + `<meta name="theme-color">` + SW registration |
| `src/js/index.js` | Banner logic |
| `src/style.css` | Banner styles |

### `manifest.json` (project root)

```json
{
  "name": "CTAN Bus Tracker",
  "short_name": "Bus Tracker",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#1a6fdb",
  "theme_color": "#1a6fdb",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### `sw.js` (project root) — offline shell only

```js
const CACHE = 'ctan-shell-v1';
const SHELL = [
  '/index.html', '/station.html', '/route.html',
  '/planner.html', '/map.html', '/timetable.html',
  '/src/style.css', '/src/js/i18n.js', '/src/js/index.js',
  '/src/js/station.js', '/src/js/route.js',
  '/src/js/planner.js', '/src/js/map.js',
];
self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
);
self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.ctan.es')) return; // always network for API
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

### New HTML — `index.html`

Add to `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1a6fdb" />
```

Add just before `</body>`:
```html
<div id="pwa-banner" class="pwa-banner hidden" role="region" aria-label="Install app">
  <span id="pwa-banner-text">Install for quick access</span>
  <div class="pwa-banner-actions">
    <button id="pwa-install-btn" class="pwa-install-btn">Install</button>
    <button id="pwa-dismiss-btn" class="pwa-dismiss-btn">✕ Not now</button>
  </div>
</div>
<script>
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
</script>
```

Add to all other HTML files (no banner HTML needed, just manifest + SW):
```html
<!-- in <head> -->
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1a6fdb" />
<!-- before </body> -->
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script>
```

### New CSS classes

```css
.pwa-banner {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 300;
  background: var(--surface);
  border-top: 1.5px solid var(--border);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
  font-size: 0.85rem;
}
.pwa-banner.hidden { display: none !important; }
.pwa-banner-actions { display: flex; gap: 8px; margin-left: auto; flex-shrink: 0; }
.pwa-install-btn {
  background: var(--brand); color: #fff;
  border: none; border-radius: 8px;
  padding: 8px 16px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.pwa-dismiss-btn {
  background: none; border: 1.5px solid var(--border);
  border-radius: 8px; padding: 8px 12px;
  font-size: 0.85rem; color: var(--text-muted); cursor: pointer;
}
```

### New JS logic — `src/js/index.js`

```js
let deferredInstallPrompt = null;

function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

function initPWABanner() {
  if (isPWAInstalled()) return;
  if (getCookie('pwaPromptDismissed') === '1') return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const banner = document.getElementById('pwa-banner');
    document.getElementById('pwa-banner-text').textContent = t('pwaInstallMsg');
    document.getElementById('pwa-install-btn').textContent = t('pwaInstall');
    document.getElementById('pwa-dismiss-btn').textContent = t('pwaDismiss');
    banner.classList.remove('hidden');
  });

  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('pwa-banner').classList.add('hidden');
  });

  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    setCookie('pwaPromptDismissed', '1', 365);
    document.getElementById('pwa-banner').classList.add('hidden');
  });
}

// Call initPWABanner() on page load
```

### New i18n keys

```js
// en
pwaInstallMsg: 'Install for quick access',
pwaInstall:    'Install',
pwaDismiss:    '✕ Not now',

// es
pwaInstallMsg: 'Instalar para acceso rápido',
pwaInstall:    'Instalar',
pwaDismiss:    '✕ Ahora no',
```

### New cookies

| Cookie | Value | TTL |
|--------|-------|-----|
| `pwaPromptDismissed` | `'1'` | 365 days |

### API endpoints

None.

### Dependencies

None. (Add `timetable.html` to the SHELL array when Feature 21 is built.)

---

## Feature 8: Line Disruption Banner

**Rank:** 8 · **Complexity:** Low

**Description:** On the route detail page, when the loaded line has `hayNoticias === true`, a collapsible amber banner appears listing alert titles. Tapping an alert expands its full body text in the current language. No banner is shown and no extra fetch is made when `hayNoticias` is false.

### Files to modify

| File | Change |
|------|--------|
| `route.html` | Add banner HTML |
| `src/js/route.js` | Fetch + render alerts |
| `src/js/i18n.js` | New keys |
| `src/style.css` | Banner styles |

### New HTML — `route.html`

Insert as the **first child** of `<main class="main-content station-main">`, above `#direction-tabs`:

```html
<div id="disruption-banner" class="disruption-banner hidden">
  <div class="disruption-banner-header">
    <span class="disruption-icon">⚠️</span>
    <span id="disruption-banner-title" class="disruption-banner-title">Service alerts</span>
  </div>
  <div id="disruption-alerts-list" class="disruption-alerts-list"></div>
</div>
```

### New CSS classes

```css
.disruption-banner {
  background: #fffbeb;
  border: 1.5px solid #f59e0b;
  border-radius: var(--radius);
  margin-bottom: 14px;
  overflow: hidden;
}
.disruption-banner.hidden { display: none !important; }

.disruption-banner-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  font-weight: 600; font-size: 0.88rem; color: #b45309;
}
.disruption-icon { font-size: 1rem; flex-shrink: 0; }

.disruption-alerts-list { border-top: 1px solid #f59e0b; }

.disruption-alert-item {
  border-bottom: 1px solid rgba(245,158,11,0.25);
  cursor: pointer;
}
.disruption-alert-item:last-child { border-bottom: none; }

.disruption-alert-title {
  padding: 10px 14px;
  font-size: 0.88rem; font-weight: 500; color: #92400e;
  display: flex; justify-content: space-between; align-items: center;
}
.disruption-alert-title::after { content: '▾'; font-size: 0.75rem; opacity: 0.7; }
.disruption-alert-item.open .disruption-alert-title::after { content: '▴'; }

.disruption-alert-body {
  padding: 0 14px 12px;
  font-size: 0.82rem; color: var(--text); line-height: 1.5;
  display: none;
}
.disruption-alert-item.open .disruption-alert-body { display: block; }
```

### New JS logic — `src/js/route.js`

```js
// Module-level state
let alertsData = null;

// New element references
const disruptionBanner      = document.getElementById('disruption-banner');
const disruptionBannerTitle = document.getElementById('disruption-banner-title');
const disruptionAlertsList  = document.getElementById('disruption-alerts-list');

async function loadDisruptions() {
  if (!lineaData?.hayNoticias) return;
  try {
    const data = await fetchJSON(`${API}/${CONSORCIO_ID}/lineas/${LINEA_ID}/noticias`);
    alertsData = data.noticias || [];
    if (alertsData.length) renderDisruptionBanner(alertsData);
  } catch { /* non-critical, fail silently */ }
}

function renderDisruptionBanner(alerts) {
  if (!alerts?.length) return;
  const lang = getLang();
  disruptionBannerTitle.textContent = t('serviceAlerts');
  disruptionAlertsList.innerHTML = '';

  alerts.forEach(alert => {
    const title = lang === 'es'
      ? (alert.titulo    || alert.tituloEng || '')
      : (alert.tituloEng || alert.titulo    || '');
    const body  = lang === 'es'
      ? (alert.cuerpo    || alert.cuerpoEng || '')
      : (alert.cuerpoEng || alert.cuerpo    || '');

    const item = document.createElement('div');
    item.className = 'disruption-alert-item';
    item.innerHTML = `
      <div class="disruption-alert-title">${escHtml(title)}</div>
      <div class="disruption-alert-body">${escHtml(body)}</div>
    `;
    item.querySelector('.disruption-alert-title')
      .addEventListener('click', () => item.classList.toggle('open'));
    disruptionAlertsList.appendChild(item);
  });

  disruptionBanner.classList.remove('hidden');
}

// In initPage(): call await loadDisruptions() after line data loads
// In lang toggle handler: if (alertsData) renderDisruptionBanner(alertsData)
```

### New i18n keys

```js
// en
serviceAlerts: 'Service alerts',

// es
serviceAlerts: 'Alertas de servicio',
```

### New cookies

None.

### API endpoints

- `GET /{c}/lineas/{l}` — already fetched; reads `hayNoticias`
- `GET /{c}/lineas/{l}/noticias` — new; only called when `hayNoticias === true`

### Dependencies

None.

---

## Feature 11: Tomorrow / Date Picker (Planner)

**Rank:** 11 · **Complexity:** Low

**Description:** A three-button date toggle row ("Today / Tomorrow / Pick date") appears below the search form in the planner. The selected date is used for day-of-week filtering in results. "Pick date" reveals a native date input.

### Files to modify

| File | Change |
|------|--------|
| `planner.html` | Add date toggle row HTML |
| `src/js/planner.js` | Date mode state + `getSearchDate()` helper |
| `src/style.css` | Toggle button styles |

### New HTML — `planner.html`

Insert inside `#step-form`, immediately after the `<button class="search-btn">`:

```html
<div id="date-toggle-row" class="date-toggle-row">
  <button class="date-toggle-btn active" id="date-btn-today"    data-mode="today">Today</button>
  <button class="date-toggle-btn"        id="date-btn-tomorrow" data-mode="tomorrow">Tomorrow</button>
  <button class="date-toggle-btn"        id="date-btn-pick"     data-mode="pick">Pick date</button>
  <input  type="date" id="date-picker-input" class="date-picker-input hidden" />
</div>
```

### New CSS classes

```css
.date-toggle-row {
  display: flex; gap: 6px; margin-top: 10px;
  align-items: center; flex-wrap: wrap;
}
.date-toggle-btn {
  flex: 1; min-width: 70px;
  padding: 8px 6px;
  border: 1.5px solid var(--border); border-radius: 10px;
  background: var(--surface); color: var(--text-muted);
  font-size: 0.82rem; font-weight: 600; cursor: pointer; text-align: center;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.date-toggle-btn.active {
  background: var(--brand); border-color: var(--brand); color: #fff;
}
.date-picker-input {
  border: 1.5px solid var(--brand); border-radius: 10px;
  padding: 8px 10px; font-size: 0.85rem;
  color: var(--text); background: var(--surface);
  outline: none; flex: 2;
}
.date-picker-input.hidden { display: none !important; }
```

### New JS logic — `src/js/planner.js`

```js
// New state
let selectedDateMode   = 'today';
let selectedPickedDate = null;

// New element references
const dateBtnToday    = document.getElementById('date-btn-today');
const dateBtnTomorrow = document.getElementById('date-btn-tomorrow');
const dateBtnPick     = document.getElementById('date-btn-pick');
const datePickerInput = document.getElementById('date-picker-input');

// Set min date to today
datePickerInput.min = new Date().toISOString().slice(0, 10);

function getSearchDate() {
  if (selectedDateMode === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (selectedDateMode === 'pick' && selectedPickedDate) return selectedPickedDate;
  return new Date();
}

function setDateMode(mode) {
  selectedDateMode = mode;
  [dateBtnToday, dateBtnTomorrow, dateBtnPick].forEach(b => b.classList.remove('active'));
  ({ today: dateBtnToday, tomorrow: dateBtnTomorrow, pick: dateBtnPick })[mode].classList.add('active');
  datePickerInput.classList.toggle('hidden', mode !== 'pick');
}

dateBtnToday.addEventListener('click',    () => setDateMode('today'));
dateBtnTomorrow.addEventListener('click', () => setDateMode('tomorrow'));
dateBtnPick.addEventListener('click', () => {
  setDateMode('pick');
  datePickerInput.showPicker?.();
  datePickerInput.focus();
});
datePickerInput.addEventListener('change', () => {
  if (datePickerInput.value) {
    const [y, m, d] = datePickerInput.value.split('-').map(Number);
    selectedPickedDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  }
});

// In runSearch() replace: const now = new Date();
// with:                    const now = getSearchDate();
// (the rest of the function is unchanged — day-of-week filtering uses now.getDay())
```

In `applyLang()` / `s()` calls, update button labels:
```js
dateBtnToday.textContent    = s('dateToday');
dateBtnTomorrow.textContent = s('dateTomorrow');
dateBtnPick.textContent     = s('datePick');
```

### New i18n keys (in `planner.js` local `STRINGS` object)

```js
// en
dateToday:    'Today',
dateTomorrow: 'Tomorrow',
datePick:     'Pick date',

// es
dateToday:    'Hoy',
dateTomorrow: 'Mañana',
datePick:     'Elegir fecha',
```

### New cookies

None — date selection is ephemeral (session only).

### API endpoints

None new. The existing `horarios_origen_destino` call is unchanged; only the `now` reference used for day-of-week filtering changes.

### Dependencies

None. Feature 22 depends on `getSearchDate()` introduced here.

---

## Feature 21: Full Line Timetable Page

**Rank:** 21 · **Complexity:** High

**Description:** A new "Full timetable" button on the route detail page opens a dedicated `timetable.html` page showing a complete scrollable timetable grid for the line. Tabs select direction (Outbound/Inbound) and day type (from the `/frecuencias` endpoint).

### Files to create or modify

| File | Change |
|------|--------|
| `timetable.html` *(create)* | New page shell |
| `src/js/timetable.js` *(create)* | All timetable logic |
| `route.html` | Add "Full timetable" button |
| `src/js/route.js` | Reveal button + build URL |
| `src/js/i18n.js` | New keys |
| `src/style.css` | Grid + freq tab styles |
| `sw.js` | Add `timetable.html` to SHELL |

### `timetable.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Timetable</title>
  <link rel="stylesheet" href="src/style.css" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1a6fdb" />
</head>
<body>
  <div id="app">
    <header class="app-header station-header">
      <div class="header-inner">
        <a id="back-btn" class="back-link" title="Back">←</a>
        <div class="header-text">
          <h1 id="tt-title">Timetable</h1>
          <span id="tt-meta" class="station-meta"></span>
        </div>
        <button class="lang-toggle" id="lang-toggle">EN</button>
      </div>
    </header>
    <main class="main-content station-main">
      <div id="tt-direction-tabs" class="direction-tabs"></div>
      <div id="tt-freq-tabs" class="tt-freq-tabs"></div>
      <div id="tt-grid-wrapper" class="tt-grid-wrapper">
        <div class="loading-spinner"></div>
      </div>
    </main>
  </div>
  <script src="src/js/i18n.js"></script>
  <script src="src/js/timetable.js"></script>
  <script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script>
</body>
</html>
```

### New HTML — `route.html`

Add after `#direction-tabs`, before any existing hint/stop list:

```html
<a id="timetable-btn" class="timetable-link-btn hidden" href="#">Full timetable</a>
```

### New CSS classes

```css
/* Full timetable link on route.html */
.timetable-link-btn {
  display: block; text-align: center;
  margin: 0 0 10px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1.5px solid var(--brand);
  border-radius: 12px;
  color: var(--brand);
  font-size: 0.9rem; font-weight: 600; text-decoration: none;
}
.timetable-link-btn.hidden { display: none !important; }

/* Frequency (day-type) tab bar */
.tt-freq-tabs {
  display: flex; gap: 6px; margin-bottom: 12px;
  overflow-x: auto; padding-bottom: 2px;
  scrollbar-width: none;
}
.tt-freq-tabs::-webkit-scrollbar { display: none; }
.tt-freq-tab {
  flex-shrink: 0;
  padding: 7px 14px;
  border: 1.5px solid var(--border); border-radius: 20px;
  background: var(--surface); color: var(--text-muted);
  font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.tt-freq-tab.active { background: var(--brand); border-color: var(--brand); color: #fff; }

/* Scrollable timetable grid */
.tt-grid-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }

.tt-grid {
  border-collapse: collapse; font-size: 0.78rem; min-width: 100%;
}
.tt-grid th, .tt-grid td {
  padding: 6px 10px; text-align: center;
  border: 1px solid var(--border); white-space: nowrap;
}
.tt-grid th {
  background: var(--brand); color: #fff; font-weight: 700; font-size: 0.75rem;
  position: sticky; top: 0; z-index: 2;
}
.tt-grid td:first-child {
  text-align: left; font-weight: 600;
  background: var(--surface);
  position: sticky; left: 0; z-index: 1;
  border-right: 2px solid var(--border);
  min-width: 120px; max-width: 160px;
  overflow: hidden; text-overflow: ellipsis;
}
.tt-grid tr:nth-child(even) td { background: var(--bg); }
.tt-grid tr:nth-child(even) td:first-child { background: var(--bg); }
.tt-no-data {
  text-align: center; padding: 32px 16px;
  color: var(--text-muted); font-size: 0.9rem;
}
```

### New JS — `src/js/timetable.js`

```js
const API = 'https://api.ctan.es/v1/Consorcios';
const params      = new URLSearchParams(location.search);
const CONSORCIO_ID = params.get('c');
const LINEA_ID     = params.get('l');
const LINEA_CODE   = params.get('code') || '';
const BACK_URL     = params.get('from') || 'index.html';

if (!CONSORCIO_ID || !LINEA_ID) location.href = 'index.html';

const backBtn         = document.getElementById('back-btn');
const ttTitle         = document.getElementById('tt-title');
const ttMeta          = document.getElementById('tt-meta');
const ttDirectionTabs = document.getElementById('tt-direction-tabs');
const ttFreqTabs      = document.getElementById('tt-freq-tabs');
const ttGridWrapper   = document.getElementById('tt-grid-wrapper');
const langToggle      = document.getElementById('lang-toggle');

backBtn.href = BACK_URL;

let frecuencias = [];
let activeFreq  = null;
let activeDir   = '1';

function applyLang() {
  langToggle.textContent = getLang() === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = getLang();
  ttTitle.textContent = LINEA_CODE || t('timetableTitle');
  document.title = `${LINEA_CODE} — ${t('timetableTitle')}`;
}
langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
});
applyLang();

async function initPage() {
  try {
    const data = await fetchJSON(`${API}/${CONSORCIO_ID}/frecuencias`);
    frecuencias = data.frecuencias || [];
    buildDirectionTabs();
    buildFreqTabs();
    if (activeFreq) await loadAndRenderGrid();
  } catch {
    ttGridWrapper.innerHTML = `<p class="hint">${t('noTimetable')}</p>`;
  }
}

function buildDirectionTabs() {
  ttDirectionTabs.innerHTML = '';
  [{ dir: '1', label: t('outbound') }, { dir: '2', label: t('inbound') }].forEach(({ dir, label }) => {
    const btn = document.createElement('button');
    btn.className = `dir-tab${dir === activeDir ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      activeDir = dir;
      ttDirectionTabs.querySelectorAll('.dir-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await loadAndRenderGrid();
    });
    ttDirectionTabs.appendChild(btn);
  });
}

function buildFreqTabs() {
  ttFreqTabs.innerHTML = '';
  frecuencias.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = `tt-freq-tab${i === 0 ? ' active' : ''}`;
    btn.textContent = f.nombre || f.acronimo || f.idFrecuencia;
    if (i === 0) activeFreq = f;
    btn.addEventListener('click', async () => {
      ttFreqTabs.querySelectorAll('.tt-freq-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFreq = f;
      await loadAndRenderGrid();
    });
    ttFreqTabs.appendChild(btn);
  });
}

async function loadAndRenderGrid() {
  ttGridWrapper.innerHTML = '<div class="loading-spinner"></div>';
  const today = new Date();
  const dia = String(today.getDate()).padStart(2, '0');
  const mes = String(today.getMonth() + 1).padStart(2, '0');
  try {
    const data = await fetchJSON(
      `${API}/${CONSORCIO_ID}/horarios_lineas` +
      `?idLinea=${LINEA_ID}&idFrecuencia=${activeFreq.idFrecuencia}&dia=${dia}&mes=${mes}`
    );
    renderGrid(data);
  } catch {
    ttGridWrapper.innerHTML = `<p class="tt-no-data">${t('noTimetable')}</p>`;
  }
}

function renderGrid(data) {
  // NOTE: The exact shape of horarios_lineas must be verified during implementation
  // against the live API. Adapt field names (nucleos, horario, horas, sentido) as needed.
  const horario = (data.horario || []).filter(row =>
    !row.sentido || String(row.sentido) === activeDir
  );
  const nucleos = data.nucleos || [];

  if (!horario.length || !nucleos.length) {
    ttGridWrapper.innerHTML = `<p class="tt-no-data">${t('noTimetable')}</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'tt-grid';

  // Header: stop-name col + one col per trip (departure time at first nucleus)
  const thead = document.createElement('thead');
  const hRow  = document.createElement('tr');
  const hStop = document.createElement('th');
  hStop.textContent = t('timetableStop');
  hRow.appendChild(hStop);
  horario.forEach(trip => {
    const th = document.createElement('th');
    th.textContent = trip.horas?.[0] !== '--' ? (trip.horas?.[0] ?? '') : '';
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Body: one row per nucleus
  const tbody = document.createElement('tbody');
  nucleos.forEach((nucleo, i) => {
    const tr   = document.createElement('tr');
    const tdN  = document.createElement('td');
    tdN.textContent = nucleo.nombre || nucleo;
    tr.appendChild(tdN);
    horario.forEach(trip => {
      const td   = document.createElement('td');
      const time = trip.horas?.[i];
      td.textContent = (time && time !== '--') ? time : '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  ttGridWrapper.innerHTML = '';
  ttGridWrapper.appendChild(table);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

initPage();
```

### Changes to `src/js/route.js`

```js
// New element reference
const timetableBtn = document.getElementById('timetable-btn');

// At the end of initPage(), after lineaData is set:
function initTimetableButton() {
  const from = encodeURIComponent(location.href);
  timetableBtn.href = `timetable.html?c=${CONSORCIO_ID}&l=${LINEA_ID}` +
    `&code=${encodeURIComponent(LINEA_CODE)}&from=${from}`;
  timetableBtn.textContent = t('fullTimetable');
  timetableBtn.classList.remove('hidden');
}
// Also update label in applyLang(): timetableBtn.textContent = t('fullTimetable')
```

### New i18n keys

```js
// en
timetableTitle: 'Full Timetable',
fullTimetable:  'Full timetable',
noTimetable:    'No timetable data available',
timetableStop:  'Stop',

// es
timetableTitle: 'Horario Completo',
fullTimetable:  'Horario completo',
noTimetable:    'No hay datos de horario disponibles',
timetableStop:  'Parada',
```

### New cookies

None.

### API endpoints

- `GET /{c}/frecuencias` — day-type tabs
- `GET /{c}/horarios_lineas?idLinea=&idFrecuencia=&dia=&mes=` — grid data

### Dependencies

None mandatory. If Feature 26 is built after this one, it can reuse the `horarios_lineas` parsing pattern.

---

## Feature 22: Direct Connection Finder

**Rank:** 22 · **Complexity:** Low-Medium

**Description:** After a planner search, a secondary "Also direct:" section below the main results shows all direct buses between the two towns for the full day, sorted by departure time. This uses the same API endpoint but presents a complete day-reference view rather than "next 12 results".

### Files to modify

| File | Change |
|------|--------|
| `planner.html` | Add direct section HTML |
| `src/js/planner.js` | Refactor nucleus parsing + render direct list |
| `src/style.css` | Direct result card style |

### New HTML — `planner.html`

Inside `#step-results`, after `#results-list`:

```html
<div id="direct-section" class="direct-section hidden">
  <div class="step-label" id="direct-section-label">Also direct:</div>
  <div id="direct-list" class="card-list"></div>
</div>
```

### New CSS classes

```css
.direct-section { margin-top: 20px; }
.direct-section.hidden { display: none !important; }
.direct-result-card { border-left: 3px solid var(--brand); }
```

### New JS logic — `src/js/planner.js`

The existing `renderResults()` function already parses nucleus indices from the `horarios_origen_destino` response. Refactor this parsing into a shared helper:

```js
// Extracted shared helper (refactor from existing renderResults code)
function parseNucleoIndices(data) {
  const nucleos  = data.nucleos || data.bloques || [];
  // selectedFrom / selectedTo are module-level state set during runSearch()
  const originIndices = [];
  const destIndices   = [];
  nucleos.forEach((n, i) => {
    const name = (n.nombre || n.name || '').toLowerCase();
    if (selectedFrom && name.includes((selectedFrom.nucleo || '').toLowerCase())) originIndices.push(i);
    if (selectedTo   && name.includes((selectedTo.nucleo   || '').toLowerCase())) destIndices.push(i);
  });
  return { originIndices, destIndices };
}

// New element references
const directSection      = document.getElementById('direct-section');
const directSectionLabel = document.getElementById('direct-section-label');
const directList         = document.getElementById('direct-list');

// Cache the last API response to avoid a second fetch
let lastResultsData = null;

// In runSearch(), after the fetch: lastResultsData = data;
// Then call renderDirectConnections(data, now) after renderResults(data, now)

function renderDirectConnections(data, now) {
  directSection.classList.add('hidden');
  const horario = data.horario || [];
  if (!horario.length) return;

  const { originIndices, destIndices } = parseNucleoIndices(data);
  if (!originIndices.length || !destIndices.length) return;

  const trips = horario.map(trip => {
    let depStr = null;
    for (const idx of originIndices) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { depStr = h; break; }
    }
    if (!depStr) return null;
    const [hh, mm] = depStr.split(':').map(Number);
    const depTime  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    let arrStr = null;
    for (const idx of [...destIndices].reverse()) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { arrStr = h; break; }
    }
    return { ...trip, depStr, arrStr, depTime };
  })
  .filter(Boolean)
  .sort((a, b) => a.depTime - b.depTime);

  if (!trips.length) return;

  directSectionLabel.textContent = s('directConnections');
  directList.innerHTML = '';
  trips.forEach(trip => {
    const card = document.createElement('div');
    card.className = 'card direct-result-card';
    card.innerHTML = `
      <div class="departure-line">${escHtml(trip.codigo || '')}</div>
      <div class="departure-body">
        <div class="departure-dest">${escHtml(selectedTo?.nombre || '')}</div>
        <div class="departure-name planner-days">${escHtml(trip.dias || '')}</div>
      </div>
      <div class="departure-time-col">
        <span class="departure-sched">${escHtml(trip.depStr)}</span>
        ${trip.arrStr ? `<span style="font-size:0.78rem;color:var(--text-muted)">→ ${escHtml(trip.arrStr)}</span>` : ''}
      </div>
    `;
    directList.appendChild(card);
  });
  directSection.classList.remove('hidden');
}
```

### New i18n keys (in `planner.js` local `STRINGS`)

```js
// en
directConnections: 'All departures today:',

// es
directConnections: 'Todas las salidas hoy:',
```

### New cookies

None.

### API endpoints

- `GET /{c}/horarios_origen_destino` — same call as main planner; reuse cached `lastResultsData` rather than fetching twice.

### Dependencies

Feature 11 — use `getSearchDate()` for the `now` parameter if Feature 11 has been implemented.

---

## Feature 23: Route Polyline on Map

**Rank:** 23 · **Complexity:** Medium

**Description:** A "View on map" button on the route detail page stores the line's polyline in `sessionStorage` and navigates to `map.html`, where the route is drawn as a blue Leaflet polyline over the stop markers.

### Files to modify

| File | Change |
|------|--------|
| `route.html` | Add polyline map button |
| `src/js/route.js` | Store polyline + reveal button |
| `src/js/map.js` | Read sessionStorage + draw polyline |
| `src/js/i18n.js` | New key |
| `src/style.css` | None (reuses `.show-on-map-btn`) |

### New HTML — `route.html`

Add after `#timetable-btn` (Feature 21) or after `#direction-tabs` if Feature 21 is not yet built:

```html
<a id="polyline-map-btn" class="show-on-map-btn hidden" href="#">View on map</a>
```

### New JS logic — `src/js/route.js`

```js
// New element reference
const polylineMapBtn = document.getElementById('polyline-map-btn');

function initPolylineButton() {
  const poly = lineaData?.polilinea;
  if (!poly || !poly.length) return;

  sessionStorage.setItem('routePolyline',     JSON.stringify(poly));
  sessionStorage.setItem('routePolylineCode', LINEA_CODE);

  const from = encodeURIComponent(location.href);
  polylineMapBtn.href = `map.html?c=${CONSORCIO_ID}&polyline=1&from=${from}`;
  polylineMapBtn.textContent = t('viewOnMap');
  polylineMapBtn.classList.remove('hidden');
}
// Call initPolylineButton() at the end of initPage()
// In applyLang(): if (!polylineMapBtn.classList.contains('hidden')) polylineMapBtn.textContent = t('viewOnMap')
```

### New JS logic — `src/js/map.js`

```js
// New state
let polylineLayer = null;

// Read params at init (alongside existing focusConsorcioId / focusStopId)
const hasPolyline = mapParams.get('polyline') === '1';
const storedPoly  = hasPolyline ? tryParsePolyline() : null;

function tryParsePolyline() {
  try { return JSON.parse(sessionStorage.getItem('routePolyline') || 'null'); }
  catch { return null; }
}

function drawRoutePolyline(polyData) {
  if (!leafletMap || !polyData?.length) return;
  if (polylineLayer) { polylineLayer.remove(); polylineLayer = null; }

  const latLngs = polyData
    .map(p => [parseFloat(p.latitud), parseFloat(p.longitud)])
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
  if (!latLngs.length) return;

  polylineLayer = L.polyline(latLngs, {
    color: '#1a6fdb', weight: 4, opacity: 0.85,
    lineJoin: 'round', lineCap: 'round',
  }).addTo(leafletMap);

  leafletMap.fitBounds(polylineLayer.getBounds(), { padding: [40, 40] });
}

// In the init block, when hasPolyline is true:
// After showMap() resolves, call drawRoutePolyline(storedPoly)
// The polyline is added BEFORE markers so stop dots render on top.
// Modify the existing focusConsorcioId init branch to handle the polyline case:

if (focusConsorcioId) {
  initMap();
  fetchJSON(`${API}/consorcios`)
    .then(data => {
      const c = data.consorcios.find(x => String(x.idConsorcio) === String(focusConsorcioId));
      const mapPromise = c ? showMap(c, focusStopId) : (loadRegionOverlay(), Promise.resolve());
      mapPromise.then(() => {
        if (storedPoly) drawRoutePolyline(storedPoly);
      });
    })
    .catch(() => {
      loadRegionOverlay();
      if (storedPoly) drawRoutePolyline(storedPoly);
    });
}
```

Also make `showMap()` return the promise (currently it is `async` so it already returns a Promise; just ensure callers `await` or `.then()` it).

### New i18n keys

```js
// en
viewOnMap: 'View on map',

// es
viewOnMap: 'Ver en el mapa',
```

### New sessionStorage keys

| Key | Value |
|-----|-------|
| `routePolyline` | JSON string — `[{latitud, longitud}, …]` |
| `routePolylineCode` | String — line code, e.g. `"M-251"` |

`sessionStorage` is used so data is cleared when the tab closes.

### API endpoints

None new — `polilinea` is already in the `GET /{c}/lineas/{l}` response.

### Dependencies

None.

---

## Feature 25: User Location Dot

**Rank:** 25 · **Complexity:** Low

**Description:** Replaces the invisible one-time geolocation pan on the map with a persistent pulsing blue dot that tracks the user's position. If location permission is denied, a small auto-dismissing toast appears.

### Files to modify

| File | Change |
|------|--------|
| `map.html` | Add toast element |
| `src/js/map.js` | Replace `getCurrentPosition` with `watchPosition` + dot marker |
| `src/style.css` | Location dot + toast styles |

### New HTML — `map.html`

Add inside `#map-container`, after `#map-loading`:

```html
<div id="location-toast" class="location-toast hidden" role="status" aria-live="polite">
  <span id="location-toast-text">Location unavailable</span>
</div>
```

### New CSS classes

```css
/* Pulsing user location dot */
.map-user-dot {
  width: 16px; height: 16px;
  background: #2563eb;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  animation: location-pulse 2s ease-out infinite;
}
@keyframes location-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.45), 0 2px 6px rgba(0,0,0,0.3); }
  70%  { box-shadow: 0 0 0 10px rgba(37,99,235,0), 0 2px 6px rgba(0,0,0,0.3); }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0), 0 2px 6px rgba(0,0,0,0.3); }
}

/* Location denied toast */
.location-toast {
  position: absolute;
  bottom: 64px; left: 50%;
  transform: translateX(-50%);
  z-index: 600;
  background: rgba(26,29,35,0.88);
  color: #fff;
  font-size: 0.82rem;
  padding: 8px 18px;
  border-radius: 20px;
  white-space: nowrap;
  pointer-events: none;
  transition: opacity 0.4s;
}
.location-toast.hidden  { display: none !important; }
.location-toast.fading  { opacity: 0; }
```

### New JS logic — `src/js/map.js`

```js
// New state
let userLocationMarker = null;
let locationWatchId    = null;

// Replace the existing geolocation block inside initMap():
// REMOVE:
//   if (navigator.geolocation) {
//     navigator.geolocation.getCurrentPosition(pos => {
//       leafletMap.setView([pos.coords.latitude, pos.coords.longitude], 13);
//     });
//   }
// ADD:

function startLocationWatch() {
  if (!navigator.geolocation) return;

  // Create a higher-z-index pane for the user dot
  if (!leafletMap.getPane('userPane')) {
    leafletMap.createPane('userPane');
    leafletMap.getPane('userPane').style.zIndex = 650;
  }

  locationWatchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      if (!userLocationMarker) {
        const icon = L.divIcon({
          className: '',
          html: '<div class="map-user-dot"></div>',
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        userLocationMarker = L.marker([lat, lng], {
          icon, pane: 'userPane', interactive: false,
        }).addTo(leafletMap);
        leafletMap.setView([lat, lng], 13); // pan on first fix only
      } else {
        userLocationMarker.setLatLng([lat, lng]);
      }
    },
    err => {
      if (err.code === err.PERMISSION_DENIED) showLocationToast(ms('locationUnavailable'));
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function showLocationToast(msg) {
  const toast = document.getElementById('location-toast');
  document.getElementById('location-toast-text').textContent = msg;
  toast.classList.remove('hidden', 'fading');
  setTimeout(() => {
    toast.classList.add('fading');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 4000);
}

// Call startLocationWatch() at the end of initMap()

// Optional: pause watch when tab is hidden, resume on show
document.addEventListener('visibilitychange', () => {
  if (!leafletMap) return;
  if (document.hidden && locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  } else if (!document.hidden && locationWatchId === null) {
    startLocationWatch();
  }
});
```

Add to the `MAP_STRINGS` object inside `map.js`:

```js
// en
locationUnavailable: 'Location unavailable',
// es
locationUnavailable: 'Ubicación no disponible',
```

### New i18n keys

Added to `MAP_STRINGS` in `map.js` (not `i18n.js` — `map.js` uses its own local strings object).

### New cookies

None.

### API endpoints

None.

### Dependencies

None.

---

## Feature 26: Stop ETA on Route Detail

**Rank:** 26 · **Complexity:** High

**Description:** Each stop in the route stop list shows a small grey scheduled-time label to the right of its name. Times are derived from the line's timetable for the specific service the user arrived from (passed as the `servicio` URL parameter).

### Files to modify

| File | Change |
|------|--------|
| `src/js/station.js` | Append `&servicio=` to route URL in `makeDepartureCard()` |
| `src/js/route.js` | Read `servicio` param + fetch timetable + build ETA map + re-render |
| `src/style.css` | ETA label styles |

### Required change — `src/js/station.js`

In `makeDepartureCard()`, update the `window.location.href` assignment:

```js
// Add &servicio= to the existing URL:
window.location.href =
  `route.html?c=${CONSORCIO_ID}&l=${s.idLinea}&s=${STOP_ID}` +
  `&code=${encodeURIComponent(s.linea)}` +
  `&dest=${encodeURIComponent(s.destino || '')}` +
  `&sentido=${encodeURIComponent(s.sentido || '1')}` +
  `&servicio=${encodeURIComponent(s.servicio)}` +   // ← NEW
  `&from=${backUrl}`;
```

### New URL parameter — `src/js/route.js`

```js
const SERVICE_TIME = params.get('servicio') || null; // e.g. "14:30"
```

### New CSS classes

```css
.stop-eta-col {
  display: flex; flex-direction: column;
  align-items: flex-end; flex-shrink: 0; gap: 2px;
}
.stop-eta {
  font-size: 0.75rem; color: var(--text-muted);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
```

### New JS logic — `src/js/route.js`

```js
// Module-level state
let stopETAs = {};  // idParada → time string

async function loadStopETAs() {
  if (!SERVICE_TIME) return;

  try {
    // Step 1: get available frequencies
    const freqData    = await fetchJSON(`${API}/${CONSORCIO_ID}/frecuencias`);
    const frecuencias = freqData.frecuencias || [];

    // Step 2: pick today's frequency
    const dow       = new Date().getDay();
    const isWeekday = dow >= 1 && dow <= 5;
    const isSat     = dow === 6;
    const todayFreq = frecuencias.find(f => {
      const name = (f.nombre || '').toLowerCase();
      if (isWeekday && (name.includes('lunes') || name.includes('monday'))) return true;
      if (isSat     && (name.includes('sábado') || name.includes('saturday'))) return true;
      if (!isWeekday && !isSat && (name.includes('domingo') || name.includes('sunday'))) return true;
      return false;
    }) || frecuencias[0];

    if (!todayFreq) return;

    // Step 3: fetch timetable
    const today = new Date();
    const dia   = String(today.getDate()).padStart(2, '0');
    const mes   = String(today.getMonth() + 1).padStart(2, '0');
    const ttData = await fetchJSON(
      `${API}/${CONSORCIO_ID}/horarios_lineas` +
      `?idLinea=${LINEA_ID}&idFrecuencia=${todayFreq.idFrecuencia}&dia=${dia}&mes=${mes}`
    );

    buildETAMap(ttData);
    if (Object.keys(stopETAs).length > 0) {
      renderStops(currentStops, activeDirection); // re-render with ETAs filled in
    }
  } catch { /* non-critical */ }
}

function buildETAMap(ttData) {
  const horario = (ttData.horario || []).filter(row =>
    !row.sentido || String(row.sentido) === String(activeDirection)
  );
  const nucleos = ttData.nucleos || [];

  // Find the trip column whose times include SERVICE_TIME
  const matchedTrip = horario.find(row => row.horas?.includes(SERVICE_TIME));
  if (!matchedTrip) return;

  // Build nucleus-name → time map
  const nucleoTimeMap = {};
  nucleos.forEach((n, i) => {
    const time = matchedTrip.horas[i];
    if (time && time !== '--') nucleoTimeMap[n.nombre || n] = time;
  });

  // Map idParada → ETA using stop.nucleo as the key
  (currentStops || []).forEach(stop => {
    const time = nucleoTimeMap[stop.nucleo] || nucleoTimeMap[stop.nombre];
    if (time) stopETAs[stop.idParada] = time;
  });
}

// Call loadStopETAs() at end of loadStops(), after renderStops()
```

### Changes to `renderStops()` in `src/js/route.js`

Replace the card's trailing arrow with a combined ETA + arrow column:

```js
// In the card innerHTML template, replace:
//   <span class="card-arrow">›</span>
// with:
`<div class="stop-eta-col">
  ${stopETAs[stop.idParada] ? `<span class="stop-eta">${escHtml(stopETAs[stop.idParada])}</span>` : ''}
  ${isCurrent ? '<span class="you-are-here">●</span>' : '<span class="card-arrow">›</span>'}
</div>`
```

### New i18n keys

None — ETA times are numeric strings, no translation needed.

### New cookies

None.

### API endpoints

- `GET /{c}/frecuencias` — to identify today's frequency type
- `GET /{c}/horarios_lineas?idLinea=&idFrecuencia=&dia=&mes=` — to find the matching trip column

Both are also used by Feature 21; if Feature 21 is implemented first, the fetch + parsing pattern can be directly reused.

### Dependencies

- **Feature 21** (strongly recommended first) — shares identical API endpoints and data-parsing logic; implementing 21 first de-risks the `horarios_lineas` response shape.

---

## Shared Changes Summary

### `src/js/i18n.js` — all new keys

| Key | Feature |
|-----|---------|
| `saveStop`, `unsaveStop`, `savedStops`, `savedStopsEmpty` | Feature 1 |
| `pwaInstallMsg`, `pwaInstall`, `pwaDismiss` | Feature 6 |
| `serviceAlerts` | Feature 8 |
| `timetableTitle`, `fullTimetable`, `noTimetable`, `timetableStop` | Feature 21 |
| `viewOnMap` | Feature 23 |

Keys for Features 11 and 22 live in `planner.js`'s local `STRINGS` object (following the existing pattern). Keys for Feature 25 live in `MAP_STRINGS` in `map.js`.

### `route.html` — button order above stop list

Recommended DOM order top-to-bottom:

1. `#disruption-banner` — Feature 8 (needs highest visibility)
2. `#direction-tabs` — existing
3. `#timetable-btn` — Feature 21
4. `#polyline-map-btn` — Feature 23
5. `#route-hint` — existing
6. `#route-stops` — existing

### `src/js/station.js` — `makeDepartureCard()` URL change

Feature 26 requires `&servicio=` appended to the route URL. This is a one-line addition in `makeDepartureCard()`.

---

## Suggested Build Order

| # | Feature | Reason |
|---|---------|--------|
| 1 | **Feature 25 — Location Dot** | Smallest self-contained change; good warm-up |
| 2 | **Feature 6 — PWA Banner** | Gets manifest + SW in place early; all other pages need the manifest link added |
| 3 | **Feature 8 — Disruption Banner** | Self-contained `route.html` enhancement; zero risk |
| 4 | **Feature 1 — Saved Stops** | Highest user value; two-page but no new API |
| 5 | **Feature 11 — Date Picker** | Single-page, low risk; introduces `getSearchDate()` needed by Feature 22 |
| 6 | **Feature 22 — Direct Connections** | Builds on Feature 11; refactors planner parsing into shared helper |
| 7 | **Feature 23 — Route Polyline** | Cross-page sessionStorage handoff; simpler than Features 21/26 |
| 8 | **Feature 21 — Timetable Page** | New page + new API endpoints; higher complexity but de-risks Feature 26 |
| 9 | **Feature 26 — Stop ETA** | Most complex; reuses `horarios_lineas` patterns from Feature 21 |
