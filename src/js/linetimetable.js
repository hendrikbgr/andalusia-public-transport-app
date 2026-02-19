// ===== Line Timetable Search =====
const API = 'https://api.ctan.es/v1/Consorcios';

const CONSORTIUM_ICONS = {
  '1': '🌻', '2': '⚓', '3': '🏛️', '4': '☀️',
  '5': '🪨', '6': '🎸', '7': '🫒', '8': '🕌', '9': '🌊',
};

const LTT_STRINGS = {
  en: {
    title:         'Line Timetables',
    regionLabel:   'Select region',
    backRegion:    '← Back',
    backSearch:    '← Back',
    searchHint:    'Type a line code (e.g. M-221) or part of the name',
    searchPlaceholder: 'Search by line number or name…',
    noLines:       'No lines found',
    noConn:        'Could not load data. Check your connection.',
    loading:       'Loading…',
    outbound:      'Outbound',
    inbound:       'Inbound',
    noData:        'No timetable data available',
    stop:          'Stop',
  },
  es: {
    title:         'Horarios de Líneas',
    regionLabel:   'Selecciona región',
    backRegion:    '← Volver',
    backSearch:    '← Volver',
    searchHint:    'Escribe el código (p.ej. M-221) o parte del nombre',
    searchPlaceholder: 'Busca por número de línea o nombre…',
    noLines:       'No se encontraron líneas',
    noConn:        'No se pudo cargar. Comprueba la conexión.',
    loading:       'Cargando…',
    outbound:      'Ida',
    inbound:       'Vuelta',
    noData:        'No hay datos de horario disponibles',
    stop:          'Parada',
  },
};

function ls(key) {
  const lang = getLang();
  return LTT_STRINGS[lang]?.[key] ?? LTT_STRINGS.en[key];
}

// ---- Elements ----
const langToggle       = document.getElementById('lang-toggle');
const lttTitle         = document.getElementById('ltt-title');
const lttRegionLabel   = document.getElementById('ltt-region-label');
const lttRegionList    = document.getElementById('ltt-region-list');
const lttRegionWrapper = document.getElementById('ltt-region-wrapper');
const lttSearchForm    = document.getElementById('ltt-search-form');
const lttChosenRegion  = document.getElementById('ltt-chosen-region');
const lttBackRegion    = document.getElementById('ltt-back-region');
const lttLineInput     = document.getElementById('ltt-line-input');
const lttLineResults   = document.getElementById('ltt-line-results');
const lttSearchHint    = document.getElementById('ltt-search-hint');
const lttStepSearch    = document.getElementById('ltt-step-search');
const lttStepGrid      = document.getElementById('ltt-step-grid');
const lttBackSearch    = document.getElementById('ltt-back-search');
const lttLineBadge     = document.getElementById('ltt-line-badge');
const lttLineName      = document.getElementById('ltt-line-name');
const lttLineRegion    = document.getElementById('ltt-line-region');
const lttDirectionTabs = document.getElementById('ltt-direction-tabs');
const lttFreqTabs      = document.getElementById('ltt-freq-tabs');
const lttGridWrapper   = document.getElementById('ltt-grid-wrapper');

// ---- State ----
let currentConsorcio = null;
let allLines = [];
let activeFreqId = null;
let activeDir = 'ida';
let currentLineId = null;
let ttData = null;

// ---- Lang ----
function applyLang() {
  const lang = getLang();
  document.documentElement.lang = lang;
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  lttTitle.textContent       = ls('title');
  lttRegionLabel.textContent = ls('regionLabel');
  lttBackRegion.textContent  = ls('backRegion');
  lttBackSearch.textContent  = ls('backSearch');
  lttSearchHint.textContent  = ls('searchHint');
  lttLineInput.placeholder   = ls('searchPlaceholder');
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
});

applyLang();

// ---- Load regions ----
async function loadRegions() {
  lttRegionList.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await fetchJSON(`${API}/consorcios`);
    lttRegionList.innerHTML = '';
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
      lttRegionList.appendChild(card);
    });
  } catch {
    lttRegionList.innerHTML = `<p class="hint">${ls('noConn')}</p>`;
  }
}

async function selectRegion(c) {
  currentConsorcio = c;
  lttChosenRegion.textContent = c.nombre;
  lttLineInput.value = '';
  lttLineResults.innerHTML = '';
  lttLineResults.classList.add('hidden');
  allLines = [];

  lttRegionWrapper.classList.add('hidden');
  lttSearchForm.classList.remove('hidden');

  // Load lines for this consortium
  try {
    const data = await fetchJSON(`${API}/${c.idConsorcio}/lineas`);
    allLines = data.lineas || [];
  } catch {
    // non-fatal
  }
}

