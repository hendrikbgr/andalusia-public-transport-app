const langToggle      = document.getElementById('lang-toggle');
const appTitle        = document.getElementById('app-title');
const homeGreeting    = document.getElementById('home-greeting');
const featTimetable   = document.getElementById('feat-timetable');
const featTimetableDesc = document.getElementById('feat-timetable-desc');
const featLineTimetable     = document.getElementById('feat-linetimetable');
const featLineTimetableDesc = document.getElementById('feat-linetimetable-desc');
const featPlanner     = document.getElementById('feat-planner');
const featPlannerDesc = document.getElementById('feat-planner-desc');
const featJourney     = document.getElementById('feat-journey');
const featJourneyDesc = document.getElementById('feat-journey-desc');
const featMap         = document.getElementById('feat-map');
const featMapDesc     = document.getElementById('feat-map-desc');

const HOME_STRINGS = {
  en: {
    appTitle: 'Bus Tracker',
    pwaInstallMsg: 'Install for quick access',
    pwaInstall: 'Install',
    pwaDismiss: '✕ Not now',
    updateMsg: '🎉 Update available',
    updateReload: 'Reload',
    updateDismiss: '✕',
    greeting: () => {
      const h = new Date().getHours();
      if (h < 12) return 'Good morning';
      if (h < 18) return 'Good afternoon';
      return 'Good evening';
    },
    featTimetable:          'Live Departures',
    featTimetableDesc:      'See real-time buses at any stop',
    featLineTimetable:      'Line Timetables',
    featLineTimetableDesc:  'Search full schedules by line',
    featPlanner:            'Route Planner',
    featPlannerDesc:        'Find buses between two towns',
    featJourney:            'Journey Planner',
    featJourneyDesc:        'Find routes with transfers',
    featMap:                'Stop Map',
    featMapDesc:            'Browse all stops on a map',
    savedStopsLabel:        'Saved Stops',
    featuresLabel:          'Features',
  },
  es: {
    appTitle: 'Rastreador de Autobús',
    pwaInstallMsg: 'Instalar para acceso rápido',
    pwaInstall: 'Instalar',
    pwaDismiss: '✕ Ahora no',
    updateMsg: '🎉 Actualización disponible',
    updateReload: 'Recargar',
    updateDismiss: '✕',
    greeting: () => {
      const h = new Date().getHours();
      if (h < 12) return 'Buenos días';
      if (h < 18) return 'Buenas tardes';
      return 'Buenas noches';
    },
    featTimetable:          'Salidas en Vivo',
    featTimetableDesc:      'Ver autobuses en tiempo real en cualquier parada',
    featLineTimetable:      'Horarios de Líneas',
    featLineTimetableDesc:  'Busca horarios completos por línea',
    featPlanner:            'Planificador de Ruta',
    featPlannerDesc:        'Encuentra autobuses entre dos localidades',
    featJourney:            'Planificador de Viaje',
    featJourneyDesc:        'Encuentra rutas con transbordos',
    featMap:                'Mapa de Paradas',
    featMapDesc:            'Explora todas las paradas en el mapa',
    savedStopsLabel:        'Paradas Guardadas',
    featuresLabel:          'Funciones',
  },
};

function applyLang() {
  const lang = getLang();
  const s = HOME_STRINGS[lang] || HOME_STRINGS.en;
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = lang;
  appTitle.textContent              = s.appTitle;
  homeGreeting.textContent          = s.greeting();
  featTimetable.textContent         = s.featTimetable;
  featTimetableDesc.textContent     = s.featTimetableDesc;
  featLineTimetable.textContent     = s.featLineTimetable;
  featLineTimetableDesc.textContent = s.featLineTimetableDesc;
  featPlanner.textContent           = s.featPlanner;
  featPlannerDesc.textContent       = s.featPlannerDesc;
  featJourney.textContent           = s.featJourney;
  featJourneyDesc.textContent       = s.featJourneyDesc;
  featMap.textContent               = s.featMap;
  featMapDesc.textContent           = s.featMapDesc;
  document.getElementById('saved-stops-label').textContent    = s.savedStopsLabel;
  document.getElementById('home-features-label').textContent  = s.featuresLabel;
  // Update banner text in case it's visible and lang changed
  document.getElementById('pwa-banner-text').textContent  = s.pwaInstallMsg;
  document.getElementById('pwa-install-btn').textContent  = s.pwaInstall;
  document.getElementById('pwa-dismiss-btn').textContent  = s.pwaDismiss;
  document.getElementById('update-banner-text').textContent  = s.updateMsg;
  document.getElementById('update-reload-btn').textContent   = s.updateReload;
  document.getElementById('update-dismiss-btn').textContent  = s.updateDismiss;
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
});

