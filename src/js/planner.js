const API = 'https://api.ctan.es/v1/Consorcios';

const CONSORTIUM_ICONS = {
  '1': '🌻', '2': '⚓', '3': '🏛️', '4': '☀️',
  '5': '🪨', '6': '🎸', '7': '🫒', '8': '🕌', '9': '🌊',
};

const STRINGS = {
  en: {
    plannerTitle: 'Route Planner',
    labelRegion: 'Select region',
    labelFrom: 'From',
    labelTo: 'To',
    searchBtn: 'Search',
    searching: 'Searching…',
    resultsLabel: mode => mode === 'today' ? 'Next departures' : mode === 'tomorrow' ? 'Departures tomorrow' : 'Departures on this date',
    noRoutes: 'No direct routes found',
    noRoutesHint: 'Try a different origin or destination',
    noConn: 'Could not load data. Check your connection.',
    backRegion: '← Back',
    backForm: '← Change route',
    placeholder: 'Type a town or stop…',
    days: d => d,
    todayLabel: 'Today',
    schedLabel: s => `Departs ${s}`,
    minsLabel: m => m <= 0 ? 'Now' : m === 1 ? 'in 1 min' : `in ${m} min`,
    passesThrough: 'via',
    dateToday: 'Today',
    dateTomorrow: 'Tomorrow',
    datePick: 'Pick date',
    directConnections: mode => mode === 'today' ? 'All departures today:' : mode === 'tomorrow' ? 'All departures tomorrow:' : 'All departures on this date:',
  },
  es: {
    plannerTitle: 'Planificador de Ruta',
    labelRegion: 'Selecciona región',
    labelFrom: 'Desde',
    labelTo: 'Hasta',
    searchBtn: 'Buscar',
    searching: 'Buscando…',
    resultsLabel: mode => mode === 'today' ? 'Próximas salidas' : mode === 'tomorrow' ? 'Salidas mañana' : 'Salidas en esta fecha',
    noRoutes: 'No se encontraron rutas directas',
    noRoutesHint: 'Prueba con otro origen o destino',
    noConn: 'No se pudo cargar. Comprueba la conexión.',
    backRegion: '← Volver',
    backForm: '← Cambiar ruta',
    placeholder: 'Escribe una localidad o parada…',
    days: d => d,
    todayLabel: 'Hoy',
    schedLabel: s => `Sale ${s}`,
    minsLabel: m => m <= 0 ? 'Ahora' : m === 1 ? 'en 1 min' : `en ${m} min`,
    passesThrough: 'vía',
    dateToday: 'Hoy',
    dateTomorrow: 'Mañana',
    datePick: 'Elegir fecha',
    directConnections: mode => mode === 'today' ? 'Todas las salidas hoy:' : mode === 'tomorrow' ? 'Todas las salidas mañana:' : 'Todas las salidas en esta fecha:',
  },
};

function s(key, ...args) {
  const lang = getLang();
  const val = STRINGS[lang]?.[key] ?? STRINGS.en[key];
  return typeof val === 'function' ? val(...args) : val;
}

// ---- Elements ----
const langToggle = document.getElementById('lang-toggle');
const plannerTitle = document.getElementById('planner-title');
const stepRegion = document.getElementById('step-region');
const stepForm = document.getElementById('step-form');
const stepResults = document.getElementById('step-results');
const plannerRegionList = document.getElementById('planner-region-list');
const plannerRegionLabel = document.getElementById('planner-region-label');
const labelRegion = document.getElementById('label-region');
const backToRegion = document.getElementById('back-to-region');
const backToForm = document.getElementById('back-to-form');
const fromInput = document.getElementById('from-input');
const toInput = document.getElementById('to-input');
const fromResults = document.getElementById('from-results');
const toResults = document.getElementById('to-results');
const swapBtn = document.getElementById('swap-btn');
const searchBtn = document.getElementById('search-btn');
const searchBtnText = document.getElementById('search-btn-text');
const resultsList = document.getElementById('results-list');
const resultsLabel = document.getElementById('results-label');
const routeSummary = document.getElementById('route-summary');
const resultsNoService = document.getElementById('results-no-service');
const resultsNoServiceText = document.getElementById('results-no-service-text');
const resultsNoServiceHint = document.getElementById('results-no-service-hint');
const labelFrom = document.getElementById('label-from');
const labelTo = document.getElementById('label-to');
const dateBtnToday    = document.getElementById('date-btn-today');
const dateBtnTomorrow = document.getElementById('date-btn-tomorrow');
const dateBtnPick     = document.getElementById('date-btn-pick');
const datePickerInput = document.getElementById('date-picker-input');
const directSection      = document.getElementById('direct-section');
const directSectionLabel = document.getElementById('direct-section-label');
const directList         = document.getElementById('direct-list');

