const API = 'https://api.ctan.es/v1/Consorcios';

// ---- Parse URL params ----
// c = consorcioId, l = lineaId, s = current stopId (to highlight), from = 'station.html?...' (back link)
const params = new URLSearchParams(location.search);
const CONSORCIO_ID = params.get('c');
const LINEA_ID = params.get('l');
const CURRENT_STOP_ID = params.get('s');
const BACK_URL = params.get('from') || 'stops.html';
const LINEA_CODE = params.get('code') || '';
const LINEA_DEST = params.get('dest') || '';
const SENTIDO = params.get('sentido') || '1'; // preferred direction

if (!CONSORCIO_ID || !LINEA_ID) {
  location.href = 'stops.html';
}

// ---- Elements ----
const routeTitle = document.getElementById('route-title');
const routeMeta = document.getElementById('route-meta');
const routeStopsEl = document.getElementById('route-stops');
const directionTabs = document.getElementById('direction-tabs');
const routeHint = document.getElementById('route-hint');
const backBtn = document.getElementById('back-btn');
const langToggle = document.getElementById('lang-toggle');
const disruptionBanner = document.getElementById('disruption-banner');
const disruptionBannerTitle = document.getElementById('disruption-banner-title');
const disruptionAlertsList = document.getElementById('disruption-alerts-list');
const timetableBtn   = document.getElementById('timetable-btn');
const polylineMapBtn = document.getElementById('polyline-map-btn');

// ---- Language ----
function applyLang() {
  const lang = getLang();
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = lang;
  routeHint.textContent = t('tapStop');
  // Re-render disruption banner in new language if data already loaded
  if (alertsData) renderDisruptionBanner(alertsData);
  if (!timetableBtn.classList.contains('hidden'))   timetableBtn.textContent   = t('fullTimetable');
  if (!polylineMapBtn.classList.contains('hidden')) polylineMapBtn.textContent = t('viewOnMap');
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
  // Rebuild tabs so "Outbound / Inbound" labels update
  if (window._dir2 && window._dir2.length) buildTabs(true);
  renderStops(currentStops, activeDirection);
});

// Back navigates to the station page we came from (or index as fallback)
backBtn.href = BACK_URL || `station.html?c=${CONSORCIO_ID}&s=${CURRENT_STOP_ID}`;

// ---- State ----
let lineaData = null;
let currentStops = [];
let activeDirection = parseInt(SENTIDO, 10) || 1;
let alertsData = null;

// ---- Init ----
applyTheme();
applyLang();
initPage();

async function initPage() {
  try {
    const data = await fetchJSON(`${API}/${CONSORCIO_ID}/lineas/${LINEA_ID}`);
    lineaData = data;

    routeTitle.textContent = LINEA_CODE || data.codigo || `Line ${LINEA_ID}`;
    routeMeta.textContent = data.nombre || '';
    document.title = `${data.codigo || LINEA_CODE} — ${t('routeStops')}`;

    await loadStops();
    await loadDisruptions();
    initTimetableButton();
    initPolylineButton();
  } catch (e) {
    routeStopsEl.innerHTML = `<p class="hint">${t('noRouteStops')}</p>`;
  }
}

// ---- Disruption banner ----
async function loadDisruptions() {
  if (!lineaData?.hayNoticias) return;
  try {
    const data = await fetchJSON(`${API}/${CONSORCIO_ID}/lineas/${LINEA_ID}/noticias`);
    alertsData = data.noticias || [];
    if (alertsData.length) renderDisruptionBanner(alertsData);
  } catch { /* non-critical — fail silently */ }
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

async function loadStops() {
  routeStopsEl.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await fetchJSON(`${API}/${CONSORCIO_ID}/lineas/${LINEA_ID}/paradas`);
    const paradas = data.paradas || [];

    // The API returns all stops; sentido field indicates direction
    // sentido 1 = outbound (ida), sentido 2 = inbound (vuelta)
    const dir1 = paradas.filter(p => String(p.sentido) === '1');
    const dir2 = paradas.filter(p => String(p.sentido) === '2');

    const hasDir2 = dir2.length > 0;

    // Build direction tabs
    buildTabs(hasDir2, dir1, dir2);

    currentStops = activeDirection === 2 && hasDir2 ? dir2 : dir1;
    renderStops(currentStops, activeDirection);

    // Store both for tab switching
    window._dir1 = dir1;
    window._dir2 = dir2;
  } catch (e) {
    routeStopsEl.innerHTML = `<p class="hint">${t('noRouteStops')}</p>`;
  }
}

