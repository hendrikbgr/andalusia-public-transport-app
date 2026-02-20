const API = 'https://api.ctan.es/v1/Consorcios';
const REFRESH_INTERVAL = 30; // seconds

// ---- Parse URL params ----
const params = new URLSearchParams(location.search);
const CONSORCIO_ID = params.get('c');
const STOP_ID = params.get('s');
const BACK_URL = params.get('from') || 'index.html';

if (!CONSORCIO_ID || !STOP_ID) {
  location.href = 'index.html';
}

// ---- Elements ----
const backBtn = document.getElementById('back-btn');
backBtn.href = BACK_URL;

const stationName = document.getElementById('station-name');
const stationMeta = document.getElementById('station-meta');
const departuresBoard = document.getElementById('departures-board');
const noService = document.getElementById('no-service');
const noServiceText = document.getElementById('no-service-text');
const noServiceHint = document.getElementById('no-service-hint');
const scanningIndicator = document.getElementById('scanning-indicator');
const scanningText = document.getElementById('scanning-text');
const liveClock = document.getElementById('live-clock');
const liveLabel = document.getElementById('live-label');
const countdownEl = document.getElementById('countdown');
const qrToggle = document.getElementById('qr-toggle');
const qrOverlay = document.getElementById('qr-overlay');
const qrClose = document.getElementById('qr-close');
const qrCodeEl = document.getElementById('qr-code');
const qrUrlEl = document.getElementById('qr-url');
const qrLabelEl = document.getElementById('qr-label');
const qrCloseBtn = document.getElementById('qr-close-btn');
const langToggle = document.getElementById('lang-toggle');
const showOnMapBtn  = document.getElementById('show-on-map-btn');
const saveStopBtn   = document.getElementById('save-stop-btn');
const saveStopLabel = document.getElementById('save-stop-label');

// ---- Language ----
function applyLang() {
  const lang = getLang();
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = lang;
  liveLabel.textContent = t('liveLabel');
  noServiceText.textContent = t('noService');
  noServiceHint.textContent = t('checkBack');
  if (scanningText) scanningText.textContent = t('scanningServices');
  if (qrLabelEl) qrLabelEl.textContent = t('scanQR');
  if (qrClose) qrClose.textContent = t('close');
  if (!showOnMapBtn.classList.contains('hidden')) showOnMapBtn.textContent = t('showOnMap');
  if (!saveStopBtn.classList.contains('hidden')) renderSaveButton();
  updateCountdown();
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
  // Tick minute labels so "Now / X min" strings update to the new language
  tickMinuteLabels();
});

// ---- State ----
let stopInfo = null;
let countdownTimer = null;
let secondsLeft = REFRESH_INTERVAL;
let qrGenerated = false;
let lastServices = null;
let lastNow = null;

// ---- Init ----
applyLang();
initPage();

async function initPage() {
  startClock();
  await loadStopInfo();
  await loadDepartures();
  scheduleRefresh();
}

// ---- Stop info ----
async function loadStopInfo() {
  try {
    const data = await fetchJSON(`${API}/${CONSORCIO_ID}/paradas/${STOP_ID}`);
    stopInfo = data;
    stationName.textContent = data.nombre || `Stop ${STOP_ID}`;
    const parts = [data.nucleo, data.municipio].filter(Boolean);
    const zonePart = data.idZona ? `  ·  ${t('zone', data.idZona)}` : '';
    stationMeta.textContent = parts.join(' · ') + zonePart;
    document.title = `${data.nombre} — Live Departures`;

    // Show "Show on map" button if this stop has GPS coordinates
    const lat = parseFloat(data.latitud);
    const lng = parseFloat(data.longitud);
    if (lat && lng) {
      const from = encodeURIComponent(location.href);
      showOnMapBtn.href = `map.html?c=${CONSORCIO_ID}&s=${STOP_ID}&from=${from}`;
      showOnMapBtn.textContent = t('showOnMap');
      showOnMapBtn.classList.remove('hidden');
    }

    // Show save button once stop info is available
    renderSaveButton();
  } catch {
    stationName.textContent = `Stop ${STOP_ID}`;
  }
}

// ---- Departures ----

// Token to cancel any in-progress background sweep when a new load starts
let sweepToken = null;

