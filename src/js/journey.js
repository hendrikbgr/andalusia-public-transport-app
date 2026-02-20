const API = 'https://api.ctan.es/v1/Consorcios';

const CONSORTIUM_ICONS = {
  '1': '🌻', '2': '⚓', '3': '🏛️', '4': '☀️',
  '5': '🪨', '6': '🎸', '7': '🫒', '8': '🕌', '9': '🌊',
};

const STRINGS = {
  en: {
    journeyTitle:    'Journey Planner',
    labelRegion:     'Select region',
    labelFrom:       'From',
    labelTo:         'To',
    searchBtn:       'Search',
    searching:       'Searching for connections…',
    resultsLabel:    mode => mode === 'today' ? 'Journeys today' : mode === 'tomorrow' ? 'Journeys tomorrow' : 'Journeys on this date',
    noRoutes:        'No routes found',
    noRoutesHint:    'Try a different origin or destination',
    noConn:          'Could not load data. Check your connection.',
    backRegion:      '← Back',
    backForm:        '← Change route',
    placeholder:     'Type a town or stop…',
    outOfNetworkItem: name => `Search lines to "${name}" →`,
    dateToday:       'Today',
    dateTomorrow:    'Tomorrow',
    datePick:        'Pick date',
    direct:          'DIRECT',
    leg1Label:       'Leg 1',
    leg2Label:       'Leg 2',
    transfer:        'Transfer at',
    transferWait:    mins => `~${mins} min wait`,
    minsLabel:       m => m <= 0 ? 'Now' : m === 1 ? 'in 1 min' : `in ${m} min`,
    passesThrough:   'via',
    linesHeading:    'Lines serving this destination:',
    stepBoard:       'Board',
    stepTransfer:    'Transfer',
    stepArrive:      'Arrive',
    stepWait:        mins => `~${mins} min wait`,
    viewOnMap:       '📍 View on map',
    oonLineLabel:    'Line',
    oonRouteName:    'Route',
    oonHint:         from => `This line does not directly serve ${from}. You will need to reach a stop on this route first.`,
  },
  es: {
    journeyTitle:    'Planificador de Viaje',
    labelRegion:     'Selecciona región',
    labelFrom:       'Desde',
    labelTo:         'Hasta',
    searchBtn:       'Buscar',
    searching:       'Buscando conexiones…',
    resultsLabel:    mode => mode === 'today' ? 'Viajes hoy' : mode === 'tomorrow' ? 'Viajes mañana' : 'Viajes en esta fecha',
    noRoutes:        'No se encontraron rutas',
    noRoutesHint:    'Prueba con otro origen o destino',
    noConn:          'No se pudo cargar. Comprueba la conexión.',
    backRegion:      '← Volver',
    backForm:        '← Cambiar ruta',
    placeholder:     'Escribe una localidad o parada…',
    outOfNetworkItem: name => `Buscar líneas hacia "${name}" →`,
    dateToday:       'Hoy',
    dateTomorrow:    'Mañana',
    datePick:        'Elegir fecha',
    direct:          'DIRECTO',
    leg1Label:       'Tramo 1',
    leg2Label:       'Tramo 2',
    transfer:        'Transbordo en',
    transferWait:    mins => `~${mins} min espera`,
    minsLabel:       m => m <= 0 ? 'Ahora' : m === 1 ? 'en 1 min' : `en ${m} min`,
    passesThrough:   'vía',
    linesHeading:    'Líneas que sirven este destino:',
    stepBoard:       'Embarcar',
    stepTransfer:    'Transbordo',
    stepArrive:      'Llegada',
    stepWait:        mins => `~${mins} min espera`,
    viewOnMap:       '📍 Ver en el mapa',
    oonLineLabel:    'Línea',
    oonRouteName:    'Recorrido',
    oonHint:         from => `Esta línea no sirve directamente ${from}. Tendrá que llegar a una parada en esta ruta primero.`,
  },
};

function s(key, ...args) {
  const lang = getLang();
  const val = STRINGS[lang]?.[key] ?? STRINGS.en[key];
  return typeof val === 'function' ? val(...args) : val;
}