// ---- State ----
let currentConsorcio = null;
let allNucleos = [];
let selectedFrom = null;
let selectedTo = null;
let fromSearchTimeout = null;
let toSearchTimeout = null;
let lastResultsData = null;   // cached for lang re-render
let lastResultsNow = null;
let selectedDateMode = 'today';
let selectedPickedDate = null;

// ---- Date helpers ----
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
  const map = { today: dateBtnToday, tomorrow: dateBtnTomorrow, pick: dateBtnPick };
  map[mode].classList.add('active');
  datePickerInput.classList.toggle('hidden', mode !== 'pick');
}

// Set min date to today so past dates can't be picked
datePickerInput.min = new Date().toISOString().slice(0, 10);

dateBtnToday.addEventListener('click',    () => setDateMode('today'));
dateBtnTomorrow.addEventListener('click', () => setDateMode('tomorrow'));
dateBtnPick.addEventListener('click', () => {
  setDateMode('pick');
  try { datePickerInput.showPicker(); } catch { datePickerInput.focus(); }
});
datePickerInput.addEventListener('change', () => {
  if (datePickerInput.value) {
    const [y, m, d] = datePickerInput.value.split('-').map(Number);
    selectedPickedDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  }
});

// ---- Lang ----
function applyLang() {
  const lang = getLang();
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = lang;
  plannerTitle.textContent = s('plannerTitle');
  labelRegion.textContent = s('labelRegion');
  labelFrom.textContent = s('labelFrom');
  labelTo.textContent = s('labelTo');
  fromInput.placeholder = s('placeholder');
  toInput.placeholder = s('placeholder');
  searchBtnText.textContent = s('searchBtn');
  backToRegion.textContent = s('backRegion');
  backToForm.textContent = s('backForm');
  resultsLabel.textContent = s('resultsLabel', selectedDateMode);
  resultsNoServiceText.textContent = s('noRoutes');
  resultsNoServiceHint.textContent = s('noRoutesHint');
  dateBtnToday.textContent    = s('dateToday');
  dateBtnTomorrow.textContent = s('dateTomorrow');
  dateBtnPick.textContent     = s('datePick');
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
  if (!stepRegion.classList.contains('hidden')) {
    loadRegions();
  } else if (!stepResults.classList.contains('hidden') && lastResultsData) {
    // Re-render results so "via", "in X min" etc. switch language instantly
    routeSummary.textContent = `${selectedFrom.nombre}  →  ${selectedTo.nombre}`;
    renderResults(lastResultsData, lastResultsNow);
  }
});

// ---- Init ----
applyLang();

// If URL has restore params (c, fromN, toN), skip straight to results
const initParams = new URLSearchParams(location.search);
const initC = initParams.get('c');
const initFrom = initParams.get('fromN');
const initTo = initParams.get('toN');

if (initC && initFrom && initTo) {
  restoreSearch(initC, initFrom, initTo);
} else {
  loadRegions();
}

async function restoreSearch(cId, fromId, toId) {
  // Load consortiums to find the right one
  try {
    const cData = await fetchJSON(`${API}/consorcios`);
    const consorcio = cData.consorcios.find(c => String(c.idConsorcio) === String(cId));
    if (!consorcio) { loadRegions(); return; }
    currentConsorcio = consorcio;

    const nData = await fetchJSON(`${API}/${cId}/nucleos`);
    allNucleos = nData.nucleos || [];

    selectedFrom = allNucleos.find(n => String(n.idNucleo) === String(fromId));
    selectedTo   = allNucleos.find(n => String(n.idNucleo) === String(toId));
    if (!selectedFrom || !selectedTo) { loadRegions(); return; }

    fromInput.value = selectedFrom.nombre;
    toInput.value   = selectedTo.nombre;
    plannerRegionLabel.textContent = consorcio.nombre;
    updateSearchBtn();
    await runSearch();
  } catch {
    loadRegions();
  }
}

