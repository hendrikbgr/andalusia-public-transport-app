const API = 'https://api.ctan.es/v1/Consorcios';

const CONSORTIUM_ICONS = {
  '1': '🌻', '2': '⚓', '3': '🏛️', '4': '☀️',
  '5': '🪨', '6': '🎸', '7': '🫒', '8': '🕌', '9': '🌊',
};

const MAP_STRINGS = {
  en: {
    title: 'Stop Map',
    overlayTitle: 'Select a region',
    loading: 'Loading stops…',
    viewDepartures: 'View departures',
    changeRegion: 'Change region',
    noCoords: 'No stops with location data',
    locationUnavailable: 'Location unavailable',
    showAllStops: 'Show all stops',
    showRouteStops: 'Route stops only',
  },
  es: {
    title: 'Mapa de Paradas',
    overlayTitle: 'Selecciona una región',
    loading: 'Cargando paradas…',
    viewDepartures: 'Ver salidas',
    changeRegion: 'Cambiar región',
    noCoords: 'Sin paradas con datos de ubicación',
    locationUnavailable: 'Ubicación no disponible',
    showAllStops: 'Mostrar todas las paradas',
    showRouteStops: 'Solo paradas de la línea',
  },
};

function ms(key) {
  const lang = getLang();
  return (MAP_STRINGS[lang] || MAP_STRINGS.en)[key] || MAP_STRINGS.en[key];
}

// ---- Elements ----
const langToggle = document.getElementById('lang-toggle');
const mapTitle = document.getElementById('map-title');
const overlayTitle = document.getElementById('overlay-title');
const overlayRegionList = document.getElementById('overlay-region-list');
const regionOverlay = document.getElementById('region-overlay');
const mapContainer = document.getElementById('map-container');
const regionBtn = document.getElementById('region-btn');
const regionPillName = document.getElementById('region-pill-name');
const mapLoading = document.getElementById('map-loading');
const allStopsToggle = document.getElementById('all-stops-toggle');
const allStopsToggleLabel = document.getElementById('all-stops-toggle-label');
const locateBtn = document.getElementById('locate-btn');

// ---- State ----
let leafletMap = null;
let markersLayer = null;       // route stops (or all stops when not in polyline mode)
let allMarkersLayer = null;    // off-route stops, hidden by default in polyline mode
let showingAllStops = false;   // toggle state
let currentConsorcio = null;
let userLocationMarker = null;
let locationWatchId = null;
let polylineLayer = null;

// ---- Lang ----
function applyLang() {
  const lang = getLang();
  langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
  document.documentElement.lang = lang;
  mapTitle.textContent = ms('title');
  overlayTitle.textContent = ms('overlayTitle');
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'en' ? 'es' : 'en');
  applyLang();
  // Reload overlay list if it's currently visible (region names stay the same
  // but the "Change region" button label and any translatable overlay text update)
  if (!regionOverlay.classList.contains('hidden')) {
    loadRegionOverlay();
  }
  // Re-render markers so popup "View departures" button text switches language
  if (currentConsorcio) {
    showMap(currentConsorcio).then(() => { if (storedPoly) drawRoutePolyline(storedPoly); });
  }
});

// ---- Init ----
applyLang();

// If arriving from station page with ?c=&s= params, jump straight to that stop
// If arriving from route page with ?polyline=1, draw stored route polyline
const mapParams = new URLSearchParams(location.search);
const focusConsorcioId = mapParams.get('c');
const focusStopId = mapParams.get('s');
const hasPolyline = mapParams.get('polyline') === '1';

function tryParsePolyline() {
  try { return JSON.parse(sessionStorage.getItem('routePolyline') || 'null'); } catch { return null; }
}
const storedPoly = hasPolyline ? tryParsePolyline() : null;

if (focusConsorcioId) {
  initMap();
  // Fetch consortium info to get its name, then show the map focused on the stop
  fetchJSON(`${API}/consorcios`)
    .then(data => {
      const c = data.consorcios.find(x => String(x.idConsorcio) === String(focusConsorcioId));
      if (c) showMap(c, focusStopId).then(() => { if (storedPoly) drawRoutePolyline(storedPoly); });
      else loadRegionOverlay();
    })
    .catch(() => loadRegionOverlay());
} else {
  // Auto-select default region if set
  const defaultRegion = getDefaultRegion();
  if (defaultRegion) {
    initMap();
    showMap(defaultRegion).then(() => { if (storedPoly) drawRoutePolyline(storedPoly); });
  } else {
    loadRegionOverlay();
  }
}