// ---- Elements ----
const langToggle          = document.getElementById('lang-toggle');
const journeyTitle        = document.getElementById('journey-title');
const stepRegion          = document.getElementById('step-region');
const stepForm            = document.getElementById('step-form');
const stepResults         = document.getElementById('step-results');
const journeyRegionList   = document.getElementById('journey-region-list');
const journeyRegionLabel  = document.getElementById('journey-region-label');
const labelRegion         = document.getElementById('label-region');
const backToRegion        = document.getElementById('back-to-region');
const backToForm          = document.getElementById('back-to-form');
const fromInput           = document.getElementById('from-input');
const toInput             = document.getElementById('to-input');
const fromResults         = document.getElementById('from-results');
const toResults           = document.getElementById('to-results');
const swapBtn             = document.getElementById('swap-btn');
const searchBtn           = document.getElementById('search-btn');
const searchBtnText       = document.getElementById('search-btn-text');
const resultsLabel        = document.getElementById('results-label');
const routeSummary        = document.getElementById('route-summary');
const resultsLoading      = document.getElementById('results-loading');
const resultsLoadingText  = document.getElementById('results-loading-text');
const itineraryList       = document.getElementById('itinerary-list');
const resultsNoService    = document.getElementById('results-no-service');
const resultsNoServiceText = document.getElementById('results-no-service-text');
const resultsNoServiceHint = document.getElementById('results-no-service-hint');
const resultsLinesHint    = document.getElementById('results-lines-hint');
const resultsLinesLabel   = document.getElementById('results-lines-hint-label');
const resultsLinesList    = document.getElementById('results-lines-list');
const labelFrom           = document.getElementById('label-from');
const labelTo             = document.getElementById('label-to');
const dateBtnToday        = document.getElementById('date-btn-today');
const dateBtnTomorrow     = document.getElementById('date-btn-tomorrow');
const dateBtnPick         = document.getElementById('date-btn-pick');
const datePickerInput     = document.getElementById('date-picker-input');
const journeySheetBackdrop = document.getElementById('journey-sheet-backdrop');
const journeyDetailSheet   = document.getElementById('journey-detail-sheet');
const journeySheetContent  = document.getElementById('journey-sheet-content');

// ---- State ----
let currentConsorcio  = null;
let allNucleos        = [];
let selectedFrom      = null;  // nucleo object, or { nombre, idNucleo: null, isOutOfNetwork: true }
let selectedTo        = null;
let selectedDateMode  = 'today';
let selectedPickedDate = null;

// Session-level caches (cleared on region change)
const lineParadasCache  = {};  // idLinea → paradas[]
const nucleoLineasCache = {};  // idNucleo → lineas[]
let   allConsorcioLines = null; // all lines in consortium (fetched once)

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
  ({ today: dateBtnToday, tomorrow: dateBtnTomorrow, pick: dateBtnPick })[mode].classList.add('active');
  datePickerInput.classList.toggle('hidden', mode !== 'pick');
}

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
  journeyTitle.textContent          = s('journeyTitle');
  labelRegion.textContent           = s('labelRegion');
  labelFrom.textContent             = s('labelFrom');
  labelTo.textContent               = s('labelTo');
  fromInput.placeholder             = s('placeholder');
  toInput.placeholder               = s('placeholder');
  searchBtnText.textContent         = s('searchBtn');
  backToRegion.textContent          = s('backRegion');
  backToForm.textContent            = s('backForm');
  resultsLabel.textContent          = s('resultsLabel', selectedDateMode);
  resultsLoadingText.textContent    = s('searching');
  resultsNoServiceText.textContent  = s('noRoutes');
  resultsNoServiceHint.textContent  = s('noRoutesHint');
  dateBtnToday.textContent          = s('dateToday');
  dateBtnTomorrow.textContent       = s('dateTomorrow');
  dateBtnPick.textContent           = s('datePick');
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
  if (!stepRegion.classList.contains('hidden')) loadRegions();
});

applyLang();

// ---- Init ----
loadRegions();

// ---- Region loading ----
async function loadRegions() {
  journeyRegionList.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await fetchJSON(`${API}/consorcios`);
    journeyRegionList.innerHTML = '';
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
      journeyRegionList.appendChild(card);
    });
  } catch {
    journeyRegionList.innerHTML = `<p class="hint">${s('noConn')}</p>`;
  }
}

async function selectRegion(c) {
  currentConsorcio = c;
  journeyRegionLabel.textContent = c.nombre;
  allNucleos = [];
  selectedFrom = null;
  selectedTo = null;
  fromInput.value = '';
  toInput.value = '';
  // Clear session caches on region change
  Object.keys(lineParadasCache).forEach(k => delete lineParadasCache[k]);
  Object.keys(nucleoLineasCache).forEach(k => delete nucleoLineasCache[k]);
  allConsorcioLines = null;
  updateSearchBtn();
  showStep(stepForm);

  try {
    const data = await fetchJSON(`${API}/${c.idConsorcio}/nucleos`);
    allNucleos = data.nucleos || [];
  } catch {
    // non-fatal
  }
}

// ---- From/To search ----
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

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

