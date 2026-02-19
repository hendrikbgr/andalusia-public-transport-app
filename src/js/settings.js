// ===== Settings page =====

const SETTINGS_STRINGS = {
  en: {
    title:            'Settings',
    langLabel:        'Language',
    langTitle:        'App language',
    langDesc:         'Choose display language',
    plannerLabel:     'Route Planner',
    dateModeTitle:    'Default date',
    dateModeDesc:     'Which day to search by default',
    segToday:         'Today',
    segTomorrow:      'Tomorrow',
    regionTitle:      'Default region',
    regionNone:       'None set',
    clearRegion:      'Clear',
    stopsLabel:       'Saved Stops',
    stopsEmpty:       'No saved stops',
    clearStops:       'Clear all saved stops',
    aboutLabel:       'About',
    aboutDesc:        'Data from api.ctan.es · 9 Andalusia consortiums',
    cacheTitle:       'Clear app cache',
    cacheDesc:        'Forces latest files to reload',
    cacheClear:       'Clear',
    toastLangSaved:   lang => `Language set to ${lang === 'en' ? 'English' : 'Español'}`,
    toastDateSaved:   mode => `Default date: ${mode === 'today' ? 'Today' : 'Tomorrow'}`,
    toastRegionCleared: 'Default region cleared',
    toastStopsCleared:  'All saved stops cleared',
    toastCacheCleared:  'Cache cleared — reload to apply',
    removeStop:       '✕',
  },
  es: {
    title:            'Ajustes',
    langLabel:        'Idioma',
    langTitle:        'Idioma de la app',
    langDesc:         'Elige el idioma de visualización',
    plannerLabel:     'Planificador de Ruta',
    dateModeTitle:    'Fecha por defecto',
    dateModeDesc:     'Qué día buscar por defecto',
    segToday:         'Hoy',
    segTomorrow:      'Mañana',
    regionTitle:      'Región predeterminada',
    regionNone:       'Sin definir',
    clearRegion:      'Borrar',
    stopsLabel:       'Paradas Guardadas',
    stopsEmpty:       'No hay paradas guardadas',
    clearStops:       'Eliminar todas las paradas guardadas',
    aboutLabel:       'Acerca de',
    aboutDesc:        'Datos de api.ctan.es · 9 consorcios de Andalucía',
    cacheTitle:       'Vaciar caché',
    cacheDesc:        'Fuerza la recarga de los últimos archivos',
    cacheClear:       'Vaciar',
    toastLangSaved:   lang => `Idioma: ${lang === 'en' ? 'English' : 'Español'}`,
    toastDateSaved:   mode => `Fecha por defecto: ${mode === 'today' ? 'Hoy' : 'Mañana'}`,
    toastRegionCleared: 'Región predeterminada eliminada',
    toastStopsCleared:  'Todas las paradas guardadas eliminadas',
    toastCacheCleared:  'Caché vaciada — recarga para aplicar',
    removeStop:       '✕',
  },
};

function ss(key, ...args) {
  const lang = getLang();
  const val = SETTINGS_STRINGS[lang]?.[key] ?? SETTINGS_STRINGS.en[key];
  return typeof val === 'function' ? val(...args) : val;
}

// ---- Saved stops helpers (mirrors station.js) ----
function getSavedStops() {
  try { return JSON.parse(getCookie('savedStops') || '[]'); } catch { return []; }
}
function setSavedStops(arr) {
  setCookie('savedStops', JSON.stringify(arr), 365);
}

// ---- Toast ----
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('settings-toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ---- Render saved stops list ----
function renderSavedStops() {
  const stops = getSavedStops();
  const list = document.getElementById('settings-saved-list');
  const empty = document.getElementById('settings-stops-empty');
  const clearBtn = document.getElementById('clear-stops-btn');

  list.innerHTML = '';
  if (!stops.length) {
    empty.classList.remove('hidden');
    clearBtn.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  clearBtn.classList.remove('hidden');

  stops.forEach(stop => {
    const card = document.createElement('div');
    card.className = 'settings-stop-card';

    const link = document.createElement('a');
    link.className = 'settings-stop-link';
    link.href = `station.html?c=${encodeURIComponent(stop.idConsorcio)}&s=${encodeURIComponent(stop.idParada)}`;

    const body = document.createElement('div');
    body.className = 'settings-stop-body';

    const name = document.createElement('div');
    name.className = 'settings-stop-name';
    name.textContent = stop.nombre || stop.idParada;

    const meta = document.createElement('div');
    meta.className = 'settings-stop-meta';
    meta.textContent = stop.nucleo || stop.municipio || '';

    body.appendChild(name);
    body.appendChild(meta);
    link.appendChild(body);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'settings-stop-remove';
    removeBtn.textContent = ss('removeStop');
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', e => {
      e.preventDefault();
      const updated = getSavedStops().filter(
        s => !(String(s.idConsorcio) === String(stop.idConsorcio) && String(s.idParada) === String(stop.idParada))
      );
      setSavedStops(updated);
      renderSavedStops();
    });

    card.appendChild(link);
    card.appendChild(removeBtn);
    list.appendChild(card);
  });
}