async function loadRegions() {
  plannerRegionList.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await fetchJSON(`${API}/consorcios`);
    plannerRegionList.innerHTML = '';
    data.consorcios.forEach(c => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-icon">${CONSORTIUM_ICONS[c.idConsorcio] || '🚌'}</div>
        <div class="card-body">
          <div class="card-title">${escHtml(c.nombre)}</div>
          <div class="card-sub">${escHtml(c.nombreCorto)}</div>
        </div>
        <span class="card-arrow">›</span>
      `;
      card.addEventListener('click', () => selectRegion(c));
      plannerRegionList.appendChild(card);
    });
  } catch {
    plannerRegionList.innerHTML = `<p class="hint">${s('noConn')}</p>`;
  }
}

async function selectRegion(c) {
  currentConsorcio = c;
  plannerRegionLabel.textContent = c.nombre;
  allNucleos = [];
  selectedFrom = null;
  selectedTo = null;
  fromInput.value = '';
  toInput.value = '';
  updateSearchBtn();

  showPlannerStep(stepForm);

  try {
    const data = await fetchJSON(`${API}/${c.idConsorcio}/nucleos`);
    allNucleos = data.nucleos || [];
  } catch {
    // non-fatal — search will just show nothing
  }
}

// ---- From/To search ----
function setupSearch(input, resultsEl, onSelect) {
  input.addEventListener('input', () => {
    clearTimeout(input._timeout);
    input._timeout = setTimeout(() => renderDropdown(input, resultsEl, onSelect), 180);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) renderDropdown(input, resultsEl, onSelect);
  });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !resultsEl.contains(e.target)) {
      hideDropdown(input, resultsEl);
    }
  });
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderDropdown(input, resultsEl, onSelect) {
  const q = normalize(input.value.trim());
  if (!q) { hideDropdown(input, resultsEl); return; }

  const matches = allNucleos
    .filter(n => normalize(n.nombre).includes(q))
    .slice(0, 10);

  if (!matches.length) { hideDropdown(input, resultsEl); return; }

  resultsEl.innerHTML = '';
  matches.forEach(n => {
    const item = document.createElement('div');
    item.className = 'planner-dropdown-item';
    item.textContent = n.nombre;
    item.addEventListener('mousedown', e => {
      e.preventDefault(); // prevent blur before click
      onSelect(n);
      input.value = n.nombre;
      hideDropdown(input, resultsEl);
    });
    resultsEl.appendChild(item);
  });
  resultsEl.classList.remove('hidden');
  input.classList.add('dropdown-open');
}

function hideDropdown(input, resultsEl) {
  resultsEl.classList.add('hidden');
  input.classList.remove('dropdown-open');
}

setupSearch(fromInput, fromResults, n => { selectedFrom = n; updateSearchBtn(); });
setupSearch(toInput, toResults, n => { selectedTo = n; updateSearchBtn(); });

// Clear selection when user edits the field manually
fromInput.addEventListener('input', () => { selectedFrom = null; updateSearchBtn(); });
toInput.addEventListener('input', () => { selectedTo = null; updateSearchBtn(); });

function updateSearchBtn() {
  searchBtn.disabled = !(selectedFrom && selectedTo && selectedFrom.idNucleo !== selectedTo.idNucleo);
}

// ---- Swap ----
swapBtn.addEventListener('click', () => {
  const tmpVal = fromInput.value;
  const tmpSel = selectedFrom;
  fromInput.value = toInput.value;
  selectedFrom = selectedTo;
  toInput.value = tmpVal;
  selectedTo = tmpSel;
  updateSearchBtn();
});

// ---- Search ----
searchBtn.addEventListener('click', runSearch);

async function runSearch() {
  if (!selectedFrom || !selectedTo) return;
  showPlannerStep(stepResults);
  resultsList.innerHTML = '<div class="loading-spinner"></div>';
  resultsNoService.classList.add('hidden');
  directSection.classList.add('hidden');
  routeSummary.textContent = `${selectedFrom.nombre}  →  ${selectedTo.nombre}`;
  resultsLabel.textContent = s('resultsLabel', selectedDateMode);

  try {
    const now = getSearchDate();
    const data = await fetchJSON(
      `${API}/${currentConsorcio.idConsorcio}/horarios_origen_destino` +
      `?idNucleoOrigen=${selectedFrom.idNucleo}&idNucleoDestino=${selectedTo.idNucleo}`
    );

    lastResultsData = data;
    lastResultsNow = now;
    renderResults(data, now);
    renderDirectConnections(data, now);
  } catch {
    resultsList.innerHTML = `<p class="hint">${s('noConn')}</p>`;
  }
}

function renderResults(data, now) {
  const horario = data.horario || [];
  const bloques = data.bloques || [];

  // bloques[1..n-2] are intermediate stop names (skip first "Líneas" and last "Frecuencia")
  const stopNames = bloques.slice(1, -1).map(b => b.nombre.trim());

  if (!horario.length) {
    resultsList.innerHTML = '';
    resultsNoService.classList.remove('hidden');
    return;
  }

  resultsNoService.classList.add('hidden');

  const dow = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const isWeekday = dow >= 1 && dow <= 5;
  const isSat = dow === 6;
  const isSun = dow === 0;
  const isWeekend = isSat || isSun;

  // Build a lookup: acronym → does it run today?
  // Use the frecuencias array the API returns to understand each code.
  const frecuencias = data.frecuencias || [];
  const freqRunsToday = {};
  frecuencias.forEach(f => {
    const acr = f.acronimo.trim();
    const name = (f.nombre || '').toLowerCase();
    let runs = false;
    if (name.includes('monday to friday') || name.includes('lunes a viernes')) runs = isWeekday;
    else if (name.includes('monday to saturday') || name.includes('lunes a sábado') || name.includes('lunes a sabado')) runs = isWeekday || isSat;
    else if (name.includes('saturday') && name.includes('sunday') || name.includes('sábado') && name.includes('domingo')) runs = isWeekend;
    else if (name.includes('saturday') || name.includes('sábado')) runs = isSat;
    else if (name.includes('sunday') || name.includes('domingo')) runs = isSun;
    else runs = true; // daily or unknown
    freqRunsToday[acr] = runs;
  });

  // Use the nucleos layout to find which horas[] indices belong to origin vs destination.
  // nucleos[0] is the "Líneas" column (colspan 1), then origin group, then destination group.
  // We skip the first column (line name) and map each nucleo to its column range.
  const nucleos = data.nucleos || [];
  let colOffset = 0; // nucleos[0] is a blank label row with no horas column — skip it
  let originIndices = [];
  let destIndices = [];
  // nucleos[0] = blank "Líneas" header (decorative, no horas slot)
  // nucleos[1] = origin town, nucleos[2] = dest town
  for (let i = 0; i < nucleos.length; i++) {
    const span = nucleos[i].colspan || 1;
    if (i === 0) continue; // skip blank header — it has no corresponding horas column
    const indices = Array.from({ length: span }, (_, k) => colOffset + k);
    if (i === 1) originIndices = indices;
    else if (i === 2) destIndices = indices;
    colOffset += span;
  }
  // Fallback: if nucleos parsing gave nothing useful, use first col as dep, last as arr
  if (!originIndices.length) originIndices = [0];
  if (!destIndices.length) destIndices = [horario[0]?.horas.length - 1 ?? 0];

  const enriched = horario.map(trip => {
    // Find first non-'--' time in the origin columns
    let departureStr = null;
    for (const idx of originIndices) {
      const h = trip.horas[idx];
      if (h && h !== '--') { departureStr = h; break; }
    }
    if (!departureStr) return null;

    const [hh, mm] = departureStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;

    const depTime = new Date(now);
    depTime.setHours(hh, mm, 0, 0);

    // Find last non-'--' time in destination columns
    let arrivalStr = null;
    for (const idx of [...destIndices].reverse()) {
      const h = trip.horas[idx];
      if (h && h !== '--') { arrivalStr = h; break; }
    }

    // Look up whether this trip's dias acronym runs today
    const dias = (trip.dias || '').trim();
    const runsToday = dias in freqRunsToday ? freqRunsToday[dias] : true;

    // For today: calculate minutes from now; for future dates: all trips are valid
    const realNow = new Date();
    const mins = Math.round((depTime - realNow) / 60000);
    return { ...trip, depTime, mins, runsToday, departureStr, arrivalStr, stopNames };
  })
  .filter(t => {
    if (!t || !t.runsToday) return false;
    // For today: only show trips not yet departed (allow 5 min grace)
    // For future dates: show all trips on that day
    return selectedDateMode === 'today' ? t.mins > -5 : true;
  })
  .sort((a, b) => a.depTime - b.depTime)
  .slice(0, 12);

  if (!enriched.length) {
    resultsList.innerHTML = '';
    resultsNoService.classList.remove('hidden');
    return;
  }

  resultsList.innerHTML = '';
  enriched.forEach(trip => {
    const card = document.createElement('div');
    card.className = 'card planner-result-card';

    const showCountdown = selectedDateMode === 'today';
    const minsLabel = showCountdown ? (trip.mins <= 0 ? s('minsLabel', 0) : s('minsLabel', trip.mins)) : '';
    const minsClass = trip.mins <= 2 ? 'mins-now' : trip.mins <= 15 ? 'mins-soon' : 'mins-later';

    // Intermediate stops: any stop that's not in origin or dest columns and has a time
    const via = trip.horas
      .map((h, i) => {
        if (originIndices.includes(i) || destIndices.includes(i)) return null;
        if (!h || h === '--') return null;
        // Map horas index back to stopNames index (stopNames = bloques[1..-1])
        const nameIdx = i - 1; // bloques[0] = "Líneas", so bloques[i] = stopNames[i-1]
        return stopNames[nameIdx] || null;
      })
      .filter(Boolean)
      .join(', ');

    const arrivalStr = trip.arrivalStr;

    card.innerHTML = `
      <div class="departure-line">${escHtml(trip.codigo)}</div>
      <div class="departure-body">
        <div class="departure-dest">${escHtml(selectedTo.nombre)}</div>
        ${via ? `<div class="departure-name">${escHtml(s('passesThrough'))} ${escHtml(via)}</div>` : ''}
        <div class="departure-name planner-days">${escHtml(trip.dias)}</div>
      </div>
      <div class="departure-time-col">
        <span class="departure-sched">${escHtml(trip.departureStr)}</span>
        ${arrivalStr && arrivalStr !== '--' ? `<span class="planner-arrival">→ ${escHtml(arrivalStr)}</span>` : ''}
        ${showCountdown ? `<span class="departure-mins ${minsClass}">${minsLabel}</span>` : ''}
      </div>
      <span class="departure-info-arrow">›</span>
    `;

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      // Build a restoreable planner URL so back from route returns to results
      const plannerUrl = `planner.html?c=${currentConsorcio.idConsorcio}` +
        `&fromN=${selectedFrom.idNucleo}&toN=${selectedTo.idNucleo}`;
      const from = encodeURIComponent(plannerUrl);
      window.location.href =
        `route.html?c=${currentConsorcio.idConsorcio}&l=${trip.idlinea}` +
        `&code=${encodeURIComponent(trip.codigo)}` +
        `&dest=${encodeURIComponent(selectedTo.nombre)}` +
        `&sentido=1&from=${from}`;
    });

    resultsList.appendChild(card);
  });
}

function renderDirectConnections(data, now) {
  directSection.classList.add('hidden');
  directList.innerHTML = '';

  const horario = data.horario || [];
  if (!horario.length) return;

  // Reuse the same nucleos-index parsing logic from renderResults
  const nucleos = data.nucleos || [];
  let colOffset = 0;
  let originIndices = [];
  let destIndices = [];
  for (let i = 0; i < nucleos.length; i++) {
    const span = nucleos[i].colspan || 1;
    if (i === 0) continue; // skip blank header — no corresponding horas column
    const indices = Array.from({ length: span }, (_, k) => colOffset + k);
    if (i === 1) originIndices = indices;
    else if (i === 2) destIndices = indices;
    colOffset += span;
  }
  if (!originIndices.length) originIndices = [0];
  if (!destIndices.length)   destIndices   = [horario[0]?.horas.length - 1 ?? 0];

  // Build frecuencia lookup for today
  const dow = now.getDay();
  const isWeekday = dow >= 1 && dow <= 5;
  const isSat = dow === 6;
  const isSun = dow === 0;
  const frecuencias = data.frecuencias || [];
  const freqRunsToday = {};
  frecuencias.forEach(f => {
    const acr  = f.acronimo.trim();
    const name = (f.nombre || '').toLowerCase();
    let runs = false;
    if (name.includes('monday to friday') || name.includes('lunes a viernes')) runs = isWeekday;
    else if (name.includes('monday to saturday') || name.includes('lunes a sábado') || name.includes('lunes a sabado')) runs = isWeekday || isSat;
    else if ((name.includes('saturday') && name.includes('sunday')) || (name.includes('sábado') && name.includes('domingo'))) runs = isSat || isSun;
    else if (name.includes('saturday') || name.includes('sábado')) runs = isSat;
    else if (name.includes('sunday')   || name.includes('domingo')) runs = isSun;
    else runs = true;
    freqRunsToday[acr] = runs;
  });

  // Build all trips for the full day (no time cutoff, sorted by departure)
  const trips = horario.map(trip => {
    let depStr = null;
    for (const idx of originIndices) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { depStr = h; break; }
    }
    if (!depStr) return null;

    const [hh, mm] = depStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;

    const depTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);

    let arrStr = null;
    for (const idx of [...destIndices].reverse()) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { arrStr = h; break; }
    }

    const dias = (trip.dias || '').trim();
    const runsToday = dias in freqRunsToday ? freqRunsToday[dias] : true;
    if (!runsToday) return null;

    return { ...trip, depStr, arrStr, depTime };
  })
  .filter(Boolean)
  .sort((a, b) => a.depTime - b.depTime);

  if (!trips.length) return;

  directSectionLabel.textContent = s('directConnections', selectedDateMode);

  trips.forEach(trip => {
    const isPast = trip.depTime < now;
    const card = document.createElement('div');
    card.className = `card direct-result-card${isPast ? ' direct-result-past' : ''}`;

    card.innerHTML = `
      <div class="departure-line">${escHtml(trip.codigo || '')}</div>
      <div class="departure-body">
        <div class="departure-dest">${escHtml(selectedTo?.nombre || '')}</div>
        <div class="departure-name planner-days">${escHtml(trip.dias || '')}</div>
      </div>
      <div class="departure-time-col">
        <span class="departure-sched">${escHtml(trip.depStr)}</span>
        ${trip.arrStr ? `<span class="planner-arrival">→ ${escHtml(trip.arrStr)}</span>` : ''}
      </div>
    `;

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const plannerUrl = `planner.html?c=${currentConsorcio.idConsorcio}` +
        `&fromN=${selectedFrom.idNucleo}&toN=${selectedTo.idNucleo}`;
      const from = encodeURIComponent(plannerUrl);
      window.location.href =
        `route.html?c=${currentConsorcio.idConsorcio}&l=${trip.idlinea}` +
        `&code=${encodeURIComponent(trip.codigo || '')}` +
        `&dest=${encodeURIComponent(selectedTo?.nombre || '')}` +
        `&sentido=1&from=${from}`;
    });

    directList.appendChild(card);
  });

  directSection.classList.remove('hidden');
}

// ---- Navigation ----
backToRegion.addEventListener('click', () => showPlannerStep(stepRegion));
backToForm.addEventListener('click', () => showPlannerStep(stepForm));

function showPlannerStep(step) {
  [stepRegion, stepForm, stepResults].forEach(el => {
    el.classList.add('hidden');
  });
  step.classList.remove('hidden');
}

// ---- Helpers ----
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
