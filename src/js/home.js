const langToggle = document.getElementById('lang-toggle');
const appTitle = document.getElementById('app-title');
const homeGreeting = document.getElementById('home-greeting');
const featTimetable = document.getElementById('feat-timetable');
const featTimetableDesc = document.getElementById('feat-timetable-desc');
const featPlanner = document.getElementById('feat-planner');
const featPlannerDesc = document.getElementById('feat-planner-desc');
const featMap = document.getElementById('feat-map');
const featMapDesc = document.getElementById('feat-map-desc');

const HOME_STRINGS = {
  en: {
    appTitle: 'Bus Tracker',
    pwaInstallMsg: 'Install for quick access',
    pwaInstall: 'Install',
    pwaDismiss: '✕ Not now',
    greeting: () => {
      const h = new Date().getHours();
      if (h < 12) return 'Good morning';
      if (h < 18) return 'Good afternoon';
      return 'Good evening';
    },
    featTimetable: 'Live Departures',
    featTimetableDesc: 'See real-time buses at any stop',
    featPlanner: 'Route Planner',
    featPlannerDesc: 'Find buses between two towns',
    featMap: 'Stop Map',
    featMapDesc: 'Browse all stops on a map',
  },
  es: {
    appTitle: 'Rastreador de Autobús',
    pwaInstallMsg: 'Instalar para acceso rápido',
    pwaInstall: 'Instalar',
    pwaDismiss: '✕ Ahora no',
    greeting: () => {
      const h = new Date().getHours();
      if (h < 12) return 'Buenos días';
      if (h < 18) return 'Buenas tardes';
      return 'Buenas noches';
    },
    featTimetable: 'Salidas en Vivo',
    featTimetableDesc: 'Ver autobuses en tiempo real en cualquier parada',
    featPlanner: 'Planificador de Ruta',
    featPlannerDesc: 'Encuentra autobuses entre dos localidades',
    featMap: 'Mapa de Paradas',
    featMapDesc: 'Explora todas las paradas en el mapa',
  },
};

function applyLang() {
  const lang = getLang();
  const s = HOME_STRINGS[lang] || HOME_STRINGS.en;
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = lang;
  appTitle.textContent = s.appTitle;
  homeGreeting.textContent = s.greeting();
  featTimetable.textContent = s.featTimetable;
  featTimetableDesc.textContent = s.featTimetableDesc;
  featPlanner.textContent = s.featPlanner;
  featPlannerDesc.textContent = s.featPlannerDesc;
  featMap.textContent = s.featMap;
  featMapDesc.textContent = s.featMapDesc;
  // Update banner text in case it's visible and lang changed
  const s2 = HOME_STRINGS[lang] || HOME_STRINGS.en;
  document.getElementById('pwa-banner-text').textContent = s2.pwaInstallMsg;
  document.getElementById('pwa-install-btn').textContent = s2.pwaInstall;
  document.getElementById('pwa-dismiss-btn').textContent = s2.pwaDismiss;
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
});

applyLang();

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
