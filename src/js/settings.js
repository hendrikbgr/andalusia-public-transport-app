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
    installLabel:         'App',
    installTitle:         'Add to Home Screen',
    installDesc:          'Install the app for quick access',
    installBtnView:       'View',
    installGuideTitle:    'Add to Home Screen',
    installIosIntro:      'Follow these steps in Safari:',
    installIosStep1:      'Open this page in Safari (not Chrome)',
    installIosStep2:      'Tap the Share button (□↑) at the bottom of the screen',
    installIosStep3:      'Scroll down and tap "Add to Home Screen"',
    installIosStep4:      'Tap "Add" in the top-right corner to confirm',
    installIosNote:       'ⓘ Chrome on iOS cannot install apps. You must use Safari.',
    installAndroidIntro:  'Follow these steps in Chrome:',
    installAndroidStep1:  'Tap the menu (⋮) in the top-right corner',
    installAndroidStep2:  'Tap "Add to Home screen"',
    installAndroidStep3:  'Tap "Add" to confirm',
    installOtherIntro:    'On desktop, look for the install icon (⊕) in your browser\'s address bar, or open the browser menu and choose "Install app".',
    appearanceLabel:  'Appearance',
    themeTitle:       'Theme',
    themeDesc:        'Choose display theme',
    segLight:         'Light',
    segSystem:        'Auto',
    segDark:          'Dark',
    toastTheme:       mode => `Theme: ${mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Auto'}`,
    ossLabel:             'Open Source',
    ossTitle:             'CTAN Bus Tracker',
    ossDesc:              'Free and open source — built for the community',
    ossText:              'This app is free, open source, and has no ads or tracking. It was built to make Andalusia\'s public transport more accessible to everyone — locals and visitors alike.',
    githubTitle:          'View on GitHub',
    githubDesc:           'Star the repo, report issues, or contribute',
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
    installLabel:         'App',
    installTitle:         'Añadir a pantalla de inicio',
    installDesc:          'Instala la app para acceso rápido',
    installBtnView:       'Ver',
    installGuideTitle:    'Añadir a pantalla de inicio',
    installIosIntro:      'Sigue estos pasos en Safari:',
    installIosStep1:      'Abre esta página en Safari (no en Chrome)',
    installIosStep2:      'Pulsa el botón Compartir (□↑) en la parte inferior de la pantalla',
    installIosStep3:      'Desplázate hacia abajo y pulsa "Añadir a pantalla de inicio"',
    installIosStep4:      'Pulsa "Añadir" en la esquina superior derecha para confirmar',
    installIosNote:       'ⓘ Chrome en iOS no puede instalar apps. Debes usar Safari.',
    installAndroidIntro:  'Sigue estos pasos en Chrome:',
    installAndroidStep1:  'Pulsa el menú (⋮) en la esquina superior derecha',
    installAndroidStep2:  'Pulsa "Añadir a pantalla de inicio"',
    installAndroidStep3:  'Pulsa "Añadir" para confirmar',
    installOtherIntro:    'En escritorio, busca el icono de instalación (⊕) en la barra de direcciones del navegador, o abre el menú del navegador y elige "Instalar app".',
    appearanceLabel:  'Apariencia',
    themeTitle:       'Tema',
    themeDesc:        'Elige el tema de visualización',
    segLight:         'Claro',
    segSystem:        'Auto',
    segDark:          'Oscuro',
    toastTheme:       mode => `Tema: ${mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Auto'}`,
    ossLabel:             'Código Abierto',
    ossTitle:             'CTAN Bus Tracker',
    ossDesc:              'Gratuita y de código abierto — hecha para la comunidad',
    ossText:              'Esta app es gratuita, de código abierto y no tiene anuncios ni rastreo. Fue creada para hacer el transporte público de Andalucía más accesible para todos — locales y visitantes.',
    githubTitle:          'Ver en GitHub',
    githubDesc:           'Dale una estrella, reporta problemas o contribuye',
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

  // Install guide
  document.getElementById('settings-install-label').textContent  = ss('installLabel');
  document.getElementById('settings-install-title').textContent  = ss('installTitle');
  document.getElementById('settings-install-desc').textContent   = ss('installDesc');
  document.getElementById('open-install-guide-btn').textContent  = ss('installBtnView');
  document.getElementById('install-guide-title').textContent     = ss('installGuideTitle');

  // Open source
  document.getElementById('settings-oss-label').textContent   = ss('ossLabel');
  document.getElementById('settings-oss-title').textContent   = ss('ossTitle');
  document.getElementById('settings-oss-desc').textContent    = ss('ossDesc');
  document.getElementById('settings-oss-text').textContent    = ss('ossText');
  document.getElementById('settings-github-title').textContent = ss('githubTitle');
  document.getElementById('settings-github-desc').textContent  = ss('githubDesc');

  // Appearance
  document.getElementById('settings-appearance-label').textContent = ss('appearanceLabel');
  document.getElementById('settings-theme-title').textContent      = ss('themeTitle');
  document.getElementById('settings-theme-desc').textContent       = ss('themeDesc');
  document.getElementById('seg-light').textContent                 = ss('segLight');
  document.getElementById('seg-system').textContent                = ss('segSystem');
  document.getElementById('seg-dark').textContent                  = ss('segDark');

  // Sync seg buttons
  syncSeg('lang-seg', lang);
  syncSeg('datemode-seg', getCookie('plannerDateMode') || 'today');
  syncSeg('theme-seg', getTheme());
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

