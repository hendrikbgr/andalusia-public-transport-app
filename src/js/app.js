const API = 'https://api.ctan.es/v1/Consorcios';

const CONSORTIUM_ICONS = {
  '1': '🌻', // Sevilla
  '2': '⚓', // Cádiz
  '3': '🏛️', // Granada
  '4': '☀️', // Málaga
  '5': '🪨', // Campo de Gibraltar
  '6': '🎸', // Almería
  '7': '🫒', // Jaén
  '8': '🕌', // Córdoba
  '9': '🌊', // Huelva
};

// ---- Saved stops helpers (shared cookie format with station.js) ----
function getSavedStops() {
  try { return JSON.parse(getCookie('savedStops') || '[]'); } catch { return []; }
}
function removeSavedStop(idConsorcio, idParada) {
  const arr = getSavedStops().filter(
    s => !(String(s.idConsorcio) === String(idConsorcio) && String(s.idParada) === String(idParada))
  );
  setCookie('savedStops', JSON.stringify(arr), 365);
}
function renderSavedStops() {
  const section = document.getElementById('saved-stops-section');
  const list    = document.getElementById('saved-stops-list');
  const heading = document.getElementById('saved-stops-heading');
  const stops   = getSavedStops();

  heading.textContent = t('savedStops');

  if (!stops.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = '';

  stops.forEach(stop => {
    const card = document.createElement('a');
    card.className = 'card saved-stop-card';
    card.href = `station.html?c=${stop.idConsorcio}&s=${stop.idParada}&from=${encodeURIComponent('stops.html')}`;
    card.innerHTML = `
      <div class="card-icon">📍</div>
      <div class="saved-stop-card-body">
        <div class="saved-stop-card-name">${escHtml(stop.nombre)}</div>
        ${(stop.nucleo || stop.municipio) ? `<div class="saved-stop-card-meta">${escHtml([stop.nucleo, stop.municipio].filter(Boolean).join(' · '))}</div>` : ''}
      </div>
      <button class="saved-stop-remove-btn" title="Remove" aria-label="Remove ${escHtml(stop.nombre)}">✕</button>
      <span class="card-arrow">›</span>
    `;
    card.querySelector('.saved-stop-remove-btn').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      removeSavedStop(stop.idConsorcio, stop.idParada);
      renderSavedStops();
    });
    list.appendChild(card);
  });
}

// ---- State ----
let currentConsorcio = null;
let allStops = [];
let searchTimeout = null;

// ---- Elements ----
const stepConsortium = document.getElementById('step-consortium');
const stepStop = document.getElementById('step-stop');
const consortiumList = document.getElementById('consortium-list');
const stopList = document.getElementById('stop-list');
const stopSearch = document.getElementById('stop-search');
const consortiumTitle = document.getElementById('consortium-title');
const backToConsortium = document.getElementById('back-to-consortium');
const langToggle = document.getElementById('lang-toggle');
const appTitle = document.getElementById('app-title');
const labelChooseRegion = document.getElementById('label-choose-region');

// ---- Language toggle ----
function applyLang() {
  const lang = getLang();
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  langToggle.title = lang === 'en' ? 'Cambiar a español' : 'Switch to English';
  document.documentElement.lang = lang;
  appTitle.textContent = t('appTitle');
  labelChooseRegion.textContent = t('chooseRegion');
  backToConsortium.textContent = t('backBtn');
  stopSearch.placeholder = t('searchPlaceholder');
  if (currentConsorcio) consortiumTitle.textContent = currentConsorcio.nombre;
  if (allStops.length) {
    renderStopResults();
  }
  renderSavedStops();
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
  // Re-render consortium list to update "Set as default" / badge labels
  if (stepConsortium.classList.contains('active')) {
    loadConsortiums();
  }
});

// ---- Init ----
applyTheme();
applyLang();
renderSavedStops();
loadConsortiums();