// ---- Back to regions ----
lttBackRegion.addEventListener('click', () => {
  lttSearchForm.classList.add('hidden');
  lttRegionWrapper.classList.remove('hidden');
});

// ---- Line search ----
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

lttLineInput.addEventListener('input', () => {
  const q = normalize(lttLineInput.value.trim());
  if (!q) { lttLineResults.classList.add('hidden'); return; }

  const matches = allLines
    .filter(l => normalize(l.codigo || '').includes(q) || normalize(l.nombre || '').includes(q))
    .slice(0, 12);

  if (!matches.length) {
    lttLineResults.innerHTML = `<div class="planner-dropdown-item ltt-no-results">${ls('noLines')}</div>`;
    lttLineResults.classList.remove('hidden');
    return;
  }

  lttLineResults.innerHTML = '';
  matches.forEach(line => {
    const item = document.createElement('div');
    item.className = 'planner-dropdown-item ltt-line-item';
    item.innerHTML = `<span class="ltt-dropdown-badge">${escHtml(line.codigo || '')}</span> ${escHtml(line.nombre || '')}`;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      lttLineInput.value = line.codigo;
      lttLineResults.classList.add('hidden');
      openLineTimetable(line);
    });
    lttLineResults.appendChild(item);
  });
  lttLineResults.classList.remove('hidden');
});

document.addEventListener('click', e => {
  if (!lttLineInput.contains(e.target) && !lttLineResults.contains(e.target)) {
    lttLineResults.classList.add('hidden');
  }
});

// ---- Open timetable for a line ----
async function openLineTimetable(line) {
  currentLineId = line.idLinea;
  lttLineBadge.textContent  = line.codigo || '';
  lttLineName.textContent   = line.nombre || '';
  lttLineRegion.textContent = currentConsorcio?.nombre || '';

  lttStepSearch.classList.add('hidden');
  lttStepGrid.classList.remove('hidden');

  lttDirectionTabs.innerHTML = '';
  lttFreqTabs.innerHTML = '';
  lttGridWrapper.innerHTML = '<div class="loading-spinner"></div>';

  // Discover which frequencies this line actually runs on by probing all global freqs in parallel
  try {
    const today = new Date();
    const dia = today.getDate();
    const mes = today.getMonth() + 1;

    // Fetch global frequency list for this consortium
    const freqData = await fetchJSON(`${API}/${currentConsorcio.idConsorcio}/frecuencias`);
    const globalFreqs = freqData.frecuencias || [];

    // Probe all frequencies in parallel — keep those that return planificadores
    const probeResults = await Promise.all(
      globalFreqs.map(async gf => {
        try {
          const d = await fetchJSON(
            `${API}/${currentConsorcio.idConsorcio}/horarios_lineas` +
            `?idLinea=${line.idLinea}&idFrecuencia=${gf.idFreq}&dia=${dia}&mes=${mes}`
          );
          const hasData = (d.planificadores || []).length > 0;
          // The response may include its own frecuencias list — use that for labels
          const freqsInResp = d.frecuencias || [];
          return hasData ? { idFreq: gf.idFreq, freqsInResp } : null;
        } catch { return null; }
      })
    );

    // Build deduped freq list from those that returned data
    const seenIds = new Set();
    const availableFreqs = [];
    for (const r of probeResults) {
      if (!r) continue;
      for (const f of r.freqsInResp) {
        if (!seenIds.has(f.idfrecuencia)) {
          seenIds.add(f.idfrecuencia);
          availableFreqs.push(f); // { idfrecuencia, acronimo, nombre }
        }
      }
    }

    if (!availableFreqs.length) {
      lttGridWrapper.innerHTML = `<p class="tt-no-data">${ls('noData')}</p>`;
      return;
    }

    activeFreqId = availableFreqs[0].idfrecuencia;
    activeDir = 'ida';

    buildFreqTabs(availableFreqs);
    await loadAndRender(line.idLinea, dia, mes);
  } catch {
    lttGridWrapper.innerHTML = `<p class="tt-no-data">${ls('noConn')}</p>`;
  }
}

// ---- Back to search ----
lttBackSearch.addEventListener('click', () => {
  lttStepGrid.classList.add('hidden');
  lttStepSearch.classList.remove('hidden');
});