// ---- Apply language to all text ----
function applyLang() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.getElementById('lang-toggle').textContent = lang === 'en' ? 'ES' : 'EN';

  document.getElementById('settings-title').textContent          = ss('title');
  document.getElementById('settings-lang-label').textContent     = ss('langLabel');
  document.getElementById('settings-lang-title').textContent     = ss('langTitle');
  document.getElementById('settings-lang-desc').textContent      = ss('langDesc');
  document.getElementById('settings-planner-label').textContent  = ss('plannerLabel');
  document.getElementById('settings-datemode-title').textContent = ss('dateModeTitle');
  document.getElementById('settings-datemode-desc').textContent  = ss('dateModeDesc');
  document.getElementById('seg-today').textContent               = ss('segToday');
  document.getElementById('seg-tomorrow').textContent            = ss('segTomorrow');
  document.getElementById('settings-region-title').textContent   = ss('regionTitle');
  document.getElementById('settings-stops-label').textContent    = ss('stopsLabel');
  document.getElementById('settings-stops-empty').textContent    = ss('stopsEmpty');
  document.getElementById('settings-clear-stops-text').textContent = ss('clearStops');
  document.getElementById('settings-about-label').textContent    = ss('aboutLabel');
  document.getElementById('settings-about-desc').textContent     = ss('aboutDesc');
  document.getElementById('settings-cache-title').textContent    = ss('cacheTitle');
  document.getElementById('settings-cache-desc').textContent     = ss('cacheDesc');
  document.getElementById('clear-cache-btn').textContent         = ss('cacheClear');
  document.getElementById('clear-region-btn').textContent        = ss('clearRegion');

  // Default region name
  const dr = getDefaultRegion();
  document.getElementById('default-region-name').textContent = dr ? dr.nombre : ss('regionNone');

  // Sync seg buttons
  syncSeg('lang-seg', lang);
  syncSeg('datemode-seg', getCookie('plannerDateMode') || 'today');
}

// ---- Segmented control helper ----
function syncSeg(segId, activeVal) {
  document.querySelectorAll(`#${segId} .settings-seg-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === activeVal);
  });
}

// ---- Lang seg ----
document.getElementById('lang-seg').addEventListener('click', e => {
  const btn = e.target.closest('.settings-seg-btn');
  if (!btn) return;
  const val = btn.dataset.val;
  setLang(val);
  applyLang();
  showToast(ss('toastLangSaved', val));
});

// ---- Date mode seg ----
document.getElementById('datemode-seg').addEventListener('click', e => {
  const btn = e.target.closest('.settings-seg-btn');
  if (!btn) return;
  const val = btn.dataset.val;
  setCookie('plannerDateMode', val, 365);
  syncSeg('datemode-seg', val);
  showToast(ss('toastDateSaved', val));
});

// ---- Clear default region ----
document.getElementById('clear-region-btn').addEventListener('click', () => {
  setCookie('defaultRegion', '', -1);
  document.getElementById('default-region-name').textContent = ss('regionNone');
  showToast(ss('toastRegionCleared'));
});

// ---- Clear all saved stops ----
document.getElementById('clear-stops-btn').addEventListener('click', () => {
  setSavedStops([]);
  renderSavedStops();
  showToast(ss('toastStopsCleared'));
});

// ---- Lang toggle (header button) ----
document.getElementById('lang-toggle').addEventListener('click', () => {
  const newLang = getLang() === 'en' ? 'es' : 'en';
  setLang(newLang);
  applyLang();
  showToast(ss('toastLangSaved', newLang));
});

// ---- Clear cache ----
document.getElementById('clear-cache-btn').addEventListener('click', async () => {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  showToast(ss('toastCacheCleared'));
});

// ---- Init ----
applyLang();
renderSavedStops();