async function loadConsortiums() {
  consortiumList.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await fetchJSON(`${API}/consorcios`);
    const defaultRegion = getDefaultRegion();
    consortiumList.innerHTML = '';

    // Put default region first if set
    const sorted = defaultRegion
      ? [
          ...data.consorcios.filter(c => c.idConsorcio === defaultRegion.idConsorcio),
          ...data.consorcios.filter(c => c.idConsorcio !== defaultRegion.idConsorcio),
        ]
      : data.consorcios;

    sorted.forEach(c => {
      const isDefault = defaultRegion && c.idConsorcio === defaultRegion.idConsorcio;
      const card = createConsortiumCard(c, isDefault);
      consortiumList.appendChild(card);
    });

    // If a default is set, jump straight to its stop list
    if (defaultRegion) {
      const match = data.consorcios.find(c => c.idConsorcio === defaultRegion.idConsorcio);
      if (match) selectConsortium(match);
    }
  } catch (e) {
    consortiumList.innerHTML = `<p class="hint">${t('noConnection')}</p>`;
  }
}

function createConsortiumCard(c, isDefault) {
  const el = document.createElement('div');
  el.className = 'card consortium-card';

  const badgeHtml = isDefault
    ? `<span class="default-badge">${t('defaultBadge')}</span>`
    : '';

  el.innerHTML = `
    <div class="card-icon">${CONSORTIUM_ICONS[c.idConsorcio] || '🚌'}</div>
    <div class="card-body">
      <div class="card-title">${escHtml(c.nombre)} ${badgeHtml}</div>
      <div class="card-sub">${escHtml(c.nombreCorto)}</div>
    </div>
    <button class="set-default-btn" data-id="${escHtml(c.idConsorcio)}" title="${t('setDefault')}">
      ${isDefault ? '★' : '☆'}
    </button>
    <span class="card-arrow">›</span>
  `;

  // Click on the main card area → select consortium
  el.addEventListener('click', e => {
    if (!e.target.closest('.set-default-btn')) {
      selectConsortium(c);
    }
  });

  // Click on star → set default (stop propagation so it doesn't also navigate)
  el.querySelector('.set-default-btn').addEventListener('click', e => {
    e.stopPropagation();
    setDefaultRegion(c);
    loadConsortiums(); // re-render with new default
  });

  return el;
}

async function selectConsortium(c) {
  currentConsorcio = c;
  consortiumTitle.textContent = c.nombre;
  allStops = [];

  showStep(stepStop);
  stopList.innerHTML = '<div class="loading-spinner"></div>';
  stopSearch.value = '';
  stopSearch.focus();

  try {
    const data = await fetchJSON(`${API}/${c.idConsorcio}/paradas/`);
    allStops = data.paradas || [];
    stopList.innerHTML = `<p class="hint">${t('stopsHint', allStops.length)}</p>`;
  } catch (e) {
    stopList.innerHTML = `<p class="hint">${t('noStopsLoad')}</p>`;
  }
}

// ---- Search ----
stopSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(renderStopResults, 180);
});

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderStopResults() {
  const q = normalize(stopSearch.value.trim());
  if (!q) {
    stopList.innerHTML = `<p class="hint">${t('stopsHint', allStops.length)}</p>`;
    return;
  }

  const matches = allStops
    .filter(s =>
      normalize(s.nombre).includes(q) ||
      (s.municipio && normalize(s.municipio).includes(q)) ||
      (s.nucleo && normalize(s.nucleo).includes(q))
    )
    .slice(0, 30);

  if (!matches.length) {
    stopList.innerHTML = `<p class="hint">${t('noStops', stopSearch.value)}</p>`;
    return;
  }

  stopList.innerHTML = '';
  matches.forEach(s => {
    const card = createCard({
      icon: '📍',
      title: s.nombre,
      sub: [s.nucleo, s.municipio].filter(Boolean).join(' · '),
      onClick: () => goToStation(s),
    });
    stopList.appendChild(card);
  });
}

function goToStation(stop) {
  window.location.href = `station.html?c=${currentConsorcio.idConsorcio}&s=${stop.idParada}`;
}

// ---- Navigation ----
backToConsortium.addEventListener('click', () => {
  showStep(stepConsortium);
});

function showStep(step) {
  document.querySelectorAll('.step').forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');
  });
  step.classList.remove('hidden');
  step.classList.add('active');
}

// ---- Helpers ----
function createCard({ icon, title, sub, onClick }) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <div class="card-icon">${icon}</div>
    <div class="card-body">
      <div class="card-title">${escHtml(title)}</div>
      ${sub ? `<div class="card-sub">${escHtml(sub)}</div>` : ''}
    </div>
    <span class="card-arrow">›</span>
  `;
  el.addEventListener('click', onClick);
  return el;
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