function buildTabs(hasDir2, dir1, dir2) {
  if (!hasDir2) {
    directionTabs.innerHTML = '';
    return;
  }

  // Use stored stop arrays if not passed (e.g. from lang toggle rebuild)
  const stops1 = dir1 || window._dir1 || [];
  const stops2 = dir2 || window._dir2 || [];

  function endpointLabel(stops) {
    if (!stops.length) return '';
    const first = stops[0].nombre;
    const last = stops[stops.length - 1].nombre;
    return `${first} → ${last}`;
  }

  const sub1 = endpointLabel(stops1);
  const sub2 = endpointLabel(stops2);

  directionTabs.innerHTML = `
    <button class="dir-tab ${activeDirection === 1 ? 'active' : ''}" data-dir="1">
      → ${t('outbound')}
      ${sub1 ? `<span class="dir-tab-sub">${escHtml(sub1)}</span>` : ''}
    </button>
    <button class="dir-tab ${activeDirection === 2 ? 'active' : ''}" data-dir="2">
      ← ${t('inbound')}
      ${sub2 ? `<span class="dir-tab-sub">${escHtml(sub2)}</span>` : ''}
    </button>
  `;

  directionTabs.querySelectorAll('.dir-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDirection = parseInt(btn.dataset.dir, 10);
      directionTabs.querySelectorAll('.dir-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStops = activeDirection === 2 ? window._dir2 : window._dir1;
      renderStops(currentStops, activeDirection);
    });
  });
}

function renderStops(stops, direction) {
  if (!stops.length) {
    routeStopsEl.innerHTML = `<p class="hint">${t('noRouteStops')}</p>`;
    return;
  }

  routeStopsEl.innerHTML = '';
  stops.forEach((stop, idx) => {
    const isCurrent = String(stop.idParada) === String(CURRENT_STOP_ID);
    const el = document.createElement('div');
    el.className = `card route-stop-card${isCurrent ? ' route-stop-current' : ''}`;

    el.innerHTML = `
      <div class="route-stop-index">${idx + 1}</div>
      <div class="card-body">
        <div class="card-title">${escHtml(stop.nombre)}</div>
        ${stop.modos ? `<div class="card-sub">${escHtml(stop.modos)}</div>` : ''}
      </div>
      ${isCurrent ? '<span class="you-are-here">●</span>' : '<span class="card-arrow">›</span>'}
    `;

    if (!isCurrent) {
      el.addEventListener('click', () => {
        const from = encodeURIComponent(location.href);
        window.location.href = `station.html?c=${CONSORCIO_ID}&s=${stop.idParada}&from=${from}`;
      });
    }

    routeStopsEl.appendChild(el);
  });
}

// ---- Full timetable button ----
function initTimetableButton() {
  const from = encodeURIComponent(location.href);
  timetableBtn.href =
    `timetable.html?c=${CONSORCIO_ID}&l=${LINEA_ID}` +
    `&code=${encodeURIComponent(LINEA_CODE)}&from=${from}`;
  timetableBtn.textContent = t('fullTimetable');
  timetableBtn.classList.remove('hidden');
}

// ---- Route polyline button ----
function initPolylineButton() {
  const poly = lineaData?.polilinea;
  if (!poly || !poly.length) return;

  sessionStorage.setItem('routePolyline',     JSON.stringify(poly));
  sessionStorage.setItem('routePolylineCode', LINEA_CODE);
  sessionStorage.setItem('routeLineaId',      LINEA_ID);

  const from = encodeURIComponent(location.href);
  polylineMapBtn.href = `map.html?c=${CONSORCIO_ID}&polyline=1&from=${from}`;
  polylineMapBtn.textContent = t('viewOnMap');
  polylineMapBtn.classList.remove('hidden');
}

// ---- Helpers ----
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