// ---- Region overlay ----
async function loadRegionOverlay() {
  overlayRegionList.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await fetchJSON(`${API}/consorcios`);
    overlayRegionList.innerHTML = '';
    data.consorcios.forEach(c => {
      const item = document.createElement('div');
      item.className = 'map-overlay-item';
      item.innerHTML = `
        <span class="map-overlay-icon">${CONSORTIUM_ICONS[c.idConsorcio] || '🚌'}</span>
        <span class="map-overlay-name">${escHtml(c.nombre)}</span>
        <span class="map-overlay-arrow">›</span>
      `;
      item.addEventListener('click', () => {
        initMap();
        showMap(c);
      });
      overlayRegionList.appendChild(item);
    });
  } catch {
    overlayRegionList.innerHTML = '<p class="hint">Could not load regions.</p>';
  }
}

// ---- Map init (only once) ----
function initMap() {
  if (leafletMap) return;

  // Ensure container is visible before Leaflet measures it
  mapContainer.classList.remove('hidden');

  leafletMap = L.map('leaflet-map', {
    zoomControl: false,
    attributionControl: false,
  }).setView([37.0, -4.5], 9);

  // Clean, muted tile style
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(leafletMap);

  // Zoom control bottom-right
  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

  markersLayer = L.layerGroup().addTo(leafletMap);

  startLocationWatch();
}

// ---- User location dot ----
let lastUserLatLng = null;