function renderDropdown(input, resultsEl, onSelect) {
  const q = normalize(input.value.trim());
  if (!q) { hideDropdown(input, resultsEl); return; }

  const matches = allNucleos
    .filter(n => normalize(n.nombre).includes(q))
    .slice(0, 10);

  resultsEl.innerHTML = '';

  matches.forEach(n => {
    const item = document.createElement('div');
    item.className = 'planner-dropdown-item';
    item.textContent = n.nombre;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      onSelect(n);
      input.value = n.nombre;
      hideDropdown(input, resultsEl);
    });
    resultsEl.appendChild(item);
  });

  // If no exact matches and this is the "To" field, offer an out-of-network ghost item
  if (!matches.length && input === toInput) {
    const ghost = document.createElement('div');
    ghost.className = 'planner-dropdown-item planner-dropdown-ghost';
    ghost.textContent = s('outOfNetworkItem', input.value.trim());
    ghost.addEventListener('mousedown', e => {
      e.preventDefault();
      const destName = input.value.trim();
      onSelect({ nombre: destName, idNucleo: null, isOutOfNetwork: true });
      hideDropdown(input, resultsEl);
    });
    resultsEl.appendChild(ghost);
  }

  if (resultsEl.children.length) {
    resultsEl.classList.remove('hidden');
    input.classList.add('dropdown-open');
  } else {
    hideDropdown(input, resultsEl);
  }
}

function hideDropdown(input, resultsEl) {
  resultsEl.classList.add('hidden');
  input.classList.remove('dropdown-open');
}

setupSearch(fromInput, fromResults, n => { selectedFrom = n; updateSearchBtn(); });
setupSearch(toInput,   toResults,   n => { selectedTo   = n; updateSearchBtn(); });

fromInput.addEventListener('input', () => { selectedFrom = null; updateSearchBtn(); });
toInput.addEventListener('input',   () => { selectedTo   = null; updateSearchBtn(); });

function updateSearchBtn() {
  const fromOk = !!selectedFrom;
  const toOk   = !!selectedTo;
  const different = !selectedFrom || !selectedTo ||
    selectedFrom.idNucleo !== selectedTo.idNucleo ||
    selectedTo.isOutOfNetwork;
  searchBtn.disabled = !(fromOk && toOk && different);
}

// ---- Swap (only works when both are in-network nuclei) ----
swapBtn.addEventListener('click', () => {
  if (selectedTo?.isOutOfNetwork) return;
  const tmpVal = fromInput.value;
  const tmpSel = selectedFrom;
  fromInput.value = toInput.value;
  selectedFrom = selectedTo;
  toInput.value = tmpVal;
  selectedTo = tmpSel;
  updateSearchBtn();
});

// ---- Search entry point ----
searchBtn.addEventListener('click', runSearch);

async function runSearch() {
  if (!selectedFrom || !selectedTo) return;
  showStep(stepResults);
  showLoading(true);
  clearResults();
  routeSummary.textContent = `${selectedFrom.nombre}  →  ${selectedTo.nombre}`;
  resultsLabel.textContent = s('resultsLabel', selectedDateMode);

  const now = getSearchDate();

  try {
    if (selectedTo.isOutOfNetwork) {
      await runOutOfNetworkSearch(selectedFrom, selectedTo.nombre);
    } else {
      const itineraries = await findJourneys(selectedFrom, selectedTo, now);
      showLoading(false);
      renderItineraries(itineraries, now);
    }
  } catch {
    showLoading(false);
    itineraryList.innerHTML = `<p class="hint">${s('noConn')}</p>`;
  }
}

// ---- Helpers extracted from planner.js ----
function parseNucleosIndices(data) {
  const nucleos = data.nucleos || [];
  let colOffset = 0, originIndices = [], destIndices = [];
  for (let i = 0; i < nucleos.length; i++) {
    const span = nucleos[i].colspan || 1;
    if (i === 0) { continue; } // skip blank "Líneas" header column
    const indices = Array.from({ length: span }, (_, k) => colOffset + k);
    if (i === 1) originIndices = indices;
    else if (i === 2) destIndices = indices;
    colOffset += span;
  }
  if (!originIndices.length) originIndices = [0];
  if (!destIndices.length)   destIndices   = [data.horario?.[0]?.horas?.length - 1 ?? 0];
  return { originIndices, destIndices };
}

