// ===== i18n — shared translations & cookie helpers =====

const TRANSLATIONS = {
  en: {
    appTitle: 'Bus Tracker',
    chooseRegion: 'Choose your region',
    searchPlaceholder: 'Search by stop name or town…',
    backBtn: '← Back',
    stopsHint: n => `${n} stops — start typing to search`,
    noStops: q => `No stops found for "${q}"`,
    noConnection: 'Could not load regions. Check your connection.',
    noStopsLoad: 'Could not load stops.',
    defaultRegionSet: name => `Default region set to ${name}`,
    setDefault: 'Set as default',
    defaultBadge: 'Default',
    // station page
    liveLabel: 'Live',
    refreshIn: s => `Refresh in ${s}s`,
    scanQR: 'Scan for live departures',
    close: 'Close',
    noService: 'No services found today',
    checkBack: 'This stop has no more departures today',
    noServiceLoad: 'Could not load departures. Retrying…',
    scanningServices: 'Searching for upcoming services…',
    zone: z => `Zone ${z}`,
    now: 'Now',
    min: m => m === 1 ? '1 min' : `${m} min`,
    showOnMap: 'Show on map',
    // saved stops
    saveStop:        'Save stop',
    unsaveStop:      'Saved ★',
    savedStops:      'Saved Stops',
    savedStopsEmpty: 'No saved stops yet',
    // route page
    routeStops: 'Stops on this route',
    direction: 'Direction',
    outbound: 'Outbound',
    inbound: 'Inbound',
    tapStop: 'Tap a stop to see live departures',
    noRouteStops: 'Could not load route stops.',
    loadingRoute: 'Loading route…',
    serviceAlerts: 'Service alerts',
    viewOnMap: 'View route on map',
    // timetable page
    fullTimetable: 'Full timetable',
  },
  es: {
    appTitle: 'Rastreador de Autobús',
    chooseRegion: 'Elige tu región',
    searchPlaceholder: 'Busca por nombre de parada o municipio…',
    backBtn: '← Volver',
    stopsHint: n => `${n} paradas — empieza a escribir`,
    noStops: q => `No se encontraron paradas para "${q}"`,
    noConnection: 'No se pudieron cargar las regiones. Comprueba la conexión.',
    noStopsLoad: 'No se pudieron cargar las paradas.',
    defaultRegionSet: name => `Región predeterminada: ${name}`,
    setDefault: 'Predeterminar',
    defaultBadge: 'Predeter.',
    // station page
    liveLabel: 'En vivo',
    refreshIn: s => `Actualizar en ${s}s`,
    scanQR: 'Escanea para ver salidas en vivo',
    close: 'Cerrar',
    noService: 'No hay servicios hoy',
    checkBack: 'Esta parada no tiene más salidas hoy',
    noServiceLoad: 'No se pudieron cargar las salidas. Reintentando…',
    scanningServices: 'Buscando próximos servicios…',
    zone: z => `Zona ${z}`,
    now: 'Ahora',
    min: m => m === 1 ? '1 min' : `${m} min`,
    showOnMap: 'Ver en el mapa',
    // saved stops
    saveStop:        'Guardar parada',
    unsaveStop:      'Guardada ★',
    savedStops:      'Paradas guardadas',
    savedStopsEmpty: 'No hay paradas guardadas',
    // route page
    routeStops: 'Paradas de esta línea',
    direction: 'Dirección',
    outbound: 'Ida',
    inbound: 'Vuelta',
    tapStop: 'Toca una parada para ver salidas en vivo',
    noRouteStops: 'No se pudieron cargar las paradas de la línea.',
    loadingRoute: 'Cargando línea…',
    serviceAlerts: 'Alertas de servicio',
    viewOnMap: 'Ver ruta en el mapa',
    // timetable page
    fullTimetable: 'Horario completo',
  },
};

// ---- Cookie helpers ----
function getCookie(name) {
  const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days = 365) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/`;
}

// ---- Language helpers ----
function getLang() {
  return getCookie('lang') || 'en';
}

function setLang(lang) {
  setCookie('lang', lang);
}

function t(key, ...args) {
  const lang = getLang();
  const val = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['en'][key];
  return typeof val === 'function' ? val(...args) : val;
}

// ---- Default region helpers ----
function getDefaultRegion() {
  const raw = getCookie('defaultRegion');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function setDefaultRegion(consortium) {
  setCookie('defaultRegion', JSON.stringify(consortium));
}
