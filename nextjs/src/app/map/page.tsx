'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useLang } from '@/contexts/LangContext';
import { CONSORTIUM_ICONS } from '@/lib/constants';
import { getDefaultRegion } from '@/lib/i18n';
import { getConsorcios, type Consorcio } from '@/lib/api';
import type { PolySegment } from '@/components/map/LeafletMap';

// Leaflet requires window — only load client-side
const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner /></div>,
});

const MAP_STRINGS = {
  en: {
    title: 'Stop Map',
    overlayTitle: 'Select a region',
    loading: 'Loading stops…',
  },
  es: {
    title: 'Mapa de Paradas',
    overlayTitle: 'Selecciona una región',
    loading: 'Cargando paradas…',
  },
};

function ms(key: string, lang: string): string {
  return ((MAP_STRINGS as Record<string, Record<string, string>>)[lang] || MAP_STRINGS.en)[key] || (MAP_STRINGS.en as Record<string, string>)[key];
}

function MapPageContent() {
  const { lang } = useLang();
  const searchParams = useSearchParams();

  const focusConsorcioId = searchParams.get('c');
  const focusStopId = searchParams.get('s');
  const hasPolyline = searchParams.get('polyline') === '1';
  const fromParam = searchParams.get('from') || '/';

  const [consorcio, setConsorcio] = useState<Consorcio | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayList, setOverlayList] = useState<Consorcio[]>([]);
  const [overlayLoading, setOverlayLoading] = useState(false);

  // Polyline data read from sessionStorage (only on client)
  const [routePolyline, setRoutePolyline] = useState<PolySegment['points'] | null>(null);
  const [journeyPolylines, setJourneyPolylines] = useState<PolySegment[] | null>(null);
  const [routeCode, setRouteCode] = useState<string | null>(null);
  const [routeLineaId, setRouteLineaId] = useState<string | null>(null);

  useEffect(() => {
    // Read sessionStorage on mount (client only)
    if (hasPolyline) {
      try {
        const rp = sessionStorage.getItem('routePolyline');
        if (rp) setRoutePolyline(JSON.parse(rp));
      } catch { /* ignore */ }
      try {
        const jp = sessionStorage.getItem('journeyPolylines');
        if (jp) setJourneyPolylines(JSON.parse(jp));
      } catch { /* ignore */ }
      const rc = sessionStorage.getItem('routePolylineCode');
      if (rc) setRouteCode(rc);
      const rl = sessionStorage.getItem('routeLineaId');
      if (rl) setRouteLineaId(rl);
    }

    // Resolve consorcio
    if (focusConsorcioId) {
      // Fetch full consortium info to get the name
      getConsorcios()
        .then(data => {
          const match = data.find(c => String(c.idConsorcio) === String(focusConsorcioId));
          if (match) {
            setConsorcio(match);
          } else {
            openOverlay();
          }
        })
        .catch(() => openOverlay());
    } else {
      const dr = getDefaultRegion();
      if (dr) {
        // Fetch full list to get the complete Consorcio object (including nombreCorto)
        getConsorcios()
          .then(data => {
            const match = data.find(c => String(c.idConsorcio) === String(dr.idConsorcio));
            if (match) {
              setConsorcio(match);
            } else {
              // Fallback: use the stored info directly
              setConsorcio({ idConsorcio: String(dr.idConsorcio), nombre: dr.nombre, nombreCorto: '' });
            }
          })
          .catch(() => {
            setConsorcio({ idConsorcio: String(dr.idConsorcio), nombre: dr.nombre, nombreCorto: '' });
          });
      } else {
        openOverlay();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openOverlay() {
    setShowOverlay(true);
    setOverlayLoading(true);
    getConsorcios()
      .then(data => {
        setOverlayList(data);
      })
      .catch(() => {
        setOverlayList([]);
      })
      .finally(() => setOverlayLoading(false));
  }

  function handleSelectRegion(c: Consorcio) {
    setConsorcio(c);
    setShowOverlay(false);
  }

  function handleRegionChange() {
    openOverlay();
  }

  return (
    <div className="map-page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <AppHeader title={ms('title', lang)} backHref={fromParam} />

      {/* Region selector overlay */}
      {showOverlay && (
        <div className="map-region-overlay">
          <div className="map-region-card">
            <div className="map-region-title">{ms('overlayTitle', lang)}</div>
            <div className="map-overlay-list">
              {overlayLoading ? (
                <LoadingSpinner />
              ) : overlayList.length === 0 ? (
                <p className="hint">Could not load regions.</p>
              ) : (
                overlayList.map(c => (
                  <div
                    key={c.idConsorcio}
                    className="map-overlay-item"
                    onClick={() => handleSelectRegion(c)}
                  >
                    <span className="map-overlay-icon">{CONSORTIUM_ICONS[c.idConsorcio] || '🚌'}</span>
                    <span className="map-overlay-name">{c.nombre}</span>
                    <span className="map-overlay-arrow">›</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {consorcio && (
          <LeafletMap
            consorcio={consorcio}
            focusStopId={focusStopId}
            routePolyline={routePolyline}
            journeyPolylines={journeyPolylines}
            routeCode={routeCode}
            routeLineaId={routeLineaId}
            lang={lang}
            onRegionChange={handleRegionChange}
          />
        )}
        {!consorcio && !showOverlay && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <LoadingSpinner />
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}><LoadingSpinner /></div>}>
      <MapPageContent />
    </Suspense>
  );
}