function buildFreqMap(frecuencias, isWeekday, isSat, isSun) {
  const map = {};
  frecuencias.forEach(f => {
    const acr  = f.acronimo.trim();
    const name = (f.nombre || '').toLowerCase();
    let runs = false;
    if      (name.includes('monday to friday') || name.includes('lunes a viernes'))  runs = isWeekday;
    else if (name.includes('monday to saturday') || name.includes('lunes a sábado') || name.includes('lunes a sabado')) runs = isWeekday || isSat;
    else if ((name.includes('saturday') && name.includes('sunday')) || (name.includes('sábado') && name.includes('domingo'))) runs = isSat || isSun;
    else if (name.includes('saturday') || name.includes('sábado')) runs = isSat;
    else if (name.includes('sunday')   || name.includes('domingo')) runs = isSun;
    else runs = true;
    map[acr] = runs;
  });
  return map;
}

/**
 * Extract trip objects from a horarios_origen_destino response.
 * Returns array of { codigo, idlinea, dias, depStr, depTime, arrStr, arrTime, mins }
 * sorted by depTime ascending.
 *
 * @param {object} data  - API response
 * @param {Date}   now   - reference date (used for depTime construction)
 * @param {object} opts
 * @param {boolean} opts.allDay - if true, include past trips (no -5 min cutoff)
 */
function extractTrips(data, now, { allDay = false } = {}) {
  const horario = data.horario || [];
  if (!horario.length) return [];

  const dow = now.getDay();
  const isWeekday = dow >= 1 && dow <= 5;
  const isSat = dow === 6;
  const isSun = dow === 0;

  const freqMap = buildFreqMap(data.frecuencias || [], isWeekday, isSat, isSun);
  const { originIndices, destIndices } = parseNucleosIndices(data);
  const realNow = new Date();

  return horario.map(trip => {
    // Find first non-'--' departure time in origin columns
    let depStr = null;
    for (const idx of originIndices) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { depStr = h; break; }
    }
    if (!depStr) return null;

    const [hh, mm] = depStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;

    const depTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);

    // Find last non-'--' arrival time in destination columns
    let arrStr = null;
    for (const idx of [...destIndices].reverse()) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { arrStr = h; break; }
    }

    let arrTime = null;
    if (arrStr) {
      const [ah, am] = arrStr.split(':').map(Number);
      if (!isNaN(ah) && !isNaN(am)) {
        arrTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ah, am, 0, 0);
        // Handle overnight: if arrival is before departure, it's the next day
        if (arrTime < depTime) arrTime.setDate(arrTime.getDate() + 1);
      }
    }

    const dias = (trip.dias || '').trim();
    const runsToday = dias in freqMap ? freqMap[dias] : true;
    if (!runsToday) return null;

    const mins = Math.round((depTime - realNow) / 60000);
    if (!allDay && mins < -5) return null;

    return { ...trip, depStr, depTime, arrStr, arrTime, mins };
  }).filter(Boolean).sort((a, b) => a.depTime - b.depTime);
}

// ---- Cache helpers ----
async function getLineasForNucleo(cid, nucId) {
  if (nucleoLineasCache[nucId]) return nucleoLineasCache[nucId];
  const data = await fetchJSON(`${API}/${cid}/nucleos/${nucId}/lineas`);
  return (nucleoLineasCache[nucId] = data.lineas || []);
}

async function getLineParadas(cid, lineId) {
  if (lineParadasCache[lineId]) return lineParadasCache[lineId];
  const data = await fetchJSON(`${API}/${cid}/lineas/${lineId}/paradas`);
  return (lineParadasCache[lineId] = data.paradas || []);
}

// ---- Main journey-finding algorithm ----
const MIN_TRANSFER_MINS = 10;

async function findJourneys(origin, dest, now) {
  const cid = currentConsorcio.idConsorcio;

  // Phase 1: try direct connection
  const directData = await fetchJSON(
    `${API}/${cid}/horarios_origen_destino` +
    `?idNucleoOrigen=${origin.idNucleo}&idNucleoDestino=${dest.idNucleo}`
  );
  const directTrips = extractTrips(directData, now);

  if (directTrips.length) {
    return directTrips.slice(0, 5).map(t => ({
      type: 'direct',
      leg1: t,
      totalDeparture: t.depTime,
      totalArrival:   t.arrTime,
    }));
  }

  // Phase 2: find 1-transfer itineraries
  // Probe all nuclei to find which are reachable from origin AND connect to dest.
  // The paradas API uses different idNucleo values than the nucleos list, so we
  // must use horarios_origen_destino directly to discover reachable candidates.
  const candidates = allNucleos.filter(
    n => String(n.idNucleo) !== String(origin.idNucleo) &&
         String(n.idNucleo) !== String(dest.idNucleo)
  );

  // 2a. Probe origin → each candidate AND candidate → dest in parallel
  const probeResults = await Promise.all(
    candidates.map(async candidate => {
      const nucId = String(candidate.idNucleo);
      try {
        const [leg1Data, leg2Data] = await Promise.all([
          fetchJSON(`${API}/${cid}/horarios_origen_destino?idNucleoOrigen=${origin.idNucleo}&idNucleoDestino=${nucId}`),
          fetchJSON(`${API}/${cid}/horarios_origen_destino?idNucleoOrigen=${nucId}&idNucleoDestino=${dest.idNucleo}`),
        ]);
        const leg1Trips = extractTrips(leg1Data, now);
        const leg2Trips = extractTrips(leg2Data, now, { allDay: true });
        if (!leg1Trips.length || !leg2Trips.length) return null;
        return { candidate, leg1Trips, leg2Trips };
      } catch { return null; }
    })
  );

  const validTransfers = probeResults.filter(Boolean);
  if (!validTransfers.length) return [];

  // 2b. Match legs for each valid transfer nucleus
  const itineraries = [];
  for (const { candidate, leg1Trips, leg2Trips } of validTransfers) {
    const pairs = matchLegs(leg1Trips, leg2Trips, candidate);
    itineraries.push(...pairs);
  }

  // Sort by total arrival time (fall back to departure), cap at 5
  itineraries.sort((a, b) => {
    const aT = a.totalArrival || a.totalDeparture;
    const bT = b.totalArrival || b.totalDeparture;
    return aT - bT;
  });

  return itineraries.slice(0, 5);
}

