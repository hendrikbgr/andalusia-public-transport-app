'use client';

// This component is only loaded client-side via dynamic import (ssr: false)
// because Leaflet requires window/document.

import { useEffect, useRef } from 'react';
import type { Map, LayerGroup, Marker, Polyline } from 'leaflet';
import { API, CONSORTIUM_ICONS } from '@/lib/constants';

export interface PolySegment {
  points: Array<{ lat?: number; lon?: number; latitud?: number; longitud?: number } | [string]>;
  color?: string;
  code?: string;
  lineaId?: string;
}

interface Stop {
  idParada: string;
  nombre: string;
  nucleo?: string;
  municipio?: string;
  latitud?: string;
  longitud?: string;
}

export interface Consorcio {
  idConsorcio: string;
  nombre: string;
}

interface LeafletMapProps {
  consorcio: Consorcio | null;
  focusStopId?: string | null;
  routePolyline?: PolySegment['points'] | null;
  journeyPolylines?: PolySegment[] | null;
  routeCode?: string | null;
  routeLineaId?: string | null;
  lang: string;
  onRegionChange?: () => void;
}

const MAP_STRINGS: Record<string, Record<string, string>> = {
  en: {
    viewDepartures: 'View departures',
    showAllStops: 'Show all stops',
    showRouteStops: 'Route stops only',
    loading: 'Loading stops…',
    locationUnavailable: 'Location unavailable',
  },
  es: {
    viewDepartures: 'Ver salidas',
    showAllStops: 'Mostrar todas las paradas',
    showRouteStops: 'Solo paradas de la línea',
    loading: 'Cargando paradas…',
    locationUnavailable: 'Ubicación no disponible',
  },
};

function ms(key: string, lang: string) {
  return (MAP_STRINGS[lang] || MAP_STRINGS.en)[key] || MAP_STRINGS.en[key];
}