async function loadDepartures(silent = false) {
  // Silent refresh: keep existing cards visible, fetch new data in the background,
  // then diff-patch the board so nothing flickers for the user.
  if (silent) {
    sweepToken = {};
    const now = new Date();
    const token = sweepToken;
    try {
      const { services: initial, cursor } = await fetchFirstWindow(now, true, token);
      if (token !== sweepToken) return;
      if (initial.length) {
        lastServices = initial;
        lastNow = now;
        patchDepartures(initial, now);   // ← diff-patch instead of full re-render
        sweepRestOfDay(initial, cursor, now, token);
      } else {
        // Genuinely no more services today — tick minutes one last time then show no-service
        tickMinuteLabels();
      }
    } catch { /* silent — ignore errors on background refresh */ }
    return;
  }

  // Cancel any previous background sweep
  sweepToken = {};
  const token = sweepToken;

  const now = new Date();

  departuresBoard.innerHTML = '<div class="loading-spinner"></div>';
  noService.classList.add('hidden');
  scanningIndicator.classList.add('hidden');

  try {
    // Phase 1: find the first window that has services (fast path)
    const { services: initial, cursor: nextCursor } = await fetchFirstWindow(now, false, token);

    if (token !== sweepToken) return; // superseded

    if (!initial.length) {
      departuresBoard.innerHTML = '';
      noService.classList.remove('hidden');
      lastServices = [];
      lastNow = now;
      return;
    }

    // Render initial batch immediately
    lastServices = initial;
    lastNow = now;
    renderDepartures(initial, now);

    // Phase 2: sweep the rest of the day in the background, appending as we go
    sweepRestOfDay(initial, nextCursor, now, token);

  } catch (e) {
    departuresBoard.innerHTML = `<p class="hint">${t('noServiceLoad')}</p>`;
  }
}

// Walk every visible card and update only its minute label — no fetch, no flicker.
function tickMinuteLabels() {
  const now = new Date();
  const cards = departuresBoard.querySelectorAll('.departure-card[data-key]');
  cards.forEach(card => {
    const scheduled = parseServiceTime(card.dataset.servicio, now);
    const mins = Math.round((scheduled - now) / 60000);
    const minsEl = card.querySelector('.departure-mins');
    if (!minsEl) return;
    minsEl.textContent = formatMins(mins);
    minsEl.className = `departure-mins ${mins <= 2 ? 'mins-now' : mins <= 10 ? 'mins-soon' : 'mins-later'}`;
  });
}

// Diff the new services against the current DOM cards and apply minimal changes.
// Cards that are identical (same key = idLinea|servicio) stay in place.
// New cards are inserted; cards no longer in the new list are removed.
function patchDepartures(services, now) {
  const enriched = services
    .map(s => ({ ...s, _scheduled: parseServiceTime(s.servicio, now) }))
    .filter(s => Math.round((s._scheduled - now) / 60000) >= -1)
    .sort((a, b) => a._scheduled - b._scheduled);

  if (!enriched.length) {
    departuresBoard.innerHTML = '';
    noService.classList.remove('hidden');
    return;
  }
  noService.classList.add('hidden');

  // Index existing cards by key
  const existingCards = {};
  departuresBoard.querySelectorAll('.departure-card[data-key]').forEach(el => {
    existingCards[el.dataset.key] = el;
  });

  // Remove sentinel if present (sweepRestOfDay adds it; we'll re-add when needed)
  const oldSentinel = document.getElementById('load-more-sentinel');
  if (oldSentinel) oldSentinel.remove();

  // Build the desired card order, reusing existing DOM nodes where possible
  const fragment = document.createDocumentFragment();
  const newKeys = new Set();

  enriched.forEach(s => {
    const key = `${s.idLinea}|${s.servicio}`;
    newKeys.add(key);
    if (existingCards[key]) {
      // Card already exists — just tick its minute label
      const card = existingCards[key];
      const mins = Math.round((s._scheduled - now) / 60000);
      const minsEl = card.querySelector('.departure-mins');
      if (minsEl) {
        minsEl.textContent = formatMins(mins);
        minsEl.className = `departure-mins ${mins <= 2 ? 'mins-now' : mins <= 10 ? 'mins-soon' : 'mins-later'}`;
      }
      fragment.appendChild(card);
    } else {
      // New card — create it
      fragment.appendChild(makeDepartureCard(s, now));
    }
  });

  // Remove cards that are no longer in the new list
  Object.entries(existingCards).forEach(([key, el]) => {
    if (!newKeys.has(key)) el.remove();
  });

  departuresBoard.appendChild(fragment);
}