function startLocationWatch() {
  if (!navigator.geolocation) return;

  // Higher z-index pane so the dot renders above stop markers
  if (!leafletMap.getPane('userPane')) {
    leafletMap.createPane('userPane');
    leafletMap.getPane('userPane').style.zIndex = 650;
  }

  locationWatchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      lastUserLatLng = [lat, lng];
      if (!userLocationMarker) {
        const icon = L.divIcon({
          className: '',
          html: '<div class="map-user-dot"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        userLocationMarker = L.marker([lat, lng], {
          icon,
          pane: 'userPane',
          interactive: false,
        }).addTo(leafletMap);
        // Only pan on the very first fix, and only if no stop is already focused
        if (!focusStopId) leafletMap.setView([lat, lng], 13);
        // Reveal the locate button now that we have a position
        locateBtn.classList.remove('hidden');
      } else {
        userLocationMarker.setLatLng([lat, lng]);
      }
    },
    err => {
      if (err.code === err.PERMISSION_DENIED) {
        showLocationToast(ms('locationUnavailable'));
      }
      // timeout / unavailable: fail silently
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

// Locate-me button: pan to user's last known position
locateBtn.addEventListener('click', () => {
  if (lastUserLatLng) {
    leafletMap.setView(lastUserLatLng, Math.max(leafletMap.getZoom(), 15), { animate: true });
  }
});

function showLocationToast(msg) {
  const toast = document.getElementById('location-toast');
  const toastText = document.getElementById('location-toast-text');
  toastText.textContent = msg;
  toast.classList.remove('hidden', 'fading');
  setTimeout(() => {
    toast.classList.add('fading');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 4000);
}

// Pause watch when tab is hidden, resume when visible
document.addEventListener('visibilitychange', () => {
  if (!leafletMap) return;
  if (document.hidden && locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  } else if (!document.hidden && locationWatchId === null) {
    startLocationWatch();
  }
});

// ---- Show map for a region ----
// routeStopIds: optional Set of idParada strings — when provided, only those stops
// go into markersLayer; others go into allMarkersLayer (hidden until toggled).
async function showMap(consorcio, focusStopId, routeStopIds) {
  currentConsorcio = consorcio;
  regionPillName.textContent = consorcio.nombre;

  regionOverlay.classList.add('hidden');
  mapLoading.classList.remove('hidden');
  requestAnimationFrame(() => leafletMap.invalidateSize());

  try {
    const data = await fetchJSON(`${API}/${consorcio.idConsorcio}/paradas/`);
    const stops = (data.paradas || []).filter(s =>
      s.latitud && s.longitud &&
      parseFloat(s.latitud) !== 0 && parseFloat(s.longitud) !== 0
    );

    markersLayer.clearLayers();
    if (allMarkersLayer) { allMarkersLayer.clearLayers(); }

    if (!stops.length) {
      mapLoading.classList.add('hidden');
      return;
    }

    const stopIcon = L.divIcon({
      className: '',
      html: `<div class="map-stop-dot"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -10],
    });

    const dimIcon = L.divIcon({
      className: '',
      html: `<div class="map-stop-dot map-stop-dot-dim"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
      popupAnchor: [0, -8],
    });

    const focusIcon = L.divIcon({
      className: '',
      html: `<div class="map-stop-dot map-stop-dot-focus"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -13],
    });

    const bounds = [];
    let focusMarker = null;

    stops.forEach(stop => {
      const lat = parseFloat(stop.latitud);
      const lng = parseFloat(stop.longitud);
      if (isNaN(lat) || isNaN(lng)) return;

      const isFocus = focusStopId && String(stop.idParada) === String(focusStopId);
      const isRouteStop = !routeStopIds || routeStopIds.has(String(stop.idParada));

      const popupContent = `
        <div class="map-popup">
          <div class="map-popup-name">${escHtml(stop.nombre)}</div>
          <div class="map-popup-meta">${escHtml([stop.nucleo, stop.municipio].filter(Boolean).join(' · '))}</div>
          <a class="map-popup-btn" href="station.html?c=${consorcio.idConsorcio}&s=${stop.idParada}&from=${encodeURIComponent('map.html')}">
            ${ms('viewDepartures')} →
          </a>
        </div>
      `;

      if (isRouteStop) {
        bounds.push([lat, lng]);
        const marker = L.marker([lat, lng], { icon: isFocus ? focusIcon : stopIcon });
        marker.bindPopup(popupContent, { closeButton: false, className: 'map-leaflet-popup', maxWidth: 220 });
        markersLayer.addLayer(marker);
        if (isFocus) focusMarker = marker;
      } else {
        // Off-route stop: add to allMarkersLayer with dimmed icon
        if (!allMarkersLayer) allMarkersLayer = L.layerGroup();
        const marker = L.marker([lat, lng], { icon: dimIcon });
        marker.bindPopup(popupContent, { closeButton: false, className: 'map-leaflet-popup', maxWidth: 220 });
        allMarkersLayer.addLayer(marker);
      }
    });

    leafletMap.invalidateSize();

    if (focusMarker) {
      leafletMap.setView(focusMarker.getLatLng(), 15);
      focusMarker.openPopup();
    } else if (bounds.length) {
      leafletMap.fitBounds(bounds, { padding: [40, 40] });
    }

    mapLoading.classList.add('hidden');

  } catch {
    mapLoading.classList.add('hidden');
  }
}

// ---- Route polyline ----
async function drawRoutePolyline(polyData) {
  if (!leafletMap || !polyData?.length) return;
  if (polylineLayer) { polylineLayer.remove(); polylineLayer = null; }

  // The API returns polyline points as arrays: ["lat,lng,z"] or objects {latitud, longitud}
  const latLngs = polyData.map(p => {
    if (Array.isArray(p)) {
      const parts = String(p[0]).split(',');
      return [parseFloat(parts[0]), parseFloat(parts[1])];
    }
    return [parseFloat(p.latitud ?? p.lat), parseFloat(p.longitud ?? p.lng ?? p.lon)];
  }).filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
  if (!latLngs.length) return;

  polylineLayer = L.polyline(latLngs, {
    color: '#1a6fdb',
    weight: 4,
    opacity: 0.85,
    lineJoin: 'round',
    lineCap: 'round',
  }).addTo(leafletMap);

  // Show route code label on pill if available
  const routeCode = sessionStorage.getItem('routePolylineCode');
  if (routeCode) regionPillName.textContent = routeCode;

  // Fetch this route's stops and re-render markers filtered to route stops only
  const lineaId = sessionStorage.getItem('routeLineaId');
  if (lineaId && currentConsorcio) {
    try {
      const data = await fetchJSON(`${API}/${currentConsorcio.idConsorcio}/lineas/${lineaId}/paradas`);
      const routeStopIds = new Set(
        (data.paradas || []).map(p => String(p.idParada))
      );
      // Re-render with filtered markers (don't re-fitBounds — polyline will do it)
      await showMap(currentConsorcio, null, routeStopIds);
      // Add off-route layer to map (hidden by default)
      showingAllStops = false;
      if (allMarkersLayer) {
        // keep off map initially
      }
      // Show the toggle button
      allStopsToggleLabel.textContent = ms('showAllStops');
      allStopsToggle.classList.remove('hidden');
    } catch {
      // Route stop fetch failed — fall through with all stops visible
    }
  }

  // Fit to polyline bounds (after potential re-render above)
  leafletMap.fitBounds(polylineLayer.getBounds(), { padding: [40, 40] });
}

// ---- All-stops toggle ----
allStopsToggle.addEventListener('click', () => {
  if (!allMarkersLayer) return;
  showingAllStops = !showingAllStops;
  if (showingAllStops) {
    allMarkersLayer.addTo(leafletMap);
    allStopsToggleLabel.textContent = ms('showRouteStops');
    allStopsToggle.classList.add('active');
  } else {
    allMarkersLayer.remove();
    allStopsToggleLabel.textContent = ms('showAllStops');
    allStopsToggle.classList.remove('active');
  }
});

// ---- Region switcher ----
regionBtn.addEventListener('click', () => {
  // Clear route polyline and toggle when user switches region manually
  if (polylineLayer) { polylineLayer.remove(); polylineLayer = null; }
  if (allMarkersLayer) { allMarkersLayer.remove(); allMarkersLayer = null; }
  showingAllStops = false;
  allStopsToggle.classList.add('hidden');
  regionOverlay.classList.remove('hidden');
  loadRegionOverlay();
});

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