function parseLatLng(p: PolySegment['points'][number]): [number, number] | null {
  if (Array.isArray(p)) {
    const parts = String(p[0]).split(',');
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return [lat, lng];
  }
  const obj = p as { lat?: number; lon?: number; latitud?: number; longitud?: number };
  const lat = parseFloat(String(obj.latitud ?? obj.lat ?? ''));
  const lng = parseFloat(String(obj.longitud ?? obj.lon ?? ''));
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

export default function LeafletMap({ consorcio, focusStopId, routePolyline, journeyPolylines, routeCode, routeLineaId, lang, onRegionChange }: LeafletMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const allMarkersLayerRef = useRef<LayerGroup | null>(null);
  const polylineLayerRef = useRef<Polyline | null>(null);
  const journeyLayersRef = useRef<Polyline[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const showingAllRef = useRef(false);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);

  // Init map once
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    // Dynamic import of Leaflet (window-dependent)
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css' as never);

      const map = L.map(mapDivRef.current!, {
        zoomControl: false,
        attributionControl: false,
      }).setView([37.0, -4.5], 9);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // User location
      if (navigator.geolocation) {
        if (!map.getPane('userPane')) {
          map.createPane('userPane');
          (map.getPane('userPane') as HTMLElement).style.zIndex = '650';
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          pos => {
            const { latitude: lat, longitude: lng } = pos.coords;
            if (!userMarkerRef.current) {
              const icon = L.divIcon({
                className: '',
                html: '<div class="map-user-dot"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              });
              userMarkerRef.current = L.marker([lat, lng], { icon, pane: 'userPane', interactive: false }).addTo(map);
              if (!focusStopId) map.setView([lat, lng], 13);
            } else {
              userMarkerRef.current.setLatLng([lat, lng]);
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
      }
    });

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load stops when consorcio changes
  useEffect(() => {
    if (!consorcio || !mapRef.current) return;
    import('leaflet').then(L => {
      loadStops(L, consorcio, focusStopId || null, null, lang);
    });
  }, [consorcio, focusStopId, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw route polyline
  useEffect(() => {
    if (!routePolyline || !mapRef.current) return;
    import('leaflet').then(L => {
      drawRoutePolyline(L, routePolyline, routeCode || null, routeLineaId || null, consorcio, lang);
    });
  }, [routePolyline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw journey polylines
  useEffect(() => {
    if (!journeyPolylines || !mapRef.current) return;
    import('leaflet').then(L => {
      drawJourneyPolylines(L, journeyPolylines, consorcio, lang);
    });
  }, [journeyPolylines]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadStops(
    L: typeof import('leaflet'),
    c: Consorcio,
    focusId: string | null,
    routeStopIds: Set<string> | null,
    currentLang: string,
  ) {
    const map = mapRef.current;
    if (!map) return;
    markersLayerRef.current?.clearLayers();
    allMarkersLayerRef.current?.clearLayers();

    try {
      const res = await fetch(`${API}/${c.idConsorcio}/paradas/`);
      const data = await res.json();
      const stops: Stop[] = (data.paradas || []).filter((s: Stop) =>
        s.latitud && s.longitud &&
        parseFloat(s.latitud) !== 0 && parseFloat(s.longitud) !== 0
      );

      const stopIcon = L.divIcon({ className: '', html: '<div class="map-stop-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -10] });
      const dimIcon = L.divIcon({ className: '', html: '<div class="map-stop-dot map-stop-dot-dim"></div>', iconSize: [10, 10], iconAnchor: [5, 5], popupAnchor: [0, -8] });
      const focusIcon = L.divIcon({ className: '', html: '<div class="map-stop-dot map-stop-dot-focus"></div>', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -13] });

      const bounds: [number, number][] = [];
      let focusMarker: Marker | null = null;

      if (!allMarkersLayerRef.current) allMarkersLayerRef.current = L.layerGroup();

      stops.forEach((stop: Stop) => {
        const lat = parseFloat(stop.latitud!);
        const lng = parseFloat(stop.longitud!);
        if (isNaN(lat) || isNaN(lng)) return;

        const isFocus = focusId && String(stop.idParada) === String(focusId);
        const isRouteStop = !routeStopIds || routeStopIds.has(String(stop.idParada));

        const popupContent = `
          <div class="map-popup">
            <div class="map-popup-name">${stop.nombre}</div>
            <div class="map-popup-meta">${[stop.nucleo, stop.municipio].filter(Boolean).join(' · ')}</div>
            <a class="map-popup-btn" href="/station?c=${c.idConsorcio}&s=${stop.idParada}&from=${encodeURIComponent('/map?c=' + c.idConsorcio)}">
              ${ms('viewDepartures', currentLang)} →
            </a>
          </div>`;

        if (isRouteStop) {
          bounds.push([lat, lng]);
          const marker = L.marker([lat, lng], { icon: isFocus ? focusIcon : stopIcon });
          marker.bindPopup(popupContent, { closeButton: false, className: 'map-leaflet-popup', maxWidth: 220 });
          markersLayerRef.current?.addLayer(marker);
          if (isFocus) focusMarker = marker;
        } else {
          const marker = L.marker([lat, lng], { icon: dimIcon });
          marker.bindPopup(popupContent, { closeButton: false, className: 'map-leaflet-popup', maxWidth: 220 });
          allMarkersLayerRef.current?.addLayer(marker);
        }
      });

      map.invalidateSize();
      if (focusMarker) {
        map.setView((focusMarker as Marker).getLatLng(), 15);
        (focusMarker as Marker).openPopup();
      } else if (bounds.length) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch { /* non-fatal */ }
  }

  async function drawRoutePolyline(
    L: typeof import('leaflet'),
    polyData: PolySegment['points'],
    code: string | null,
    lineaId: string | null,
    c: Consorcio | null,
    currentLang: string,
  ) {
    const map = mapRef.current;
    if (!map || !polyData?.length) return;
    polylineLayerRef.current?.remove();
    polylineLayerRef.current = null;

    const latLngs = polyData.map(parseLatLng).filter((x): x is [number, number] => x !== null);
    if (!latLngs.length) return;

    polylineLayerRef.current = L.polyline(latLngs, { color: '#1a6fdb', weight: 4, opacity: 0.85 }).addTo(map);

    if (c && lineaId) {
      try {
        const res = await fetch(`${API}/${c.idConsorcio}/lineas/${lineaId}/paradas`);
        const data = await res.json();
        const routeStopIds = new Set<string>((data.paradas || []).map((p: { idParada: string }) => String(p.idParada)));
        await loadStops(L, c, null, routeStopIds, currentLang);
        if (toggleBtnRef.current) {
          toggleBtnRef.current.textContent = ms('showAllStops', currentLang);
          toggleBtnRef.current.style.display = '';
        }
        showingAllRef.current = false;
      } catch { /* fall through */ }
    }

    if (polylineLayerRef.current) {
      map.fitBounds(polylineLayerRef.current.getBounds(), { padding: [40, 40] });
    }
  }

  async function drawJourneyPolylines(
    L: typeof import('leaflet'),
    journeyPolys: PolySegment[],
    c: Consorcio | null,
    currentLang: string,
  ) {
    const map = mapRef.current;
    if (!map || !journeyPolys?.length) return;
    journeyLayersRef.current.forEach(l => l.remove());
    journeyLayersRef.current = [];
    polylineLayerRef.current?.remove();
    polylineLayerRef.current = null;

    const allBounds: [number, number][] = [];

    for (const seg of journeyPolys) {
      const latLngs = (seg.points || []).map(parseLatLng).filter((x): x is [number, number] => x !== null);
      if (!latLngs.length) continue;
      const layer = L.polyline(latLngs, { color: seg.color || '#1a6fdb', weight: 5, opacity: 0.9 }).addTo(map);
      journeyLayersRef.current.push(layer);
      allBounds.push(...latLngs);
    }

    if (c) {
      try {
        const lineaIds = journeyPolys.map(p => p.lineaId).filter(Boolean) as string[];
        const routeStopIds = new Set<string>();
        await Promise.all(lineaIds.map(async id => {
          const res = await fetch(`${API}/${c.idConsorcio}/lineas/${id}/paradas`);
          const data = await res.json();
          (data.paradas || []).forEach((p: { idParada: string }) => routeStopIds.add(String(p.idParada)));
        }));
        if (routeStopIds.size) {
          await loadStops(L, c, null, routeStopIds, currentLang);
          if (toggleBtnRef.current) {
            toggleBtnRef.current.textContent = ms('showAllStops', currentLang);
            toggleBtnRef.current.style.display = '';
          }
          showingAllRef.current = false;
        }
      } catch { /* fall through */ }
    }

    if (allBounds.length) map.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40] });
  }

  function handleToggleAllStops() {
    if (!allMarkersLayerRef.current || !mapRef.current) return;
    import('leaflet').then(() => {
      showingAllRef.current = !showingAllRef.current;
      if (showingAllRef.current) {
        allMarkersLayerRef.current?.addTo(mapRef.current!);
        if (toggleBtnRef.current) { toggleBtnRef.current.textContent = ms('showRouteStops', lang); toggleBtnRef.current.classList.add('active'); }
      } else {
        allMarkersLayerRef.current?.remove();
        if (toggleBtnRef.current) { toggleBtnRef.current.textContent = ms('showAllStops', lang); toggleBtnRef.current.classList.remove('active'); }
      }
    });
  }

  return (
    <div className="map-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapDivRef} id="leaflet-map" style={{ width: '100%', height: '100%' }} />

      {/* Region pill / change button */}
      <div className="map-region-pill" id="region-pill">
        <span id="region-pill-name">{consorcio?.nombre || ''}</span>
        <button className="map-region-change-btn" id="region-btn" onClick={onRegionChange}>
          {ms('showAllStops', lang)}
        </button>
      </div>

      {/* All-stops toggle */}
      <button
        ref={toggleBtnRef}
        className="map-all-stops-toggle"
        id="all-stops-toggle"
        style={{ display: 'none' }}
        onClick={handleToggleAllStops}
      >
        <span id="all-stops-toggle-label">{ms('showAllStops', lang)}</span>
      </button>

      {/* Locate me button */}
      <button
        className="map-locate-btn hidden"
        id="locate-btn"
        onClick={() => {
          if (userMarkerRef.current && mapRef.current) {
            mapRef.current.setView(userMarkerRef.current.getLatLng(), Math.max(mapRef.current.getZoom(), 15), { animate: true });
          }
        }}
      >
        📍
      </button>
    </div>
  );
}