function matchLegs(leg1Trips, leg2Trips, transferNucleo) {
  const pairs = [];
  for (const leg1 of leg1Trips) {
    // leg1.arrTime = arrival at transfer nucleus (from dest column of leg1 API call)
    // If not available, use a conservative 30-minute estimate
    const arrAtTransfer = leg1.arrTime || new Date(leg1.depTime.getTime() + 30 * 60000);
    const earliestLeg2  = new Date(arrAtTransfer.getTime() + MIN_TRANSFER_MINS * 60000);

    for (const leg2 of leg2Trips) {
      if (leg2.depTime >= earliestLeg2) {
        const waitMins = Math.round((leg2.depTime - arrAtTransfer) / 60000);
        pairs.push({
          type: 'transfer',
          leg1,
          leg2,
          transferNucleo,
          arrAtTransfer,
          waitMins,
          totalDeparture: leg1.depTime,
          totalArrival:   leg2.arrTime,
        });
        break; // Only the best (earliest) leg2 for each leg1
      }
    }
  }
  return pairs;
}

// ---- Out-of-network search (e.g. Marbella) ----
async function runOutOfNetworkSearch(origin, destName) {
  const cid = currentConsorcio.idConsorcio;
  const normDest = normalize(destName);

  try {
    // Fetch all consortium lines once (cached per region selection)
    if (!allConsorcioLines) {
      const data = await fetchJSON(`${API}/${cid}/lineas`);
      allConsorcioLines = data.lineas || [];
    }

    // Find lines whose name contains the destination (e.g. "Fuengirola-Marbella")
    const matchingLines = allConsorcioLines.filter(
      l => normalize(l.nombre || '').includes(normDest)
    );

    showLoading(false);

    if (!matchingLines.length) {
      resultsNoService.classList.remove('hidden');
      return;
    }

    resultsLinesLabel.textContent = s('linesHeading');
    resultsLinesList.innerHTML = '';
    matchingLines.forEach(line => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="departure-line" style="flex-shrink:0">${escHtml(line.codigo || line.idLinea)}</div>
        <div class="departure-body">
          <div class="departure-dest">${escHtml(line.nombre || '')}</div>
        </div>
        <span class="departure-info-arrow">›</span>
      `;
      card.addEventListener('click', () => openOutOfNetworkSheet(line));
      resultsLinesList.appendChild(card);
    });
    resultsLinesHint.classList.remove('hidden');
  } catch {
    showLoading(false);
    itineraryList.innerHTML = `<p class="hint">${s('noConn')}</p>`;
  }
}

// ---- Render itineraries ----
function renderItineraries(itineraries, now) {
  itineraryList.innerHTML = '';
  resultsNoService.classList.add('hidden');

  if (!itineraries.length) {
    resultsNoService.classList.remove('hidden');
    return;
  }

  const showCountdown = selectedDateMode === 'today';
  const realNow = new Date();

  itineraries.forEach(itin => {
    const card = document.createElement('div');
    card.className = 'card journey-card';

    if (itin.type === 'direct') {
      const leg = itin.leg1;
      const mins = Math.round((leg.depTime - realNow) / 60000);
      const minsClass = mins <= 2 ? 'mins-now' : mins <= 15 ? 'mins-soon' : 'mins-later';

      card.classList.add('journey-card-direct');
      card.innerHTML = `
        <div class="journey-direct-badge">${s('direct')}</div>
        <div class="journey-leg">
          <div class="journey-leg-body">
            <div class="departure-line">${escHtml(leg.codigo || '')}</div>
            <div class="departure-body">
              <div class="departure-dest">${escHtml(selectedTo.nombre)}</div>
              <div class="departure-name planner-days">${escHtml(leg.dias || '')}</div>
            </div>
            <div class="departure-time-col">
              <span class="departure-sched">${escHtml(leg.depStr)}</span>
              ${leg.arrStr ? `<span class="planner-arrival">→ ${escHtml(leg.arrStr)}</span>` : ''}
              ${showCountdown ? `<span class="departure-mins ${minsClass}">${s('minsLabel', mins)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    } else {
      const { leg1, leg2, transferNucleo, waitMins } = itin;
      const mins = Math.round((leg1.depTime - realNow) / 60000);
      const minsClass = mins <= 2 ? 'mins-now' : mins <= 15 ? 'mins-soon' : 'mins-later';

      card.classList.add('journey-card-transfer');
      card.innerHTML = `
        <div class="journey-leg">
          <div class="journey-leg-label">${s('leg1Label')}</div>
          <div class="journey-leg-body">
            <div class="departure-line">${escHtml(leg1.codigo || '')}</div>
            <div class="departure-body">
              <div class="departure-dest">${escHtml(transferNucleo.nombre)}</div>
              <div class="departure-name planner-days">${escHtml(leg1.dias || '')}</div>
            </div>
            <div class="departure-time-col">
              <span class="departure-sched">${escHtml(leg1.depStr)}</span>
              ${leg1.arrStr ? `<span class="planner-arrival">→ ${escHtml(leg1.arrStr)}</span>` : ''}
              ${showCountdown ? `<span class="departure-mins ${minsClass}">${s('minsLabel', mins)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="journey-transfer-banner">
          <span class="journey-transfer-icon">⇄</span>
          <span class="journey-transfer-text">${s('transfer')} ${escHtml(transferNucleo.nombre)}</span>
          <span class="journey-transfer-wait">${s('transferWait', waitMins)}</span>
        </div>
        <div class="journey-leg">
          <div class="journey-leg-label">${s('leg2Label')}</div>
          <div class="journey-leg-body">
            <div class="departure-line">${escHtml(leg2.codigo || '')}</div>
            <div class="departure-body">
              <div class="departure-dest">${escHtml(selectedTo.nombre)}</div>
              <div class="departure-name planner-days">${escHtml(leg2.dias || '')}</div>
            </div>
            <div class="departure-time-col">
              <span class="departure-sched">${escHtml(leg2.depStr)}</span>
              ${leg2.arrStr ? `<span class="planner-arrival">→ ${escHtml(leg2.arrStr)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openSheet(buildSheetHtml(itin), itin));
    itineraryList.appendChild(card);
  });
}

// ---- Detail bottom sheet ----
function openSheet(html, itin) {
  journeySheetContent.innerHTML = html;
  journeySheetBackdrop.classList.remove('hidden');
  journeyDetailSheet.classList.remove('hidden');
  requestAnimationFrame(() => {
    journeySheetBackdrop.classList.add('open');
    journeyDetailSheet.classList.add('open');
  });
  if (itin) prepareMapButton(itin);
}

function closeSheet() {
  journeySheetBackdrop.classList.remove('open');
  journeyDetailSheet.classList.remove('open');
  setTimeout(() => {
    journeySheetBackdrop.classList.add('hidden');
    journeyDetailSheet.classList.add('hidden');
  }, 280);
}

journeySheetBackdrop.addEventListener('click', closeSheet);

function stepHtml(iconClass, iconEmoji, action, main, sub, time) {
  return `
    <div class="journey-step">
      <div class="journey-step-icon ${escHtml(iconClass)}">${iconEmoji}</div>
      <div class="journey-step-body">
        <div class="journey-step-action">${escHtml(action)}</div>
        <div class="journey-step-main">${escHtml(main)}</div>
        ${sub ? `<div class="journey-step-sub">${escHtml(sub)}</div>` : ''}
      </div>
      ${time ? `<div class="journey-step-time">${escHtml(time)}</div>` : ''}
    </div>`;
}

function buildSheetHtml(itin) {
  let html = '';

  if (itin.type === 'direct') {
    const { leg1 } = itin;
    html += stepHtml('', '🚌', s('stepBoard'),
      `${escHtml(leg1.codigo || '')} → ${escHtml(selectedTo.nombre)}`,
      escHtml(leg1.dias || ''),
      leg1.depStr || '');
    html += stepHtml('arrive', '✓', s('stepArrive'),
      escHtml(selectedTo.nombre),
      '',
      leg1.arrStr || '—');
  } else {
    const { leg1, leg2, transferNucleo, waitMins } = itin;
    html += stepHtml('', '🚌', s('stepBoard'),
      `${escHtml(leg1.codigo || '')} → ${escHtml(transferNucleo.nombre)}`,
      escHtml(leg1.dias || ''),
      leg1.depStr || '');
    html += stepHtml('transfer', '⇄', s('stepTransfer'),
      escHtml(transferNucleo.nombre),
      s('stepWait', waitMins),
      leg1.arrStr || '');
    html += stepHtml('', '🚌', s('stepBoard'),
      `${escHtml(leg2.codigo || '')} → ${escHtml(selectedTo.nombre)}`,
      escHtml(leg2.dias || ''),
      leg2.depStr || '');
    html += stepHtml('arrive', '✓', s('stepArrive'),
      escHtml(selectedTo.nombre),
      '',
      leg2.arrStr || '—');
  }

  // Map button — starts as loading state; href filled in after polyline fetch
  html += `<button class="journey-map-btn" id="sheet-map-btn" disabled>${s('viewOnMap')}</button>`;
  return html;
}

// Leg colors for multi-segment journeys
const LEG_COLORS = ['#1a6fdb', '#e67e00'];

async function prepareMapButton(itin) {
  const cid = currentConsorcio.idConsorcio;
  const btn = document.getElementById('sheet-map-btn');
  if (!btn) return;

  try {
    const legs = itin.type === 'direct'
      ? [{ trip: itin.leg1, color: LEG_COLORS[0] }]
      : [{ trip: itin.leg1, color: LEG_COLORS[0] }, { trip: itin.leg2, color: LEG_COLORS[1] }];

    const polyResults = await Promise.all(legs.map(async ({ trip, color }) => {
      if (!trip.idlinea) return null;
      try {
        const data = await fetchJSON(`${API}/${cid}/lineas/${trip.idlinea}`);
        const poly = data.polilinea || [];
        const lineColor = data.color ? `#${data.color}` : color;
        return poly.length ? { points: poly, color: lineColor, code: trip.codigo || '', lineaId: String(trip.idlinea) } : null;
      } catch { return null; }
    }));
    const journeyPolys = polyResults.filter(Boolean);

    sessionStorage.setItem('journeyPolylines', JSON.stringify(journeyPolys));
    sessionStorage.removeItem('routePolyline');
    sessionStorage.removeItem('routePolylineCode');
    sessionStorage.removeItem('routeLineaId');

    const mapUrl = `map.html?c=${cid}&polyline=1`;
    // Replace button with link
    const link = document.createElement('a');
    link.href = mapUrl;
    link.className = 'journey-map-btn';
    link.textContent = s('viewOnMap');
    btn.replaceWith(link);
  } catch {
    // If fetch fails, still allow navigation to map without polyline
    const mapUrl = `map.html?c=${cid}`;
    const link = document.createElement('a');
    link.href = mapUrl;
    link.className = 'journey-map-btn';
    link.textContent = s('viewOnMap');
    btn.replaceWith(link);
  }
}

// ---- Out-of-network detail sheet ----

// Extract all nucleo candidates from a line name by splitting on '-'.
// Returns array of matching nucleo objects (excluding the origin).
// Prefers exact name matches over partial matches.
function boardNucleoCandidates(lineName) {
  const parts = lineName.split('-').map(p => p.trim());
  const results = [];
  for (const part of parts) {
    const normPart = normalize(part);
    // Exact match first
    let match = allNucleos.find(n => normalize(n.nombre) === normPart);
    // Then: nucleo name fully contained in part (e.g. part="Las Lagunas" matches nucleo "Las Lagunas")
    if (!match) match = allNucleos.find(n => normPart === normalize(n.nombre));
    // Then: part fully contained in nucleo name — skip (too loose, causes wrong matches)
    if (match && String(match.idNucleo) !== String(selectedFrom?.idNucleo)) {
      results.push(match);
    }
  }
  return results;
}

function openOutOfNetworkSheet(line) {
  // Show a loading sheet immediately, then fill in with real times
  let html = `<div class="journey-loading"><div class="loading-spinner"></div></div>`;
  openSheet(html, null);

  (async () => {
    const cid = currentConsorcio.idConsorcio;
    const now = getSearchDate();
    const mapUrl = `map.html?c=${cid}`;

    // 1. Find board nucleus — try each candidate from the line name in order,
    //    pick the first one that actually has trips from the origin.
    const candidates = boardNucleoCandidates(line.nombre || '');
    let boardNucleo = null;
    let leg1Trips = [];

    // Fetch trips to all candidates in parallel, then pick the first with results
    const [candidateResults, lineData] = await Promise.all([
      Promise.all(candidates.map(async nucleo => {
        try {
          const d = await fetchJSON(`${API}/${cid}/horarios_origen_destino?idNucleoOrigen=${selectedFrom.idNucleo}&idNucleoDestino=${nucleo.idNucleo}`);
          const trips = extractTrips(d, now);
          return { nucleo, trips };
        } catch { return { nucleo, trips: [] }; }
      })),
      fetchJSON(`${API}/${cid}/lineas/${line.idLinea}`).catch(() => null),
    ]);

    // Pick first candidate with trips
    for (const { nucleo, trips } of candidateResults) {
      if (trips.length) { boardNucleo = nucleo; leg1Trips = trips; break; }
    }

    // 3. Build sheet HTML
    let newHtml = '';
    const showCountdown = selectedDateMode === 'today';
    const realNow = new Date();

    if (boardNucleo && leg1Trips.length) {
      // Show up to 3 next departures for leg1
      leg1Trips.slice(0, 3).forEach((trip, i) => {
        const mins = Math.round((trip.depTime - realNow) / 60000);
        const minsClass = mins <= 2 ? 'mins-now' : mins <= 15 ? 'mins-soon' : 'mins-later';
        // Leg1: board from origin to boardNucleo
        newHtml += stepHtml('', '🚌', s('stepBoard'),
          `${escHtml(trip.codigo || '')} → ${escHtml(boardNucleo.nombre)}`,
          escHtml(trip.dias || ''),
          trip.depStr || '');
        // Transfer at boardNucleo
        newHtml += stepHtml('transfer', '⇄', s('stepTransfer'),
          escHtml(boardNucleo.nombre),
          trip.arrStr ? `${s('stepArrive')} ${trip.arrStr}` : '',
          trip.arrStr || '');
        // Leg2: board out-of-network line toward dest
        newHtml += stepHtml('', '🚌', s('stepBoard'),
          `${escHtml(line.codigo || '')} → ${escHtml(selectedTo?.nombre || '')}`,
          escHtml(line.nombre || ''),
          '');
        if (i < Math.min(leg1Trips.length, 3) - 1) {
          newHtml += `<div style="border-top:2px solid var(--border);margin:8px 0"></div>`;
        }
      });
    } else {
      // No leg1 found — just show the line info
      newHtml += stepHtml('', '🚌', s('oonLineLabel'),
        escHtml(line.nombre || ''),
        s('oonHint', selectedFrom?.nombre || ''),
        '');
    }

    // Map button (loading → link after polyline stored)
    newHtml += `<button class="journey-map-btn" id="sheet-map-btn" disabled style="margin-top:16px">${s('viewOnMap')}</button>`;

    journeySheetContent.innerHTML = newHtml;

    // 4. Store polyline and upgrade map button
    const poly = lineData?.polilinea || [];
    const lineColor = lineData?.color ? `#${lineData.color}` : LEG_COLORS[0];
    const btn = document.getElementById('sheet-map-btn');
    if (btn) {
      if (poly.length) {
        sessionStorage.setItem('journeyPolylines', JSON.stringify([{ points: poly, color: lineColor, code: line.codigo || '', lineaId: String(line.idLinea) }]));
        sessionStorage.removeItem('routePolyline');
        sessionStorage.removeItem('routePolylineCode');
        sessionStorage.removeItem('routeLineaId');
        const link = document.createElement('a');
        link.href = `map.html?c=${cid}&polyline=1`;
        link.className = 'journey-map-btn';
        link.style.marginTop = '16px';
        link.textContent = s('viewOnMap');
        btn.replaceWith(link);
      } else {
        const link = document.createElement('a');
        link.href = mapUrl;
        link.className = 'journey-map-btn';
        link.style.marginTop = '16px';
        link.textContent = s('viewOnMap');
        btn.replaceWith(link);
      }
    }
  })().catch(() => {
    journeySheetContent.innerHTML = `<p class="hint">${s('noConn')}</p>`;
  });
}

// ---- Navigation ----
backToRegion.addEventListener('click', () => showStep(stepRegion));
backToForm.addEventListener('click',   () => showStep(stepForm));

function showStep(step) {
  [stepRegion, stepForm, stepResults].forEach(el => el.classList.add('hidden'));
  step.classList.remove('hidden');
}

function showLoading(on) {
  resultsLoading.classList.toggle('hidden', !on);
  itineraryList.innerHTML = '';
}

function clearResults() {
  itineraryList.innerHTML = '';
  resultsNoService.classList.add('hidden');
  resultsLinesHint.classList.add('hidden');
  resultsLinesList.innerHTML = '';
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