// ---- Theme seg ----
document.getElementById('theme-seg').addEventListener('click', e => {
  const btn = e.target.closest('.settings-seg-btn');
  if (!btn) return;
  const val = btn.dataset.val;
  setTheme(val);
  applyTheme(val);
  syncSeg('theme-seg', val);
  showToast(ss('toastTheme', val));
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

// ---- Install guide ----
function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !/Windows Phone/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function renderInstallGuide() {
  const body = document.getElementById('install-guide-body');
  const platform = detectPlatform();
  body.innerHTML = '';

  if (platform === 'ios') {
    const steps = [
      { icon: '🌐', text: ss('installIosStep1') },
      { icon: '📤', text: ss('installIosStep2') },
      { icon: '➕', text: ss('installIosStep3') },
      { icon: '✅', text: ss('installIosStep4') },
    ];

    const intro = document.createElement('p');
    intro.className = 'install-guide-intro';
    intro.textContent = ss('installIosIntro');
    body.appendChild(intro);

    const list = document.createElement('ul');
    list.className = 'install-guide-steps';
    steps.forEach(s => {
      const li = document.createElement('li');
      li.className = 'install-guide-step';
      li.innerHTML = `<span class="install-guide-step-icon">${s.icon}</span><span class="install-guide-step-text">${s.text}</span>`;
      list.appendChild(li);
    });
    body.appendChild(list);

    const note = document.createElement('div');
    note.className = 'install-guide-note';
    note.textContent = ss('installIosNote');
    body.appendChild(note);

  } else if (platform === 'android') {
    const steps = [
      { icon: '⋮', text: ss('installAndroidStep1') },
      { icon: '➕', text: ss('installAndroidStep2') },
      { icon: '✅', text: ss('installAndroidStep3') },
    ];

    const intro = document.createElement('p');
    intro.className = 'install-guide-intro';
    intro.textContent = ss('installAndroidIntro');
    body.appendChild(intro);

    const list = document.createElement('ul');
    list.className = 'install-guide-steps';
    steps.forEach(s => {
      const li = document.createElement('li');
      li.className = 'install-guide-step';
      li.innerHTML = `<span class="install-guide-step-icon">${s.icon}</span><span class="install-guide-step-text">${s.text}</span>`;
      list.appendChild(li);
    });
    body.appendChild(list);

  } else {
    const intro = document.createElement('p');
    intro.className = 'install-guide-intro';
    intro.textContent = ss('installOtherIntro');
    body.appendChild(intro);
  }
}

function closeInstallGuide() {
  document.getElementById('install-guide-overlay').classList.add('hidden');
}

document.getElementById('open-install-guide-btn').addEventListener('click', () => {
  renderInstallGuide();
  document.getElementById('install-guide-overlay').classList.remove('hidden');
});

document.getElementById('install-guide-close').addEventListener('click', closeInstallGuide);

document.getElementById('install-guide-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeInstallGuide();
});

// ---- Init ----
applyTheme();
applyLang();
renderSavedStops();