// ---- Freq tabs ----
function buildFreqTabs(freqs) {
  lttFreqTabs.innerHTML = '';
  freqs.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'tt-freq-tab' + (f.idfrecuencia === activeFreqId ? ' active' : '');
    btn.textContent = f.nombre || f.acronimo || f.idfrecuencia;
    btn.dataset.freqId = f.idfrecuencia;
    btn.addEventListener('click', async () => {
      activeFreqId = f.idfrecuencia;
      lttFreqTabs.querySelectorAll('.tt-freq-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const today = new Date();
      await loadAndRender(currentLineId, today.getDate(), today.getMonth() + 1);
    });
    lttFreqTabs.appendChild(btn);
  });
}

// ---- Direction tabs ----
function buildDirectionTabs(hasIda, hasVuelta) {
  lttDirectionTabs.innerHTML = '';
  if (!hasIda || !hasVuelta) {
    activeDir = hasIda ? 'ida' : 'vuelta';
    return;
  }
  ['ida', 'vuelta'].forEach(dir => {
    const btn = document.createElement('button');
    btn.className = 'direction-tab' + (dir === activeDir ? ' active' : '');
    btn.textContent = dir === 'ida' ? ls('outbound') : ls('inbound');
    btn.addEventListener('click', async () => {
      if (activeDir === dir) return;
      activeDir = dir;
      lttDirectionTabs.querySelectorAll('.direction-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
    lttDirectionTabs.appendChild(btn);
  });
}

// ---- Load & render ----
async function loadAndRender(lineId, dia, mes) {
  lttGridWrapper.innerHTML = '<div class="loading-spinner"></div>';
  try {
    ttData = await fetchJSON(
      `${API}/${currentConsorcio.idConsorcio}/horarios_lineas` +
      `?idLinea=${lineId}&idFrecuencia=${activeFreqId}&dia=${dia}&mes=${mes}`
    );
    const planif = (ttData.planificadores || [])[0] || {};
    const hasIda    = (planif.bloquesIda   || []).some(b => b.tipo !== '1');
    const hasVuelta = (planif.bloquesVuelta || []).some(b => b.tipo !== '1');
    buildDirectionTabs(hasIda, hasVuelta);
    renderGrid();
  } catch {
    lttGridWrapper.innerHTML = `<p class="tt-no-data">${ls('noConn')}</p>`;
  }
}

// ---- Render timetable grid ----
function renderGrid() {
  const planif   = (ttData?.planificadores || [])[0];
  if (!planif) {
    lttGridWrapper.innerHTML = `<p class="tt-no-data">${ls('noData')}</p>`;
    return;
  }

  const bloques = (activeDir === 'ida' ? planif.bloquesIda   : planif.bloquesVuelta) || [];
  const horario = (activeDir === 'ida' ? planif.horarioIda   : planif.horarioVuelta) || [];

  const stopRows   = bloques.filter(b => b.tipo !== '1');
  const stopIndices = [];
  bloques.forEach((b, i) => { if (b.tipo !== '1') stopIndices.push(i); });

  if (!stopRows.length || !horario.length) {
    lttGridWrapper.innerHTML = `<p class="tt-no-data">${ls('noData')}</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'tt-grid';

  // Header row: trip departure times from first stop
  const thead = document.createElement('thead');
  const hRow  = document.createElement('tr');
  const stopTh = document.createElement('th');
  stopTh.textContent = ls('stop');
  hRow.appendChild(stopTh);

  const firstStopIdx = stopIndices[0];
  horario.forEach(trip => {
    const th = document.createElement('th');
    const time = trip.horas?.[firstStopIdx];
    th.textContent = (time && time !== '--') ? time : '·';
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Body rows: one per stop
  const tbody = document.createElement('tbody');
  stopRows.forEach((stop, rowIdx) => {
    const horasIdx = stopIndices[rowIdx];
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.className = 'tt-stop-name';
    nameTd.textContent = stop.nombre || '';
    tr.appendChild(nameTd);

    horario.forEach(trip => {
      const td = document.createElement('td');
      const time = trip.horas?.[horasIdx];
      td.textContent = (time && time !== '--') ? time : '·';
      if (!time || time === '--') td.classList.add('tt-cell-empty');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  lttGridWrapper.innerHTML = '';
  lttGridWrapper.appendChild(table);
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

// ---- Init ----
loadRegions();