// Finds the first non-empty window starting from `now`.
// Returns { services, cursor } where cursor is positioned just after that window.
async function fetchFirstWindow(now, silent, token) {
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 0, 0);

  let cursor = new Date(now);
  let shownScanning = false;

  while (cursor <= endOfDay) {
    if (token !== sweepToken) return { services: [], cursor };

    const data = await fetchJSON(
      `${API}/${CONSORCIO_ID}/paradas/${STOP_ID}/servicios?horaIni=${formatDateForAPI(cursor)}`
    );

    if (data.servicios && data.servicios.length > 0) {
      if (!silent) {
        scanningIndicator.classList.add('hidden');
        departuresBoard.innerHTML = '';
      }
      const next = advanceCursor(cursor, data.horaFin);
      return { services: data.servicios, cursor: next };
    }

    // Show scanning indicator after first empty window
    if (!shownScanning && !silent) {
      shownScanning = true;
      departuresBoard.innerHTML = '';
      scanningText.textContent = t('scanningServices');
      scanningIndicator.classList.remove('hidden');
    }

    cursor = advanceCursor(cursor, data.horaFin);
  }

  if (!silent) scanningIndicator.classList.add('hidden');
  return { services: [], cursor };
}

// Continues sweeping from `cursor` to end of day, appending new cards live.
async function sweepRestOfDay(collected, cursor, now, token) {
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 0, 0);

  // Add a "loading more" sentinel at the bottom of the board
  const sentinel = document.createElement('div');
  sentinel.id = 'load-more-sentinel';
  sentinel.className = 'load-more-sentinel';
  sentinel.innerHTML = '<div class="load-more-spinner"></div>';
  departuresBoard.appendChild(sentinel);

  const seen = new Set(collected.map(s => `${s.idLinea}|${s.servicio}`));

  while (cursor <= endOfDay) {
    if (token !== sweepToken) return;

    const data = await fetchJSON(
      `${API}/${CONSORCIO_ID}/paradas/${STOP_ID}/servicios?horaIni=${formatDateForAPI(cursor)}`
    );

    if (token !== sweepToken) return;

    if (data.servicios && data.servicios.length > 0) {
      const newOnes = data.servicios.filter(s => {
        const key = `${s.idLinea}|${s.servicio}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (newOnes.length) {
        collected.push(...newOnes);
        lastServices = collected;
        // Append new cards before the sentinel
        newOnes
          .map(s => makeDepartureCard(s, now))
          .sort((a, b) => a._mins - b._mins)
          .forEach(card => departuresBoard.insertBefore(card, sentinel));
      }
    }

    cursor = advanceCursor(cursor, data.horaFin);
  }

  // Done — remove sentinel
  sentinel.remove();
}

function advanceCursor(cursor, horaFin) {
  if (horaFin) {
    const [datePart, timePart] = horaFin.split(' ');
    const [y, mo, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    return new Date(new Date(y, mo - 1, d, hh, mm, 0, 0).getTime() + 60000);
  }
  return new Date(cursor.getTime() + 15 * 60000);
}

function makeDepartureCard(s, now) {
  const scheduled = parseServiceTime(s.servicio, now);
  const mins = Math.round((scheduled - now) / 60000);

  const card = document.createElement('div');
  card.className = 'departure-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.dataset.key = `${s.idLinea}|${s.servicio}`;   // for diff-patching
  card.dataset.servicio = s.servicio;                  // for tickMinuteLabels
  card._mins = mins; // used for insertion sort in sweepRestOfDay

  const minsLabel = formatMins(mins);
  const minsClass = mins <= 2 ? 'mins-now' : mins <= 10 ? 'mins-soon' : 'mins-later';
  const routeName = s.nombre.length > 40 ? s.nombre.slice(0, 38) + '…' : s.nombre;

  card.innerHTML = `
    <div class="departure-line">${escHtml(s.linea)}</div>
    <div class="departure-body">
      <div class="departure-dest">${escHtml(s.destino || '—')}</div>
      <div class="departure-name">${escHtml(routeName)}</div>
    </div>
    <div class="departure-time-col">
      <span class="departure-sched">${escHtml(s.servicio)}</span>
      <span class="departure-mins ${minsClass}">${minsLabel}</span>
    </div>
    <span class="departure-info-arrow">›</span>
  `;

  card.addEventListener('click', () => {
    const backUrl = encodeURIComponent(location.href);
    window.location.href =
      `route.html?c=${CONSORCIO_ID}&l=${s.idLinea}&s=${STOP_ID}` +
      `&code=${encodeURIComponent(s.linea)}` +
      `&dest=${encodeURIComponent(s.destino || '')}` +
      `&sentido=${encodeURIComponent(s.sentido || '1')}` +
      `&from=${backUrl}`;
  });

  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') card.click();
  });

  return card;
}

function renderDepartures(services, now) {
  if (!services.length) {
    departuresBoard.innerHTML = '';
    noService.classList.remove('hidden');
    return;
  }

  noService.classList.add('hidden');

  const enriched = services
    .map(s => ({ ...s, _scheduled: parseServiceTime(s.servicio, now) }))
    .filter(s => Math.round((s._scheduled - now) / 60000) >= -1)
    .sort((a, b) => a._scheduled - b._scheduled);

  if (!enriched.length) {
    departuresBoard.innerHTML = '';
    noService.classList.remove('hidden');
    return;
  }

  departuresBoard.innerHTML = '';
  enriched.forEach(s => departuresBoard.appendChild(makeDepartureCard(s, now)));
}

function formatMins(mins) {
  if (mins <= 0) return t('now');
  if (mins < 60) return t('min', mins);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}

// ---- Clock ----
function startClock() {
  updateClock();
  setInterval(() => {
    updateClock();
    tickMinuteLabels(); // keep "X min" labels accurate every second, no fetch needed
  }, 1000);
}

function updateClock() {
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---- Auto-refresh ----
function scheduleRefresh() {
  secondsLeft = REFRESH_INTERVAL;
  updateCountdown();

  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    secondsLeft--;
    updateCountdown();
    if (secondsLeft <= 0) {
      clearInterval(countdownTimer);
      loadDepartures(true).then(scheduleRefresh);
    }
  }, 1000);
}

function updateCountdown() {
  countdownEl.textContent = t('refreshIn', secondsLeft);
}

// ---- QR Code ----
qrToggle.addEventListener('click', () => {
  qrOverlay.classList.remove('hidden');
  if (!qrGenerated) {
    generateQR();
    qrGenerated = true;
  }
});

qrClose.addEventListener('click', () => {
  qrOverlay.classList.add('hidden');
});

qrOverlay.addEventListener('click', e => {
  if (e.target === qrOverlay) qrOverlay.classList.add('hidden');
});

function generateQR() {
  const url = location.href;
  qrUrlEl.textContent = url;
  qrCodeEl.innerHTML = '';
  new QRCode(qrCodeEl, {
    text: url,
    width: 220,
    height: 220,
    colorDark: '#1a1d23',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

// ---- Saved Stops ----
function getSavedStops() {
  try { return JSON.parse(getCookie('savedStops') || '[]'); } catch { return []; }
}
function setSavedStops(arr) {
  setCookie('savedStops', JSON.stringify(arr.slice(0, 20)), 365);
}
function isStopSaved() {
  return getSavedStops().some(
    s => String(s.idConsorcio) === String(CONSORCIO_ID) && String(s.idParada) === String(STOP_ID)
  );
}
function toggleSaveStop() {
  if (isStopSaved()) {
    setSavedStops(getSavedStops().filter(
      s => !(String(s.idConsorcio) === String(CONSORCIO_ID) && String(s.idParada) === String(STOP_ID))
    ));
  } else {
    const arr = getSavedStops().filter(
      s => !(String(s.idConsorcio) === String(CONSORCIO_ID) && String(s.idParada) === String(STOP_ID))
    );
    arr.unshift({
      idConsorcio: CONSORCIO_ID,
      idParada: STOP_ID,
      nombre: stopInfo?.nombre || `Stop ${STOP_ID}`,
      nucleo: stopInfo?.nucleo || '',
      municipio: stopInfo?.municipio || '',
    });
    setSavedStops(arr);
  }
  renderSaveButton();
}
function renderSaveButton() {
  const saved = isStopSaved();
  saveStopBtn.classList.remove('hidden');
  saveStopBtn.classList.toggle('saved', saved);
  saveStopBtn.firstChild.textContent = saved ? '★ ' : '☆ ';
  saveStopLabel.textContent = t(saved ? 'unsaveStop' : 'saveStop');
}
saveStopBtn.addEventListener('click', toggleSaveStop);

// ---- Helpers ----
function formatDateForAPI(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}+${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseServiceTime(timeStr, refDate) {
  const [hh, mm] = timeStr.split(':').map(Number);
  const t = new Date(refDate);
  t.setHours(hh, mm, 0, 0);
  if (t < refDate - 3600000) t.setDate(t.getDate() + 1);
  return t;
}

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