applyLang();

// ---- Saved stops ----
function getSavedStops() {
  try { return JSON.parse(getCookie('savedStops') || '[]'); } catch { return []; }
}

function renderSavedStops() {
  const stops = getSavedStops();
  const section = document.getElementById('saved-stops-section');
  const list    = document.getElementById('saved-stops-list');

  if (!stops.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = '';

  stops.forEach(stop => {
    const card = document.createElement('a');
    card.className = 'saved-stop-card';
    card.href = `station.html?c=${encodeURIComponent(stop.idConsorcio)}&s=${encodeURIComponent(stop.idParada)}`;
    card.innerHTML = `
      <div class="saved-stop-card-body">
        <div class="saved-stop-card-name">${escHtml(stop.nombre || stop.idParada)}</div>
        <div class="saved-stop-card-meta">${escHtml(stop.nucleo || stop.municipio || '')}</div>
      </div>
      <span class="card-arrow">›</span>
    `;
    list.appendChild(card);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

renderSavedStops();

// ---- PWA Install Banner ----
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
    document.getElementById('pwa-banner').classList.remove('hidden');
  });
}

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

initPWABanner();

// ---- SW Update Banner ----
// Detects a waiting service worker and shows a one-tap reload banner.
// Registers the SW here (instead of an inline script) so we can hook
// updatefound from the very first registration — critical on iOS Safari
// where navigator.serviceWorker.ready can resolve before reg.waiting is set.
function initUpdateBanner() {
  if (!('serviceWorker' in navigator)) return;

  const banner     = document.getElementById('update-banner');
  const reloadBtn  = document.getElementById('update-reload-btn');
  const dismissBtn = document.getElementById('update-dismiss-btn');
  let waitingSW    = null;

  function showUpdateBanner(sw) {
    waitingSW = sw;
    banner.classList.remove('hidden');
  }

  function watchReg(reg) {
    // Already waiting (e.g. page was refreshed while a new SW was queued)
    if (reg.waiting) {
      showUpdateBanner(reg.waiting);
      return;
    }

    // New SW starts installing while page is open
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        // 'installed' + existing controller = new version ready, old still running
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(newSW);
        }
      });
    });
  }

  // Register SW ourselves so we can call watchReg immediately on the
  // registration object — before ready resolves — catching iOS edge cases.
  navigator.serviceWorker.register('./sw.js').then(reg => {
    watchReg(reg);
    // Force a network check for a new SW on every page load
    reg.update();
  });

  // Reload: tell waiting SW to activate now, then reload on controllerchange
  reloadBtn.addEventListener('click', () => {
    if (waitingSW) waitingSW.postMessage('skipWaiting');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      sessionStorage.setItem('showUpdateConfetti', '1');
      location.reload();
    });
  });

  // Dismiss: hide banner; update applies silently on next cold launch
  dismissBtn.addEventListener('click', () => banner.classList.add('hidden'));
}

initUpdateBanner();

// ---- Update confetti ----
function launchConfetti() {
  const COUNT   = 120;
  const COLORS  = ['#1a6fdb','#f0c040','#e05c5c','#4caf7d','#9c6fdb','#f07840'];
  const canvas  = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);

  const W = canvas.width  = canvas.offsetWidth;
  const H = canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');

  const pieces = Array.from({ length: COUNT }, () => ({
    x:  Math.random() * W,
    y:  Math.random() * -H,
    w:  6 + Math.random() * 6,
    h:  10 + Math.random() * 6,
    r:  Math.random() * Math.PI * 2,
    dr: (Math.random() - 0.5) * 0.2,
    dx: (Math.random() - 0.5) * 2,
    dy: 3 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  let frame;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    pieces.forEach(p => {
      if (p.y < H + 20) alive = true;
      p.x += p.dx; p.y += p.dy; p.r += p.dr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive) { frame = requestAnimationFrame(draw); }
    else        { canvas.remove(); }
  }
  draw();
  setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 4000);
}

if (sessionStorage.getItem('showUpdateConfetti') === '1') {
  sessionStorage.removeItem('showUpdateConfetti');
  // Small delay so the page has painted first
  setTimeout(launchConfetti, 200);
}
