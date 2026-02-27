const API = 'https://api.ctan.es/v1/Consorcios';

// ---- Parse URL params ----
const params      = new URLSearchParams(location.search);
const CONSORCIO_ID = params.get('c');
const LINEA_ID     = params.get('l');
const LINEA_CODE   = params.get('code') || '';
const BACK_URL     = params.get('from') || 'stops.html';

if (!CONSORCIO_ID || !LINEA_ID) location.href = 'stops.html';

// ---- Elements ----
const backBtn         = document.getElementById('back-btn');
const ttTitle         = document.getElementById('tt-title');
const ttMeta          = document.getElementById('tt-meta');
const ttDirectionTabs = document.getElementById('tt-direction-tabs');
const ttFreqTabs      = document.getElementById('tt-freq-tabs');
const ttGridWrapper   = document.getElementById('tt-grid-wrapper');
const langToggle      = document.getElementById('lang-toggle');

backBtn.href = BACK_URL;

// ---- Local strings ----
const TT_STRINGS = {
  en: {
    title:     'Full Timetable',
    outbound:  'Outbound',
    inbound:   'Inbound',
    stop:      'Stop',
    noData:    'No timetable data available',
    loading:   'Loading timetable…',
  },
  es: {
    title:     'Horario Completo',
    outbound:  'Ida',
    inbound:   'Vuelta',
    stop:      'Parada',
    noData:    'No hay datos de horario disponibles',
    loading:   'Cargando horario…',
  },
};

function ts(key) {
  const lang = getLang();
  return (TT_STRINGS[lang] || TT_STRINGS.en)[key] || TT_STRINGS.en[key] || key;
}

// ---- Language ----
function applyLang() {
  const lang = getLang();
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = lang;
  document.title = `${LINEA_CODE ? LINEA_CODE + ' — ' : ''}${ts('title')}`;
  ttTitle.textContent = LINEA_CODE || ts('title');
  // Rebuild direction tab labels if already rendered
  if (ttData) buildDirectionTabs();
}

// ---- State ----
let availableFreqs = [];  // from the response's own frecuencias list
let activeFreqId   = null;
let activeDir      = 'ida';  // 'ida' or 'vuelta'
let ttData         = null;   // full horarios_lineas response

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
});

applyTheme();
applyLang();

// ---- Init ----
initPage();

async function initPage() {
  try {
    const today = new Date();
    const dia   = today.getDate();
    const mes   = today.getMonth() + 1;

    // Fetch global frequency list, then probe all in parallel to find which
    // have data for this line today (same approach as linetimetable.js)
    const freqData   = await fetchJSON(`${API}/${CONSORCIO_ID}/frecuencias`);
    const globalFreqs = freqData.frecuencias || [];

    const probeResults = await Promise.all(
      globalFreqs.map(async gf => {
        try {
          const d = await fetchJSON(
            `${API}/${CONSORCIO_ID}/horarios_lineas` +
            `?idLinea=${LINEA_ID}&idFrecuencia=${gf.idFreq}&dia=${dia}&mes=${mes}`
          );
          const hasData = (d.planificadores || []).length > 0;
          const freqsInResp = d.frecuencias || [];
          return hasData ? { idFreq: gf.idFreq, gf, freqsInResp } : null;
        } catch { return null; }
      })
    );

    // Build deduped freq list from those that returned data, using response
    // labels when available, falling back to global freq labels
    const seenIds = new Set();
    for (const r of probeResults) {
      if (!r) continue;
      if (r.freqsInResp.length) {
        for (const f of r.freqsInResp) {
          if (!seenIds.has(f.idfrecuencia)) {
            seenIds.add(f.idfrecuencia);
            availableFreqs.push(f); // { idfrecuencia, acronimo, nombre }
          }
        }
      } else {
        // Response had planificadores but no frecuencias list — use global label
        if (!seenIds.has(r.idFreq)) {
          seenIds.add(r.idFreq);
          availableFreqs.push({
            idfrecuencia: r.idFreq,
            acronimo: r.gf.codigo,
            nombre: r.gf.nombre,
          });
        }
      }
    }

    if (!availableFreqs.length) {
      showNoData();
      return;
    }

    // Default to first available frequency
    activeFreqId = availableFreqs[0].idfrecuencia;

    buildFreqTabs();

    // Now load actual timetable
    await loadAndRender();
  } catch (e) {
    showNoData();
  }
}

// ---- Frequency tabs ----
function buildFreqTabs() {
  ttFreqTabs.innerHTML = '';
  availableFreqs.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `tt-freq-tab${f.idfrecuencia === activeFreqId ? ' active' : ''}`;
    btn.textContent = f.nombre || f.acronimo || f.idfrecuencia;
    btn.dataset.freqId = f.idfrecuencia;
    btn.addEventListener('click', async () => {
      if (f.idfrecuencia === activeFreqId) return;
      activeFreqId = f.idfrecuencia;
      ttFreqTabs.querySelectorAll('.tt-freq-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await loadAndRender();
    });
    ttFreqTabs.appendChild(btn);
  });
}

// ---- Direction tabs ----
function buildDirectionTabs() {
  const planificador = (ttData?.planificadores || [])[0];
  if (!planificador) {
    ttDirectionTabs.innerHTML = '';
    return;
  }

  const hasIda    = (planificador.bloquesIda   || []).filter(b => b.tipo !== '1').length > 0;
  const hasVuelta = (planificador.bloquesVuelta || []).filter(b => b.tipo !== '1').length > 0;

  if (!hasIda || !hasVuelta) {
    // Only one direction — no tabs needed
    ttDirectionTabs.innerHTML = '';
    // Force direction to whichever exists
    if (!hasIda && hasVuelta) activeDir = 'vuelta';
    else activeDir = 'ida';
    return;
  }

  ttDirectionTabs.innerHTML = '';
  [
    { dir: 'ida',    label: ts('outbound') },
    { dir: 'vuelta', label: ts('inbound')  },
  ].forEach(({ dir, label }) => {
    const btn = document.createElement('button');
    btn.className = `dir-tab${dir === activeDir ? ' active' : ''}`;
    btn.textContent = label;
    btn.dataset.dir = dir;

    // Add endpoint label as sub-line
    const stops = dir === 'ida'
      ? (planificador.bloquesIda   || []).filter(b => b.tipo !== '1')
      : (planificador.bloquesVuelta || []).filter(b => b.tipo !== '1');
    if (stops.length >= 2) {
      const sub = document.createElement('span');
      sub.className = 'dir-tab-sub';
      sub.textContent = `${stops[0].nombre} → ${stops[stops.length - 1].nombre}`;
      btn.appendChild(sub);
    }

    btn.addEventListener('click', () => {
      if (dir === activeDir) return;
      activeDir = dir;
      ttDirectionTabs.querySelectorAll('.dir-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
    ttDirectionTabs.appendChild(btn);
  });
}

// ---- Load timetable data ----
async function loadAndRender() {
  ttGridWrapper.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const today = new Date();
    const dia   = String(today.getDate()).padStart(2, '0');
    const mes   = String(today.getMonth() + 1).padStart(2, '0');

    ttData = await fetchJSON(
      `${API}/${CONSORCIO_ID}/horarios_lineas?idLinea=${LINEA_ID}&idFrecuencia=${activeFreqId}&dia=${dia}&mes=${mes}`
    );

    buildDirectionTabs();
    renderGrid();
  } catch {
    showNoData();
  }
}

// ---- Render timetable grid ----
function renderGrid() {
  const planificador = (ttData?.planificadores || [])[0];
  if (!planificador) { showNoData(); return; }

  const bloques = (activeDir === 'ida'
    ? planificador.bloquesIda
    : planificador.bloquesVuelta) || [];
  const horario = (activeDir === 'ida'
    ? planificador.horarioIda
    : planificador.horarioVuelta) || [];

  // Filter out the "Frecuencia" label rows (tipo === '1')
  const stopRows = bloques.filter(b => b.tipo !== '1');

  if (!stopRows.length || !horario.length) {
    showNoData();
    return;
  }

  // Build mapping: original index in bloques → display row index
  // We need to know the indices in the original bloques array to address horas
  const stopIndices = [];
  bloques.forEach((b, i) => { if (b.tipo !== '1') stopIndices.push(i); });

  const table = document.createElement('table');
  table.className = 'tt-grid';

  // --- Header: stop-name col + one col per trip ---
  const thead = document.createElement('thead');
  const hRow  = document.createElement('tr');

  const hStop = document.createElement('th');
  hStop.textContent = ts('stop');
  hRow.appendChild(hStop);

  horario.forEach(trip => {
    const th = document.createElement('th');
    // First stop time of the trip as column header
    const firstTime = (trip.horas || []).find(h => h && h !== '--') || '';
    th.textContent = firstTime;
    hRow.appendChild(th);
  });

  thead.appendChild(hRow);
  table.appendChild(thead);

  // --- Body: one row per stop ---
  const tbody = document.createElement('tbody');
  stopIndices.forEach((origIdx, rowNum) => {
    const stop = stopRows[rowNum];
    const tr   = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = stop.nombre;
    tr.appendChild(tdName);

    horario.forEach(trip => {
      const td   = document.createElement('td');
      const time = (trip.horas || [])[origIdx];
      td.textContent = (time && time !== '--') ? time : '';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  ttGridWrapper.innerHTML = '';
  ttGridWrapper.appendChild(table);
}

function showNoData() {
  ttGridWrapper.innerHTML = `<p class="tt-no-data">${ts('noData')}</p>`;
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
