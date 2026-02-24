'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useLang } from '@/contexts/LangContext';
import { SHARED_STRINGS } from '@/lib/i18n';
import { API } from '@/lib/constants';
import { getLinea, getLineaParadas, getLineaNoticias, type LineaParada, type Noticia } from '@/lib/api';

interface LineaInfo {
  idLinea: string;
  nombre: string;
  codigo: string;
  hayNoticias?: boolean;
  polilinea?: Array<{ lat: number; lon: number }>;
}

export default function RoutePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLang();
  const t = SHARED_STRINGS[lang];

  const cId = searchParams.get('c') || '';
  const lId = searchParams.get('l') || '';
  const currentStopId = searchParams.get('s') || '';
  const backUrl = searchParams.get('from') || '/stops';
  const lineaCode = searchParams.get('code') || '';
  const sentidoParam = searchParams.get('sentido') || '1';

  const [lineaInfo, setLineaInfo] = useState<LineaInfo | null>(null);
  const [dir1, setDir1] = useState<LineaParada[]>([]);
  const [dir2, setDir2] = useState<LineaParada[]>([]);
  const [activeDir, setActiveDir] = useState<1 | 2>(parseInt(sentidoParam, 10) === 2 ? 2 : 1);
  const [alerts, setAlerts] = useState<Noticia[]>([]);
  const [openAlerts, setOpenAlerts] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!cId || !lId) { router.replace('/stops'); return; }
    loadRoute();
  }, [cId, lId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadRoute() {
    setLoading(true);
    setError(false);
    try {
      const [linea, paradas] = await Promise.all([
        fetch(`${API}/${cId}/lineas/${lId}`).then(r => r.json()) as Promise<LineaInfo>,
        getLineaParadas(cId, lId),
      ]);
      setLineaInfo(linea);

      const d1 = paradas.filter(p => String((p as LineaParada & { sentido?: string }).sentido) === '1');
      const d2 = paradas.filter(p => String((p as LineaParada & { sentido?: string }).sentido) === '2');
      setDir1(d1.length ? d1 : paradas);
      setDir2(d2);

      // Store polyline for map
      if (linea.polilinea?.length) {
        sessionStorage.setItem('routePolyline', JSON.stringify(linea.polilinea));
        sessionStorage.setItem('routePolylineCode', lineaCode || linea.codigo);
        sessionStorage.setItem('routeLineaId', lId);
      }

      // Load disruptions
      if (linea.hayNoticias) {
        try {
          const noticias = await getLineaNoticias(cId, lId);
          setAlerts(noticias);
        } catch { /* non-critical */ }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const currentStops = activeDir === 2 && dir2.length ? dir2 : dir1;

  function endpointLabel(stops: LineaParada[]) {
    if (!stops.length) return '';
    return `${stops[0].nombre} → ${stops[stops.length - 1].nombre}`;
  }

  const hasDir2 = dir2.length > 0;
  const title = lineaCode || lineaInfo?.codigo || `Line ${lId}`;
  const hasPolyline = !!(lineaInfo?.polilinea?.length);
  const routeBack = encodeURIComponent(`/route?c=${cId}&l=${lId}&s=${currentStopId}&code=${encodeURIComponent(lineaCode)}&sentido=${activeDir}&from=${encodeURIComponent(backUrl)}`);

  return (
    <>
      <AppHeader title={title} backHref={backUrl} />
      <main className="main-content">

        {/* Route subtitle */}
        {lineaInfo && (
          <div className="route-meta" id="route-meta">{lineaInfo.nombre}</div>
        )}

        {/* Disruption banner */}
        {alerts.length > 0 && (
          <div className="disruption-banner" id="disruption-banner">
            <div className="disruption-banner-header">
              <span className="disruption-icon">⚠️</span>
              <span className="disruption-banner-title" id="disruption-banner-title">{t.serviceAlerts}</span>
            </div>
            <div className="disruption-alerts-list" id="disruption-alerts-list">
              {alerts.map((alert, i) => {
                const title = lang === 'es'
                  ? ((alert as Noticia & { titulo?: string }).titulo || (alert as Noticia & { tituloEng?: string }).tituloEng || '')
                  : ((alert as Noticia & { tituloEng?: string }).tituloEng || (alert as Noticia & { titulo?: string }).titulo || '');
                const body = lang === 'es'
                  ? ((alert as Noticia & { cuerpo?: string }).cuerpo || (alert as Noticia & { cuerpoEng?: string }).cuerpoEng || '')
                  : ((alert as Noticia & { cuerpoEng?: string }).cuerpoEng || (alert as Noticia & { cuerpo?: string }).cuerpo || '');
                return (
                  <div
                    key={i}
                    className={`disruption-alert-item${openAlerts.has(i) ? ' open' : ''}`}
                  >
                    <div
                      className="disruption-alert-title"
                      onClick={() => setOpenAlerts(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      })}
                    >{title}</div>
                    <div className="disruption-alert-body">{body}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Direction tabs */}
        {hasDir2 && (
          <div className="direction-tabs" id="direction-tabs">
            <button
              className={`dir-tab${activeDir === 1 ? ' active' : ''}`}
              onClick={() => setActiveDir(1)}
            >
              → {t.outbound}
              {endpointLabel(dir1) && <span className="dir-tab-sub">{endpointLabel(dir1)}</span>}
            </button>
            <button
              className={`dir-tab${activeDir === 2 ? ' active' : ''}`}
              onClick={() => setActiveDir(2)}
            >
              ← {t.inbound}
              {endpointLabel(dir2) && <span className="dir-tab-sub">{endpointLabel(dir2)}</span>}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="route-actions">
          <a
            className="action-btn"
            href={`/timetable?c=${cId}&l=${lId}&code=${encodeURIComponent(lineaCode)}&from=${routeBack}`}
          >
            {t.fullTimetable}
          </a>
          {hasPolyline && (
            <a
              className="action-btn"
              href={`/map?c=${cId}&polyline=1&from=${routeBack}`}
            >
              {t.viewOnMap}
            </a>
          )}
        </div>

        {/* Stop hint */}
        <p className="hint" id="route-hint">{t.tapStop}</p>

        {/* Stops list */}
        <div className="card-list" id="route-stops">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <p className="hint">{t.noRouteStops}</p>
          ) : currentStops.length === 0 ? (
            <p className="hint">{t.noRouteStops}</p>
          ) : (
            currentStops.map((stop, idx) => {
              const isCurrent = String(stop.idParada) === String(currentStopId);
              return (
                <div
                  key={stop.idParada}
                  className={`card route-stop-card${isCurrent ? ' route-stop-current' : ''}`}
                  role={isCurrent ? undefined : 'button'}
                  tabIndex={isCurrent ? undefined : 0}
                  onClick={isCurrent ? undefined : () => {
                    const from = encodeURIComponent(`/route?c=${cId}&l=${lId}&s=${currentStopId}&code=${encodeURIComponent(lineaCode)}&sentido=${activeDir}&from=${encodeURIComponent(backUrl)}`);
                    router.push(`/station?c=${cId}&s=${stop.idParada}&from=${from}`);
                  }}
                  onKeyDown={isCurrent ? undefined : e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
                >
                  <div className="route-stop-index">{idx + 1}</div>
                  <div className="card-body">
                    <div className="card-title">{stop.nombre}</div>
                    {(stop as LineaParada & { modos?: string }).modos && (
                      <div className="card-sub">{(stop as LineaParada & { modos?: string }).modos}</div>
                    )}
                  </div>
                  {isCurrent
                    ? <span className="you-are-here">●</span>
                    : <span className="card-arrow">›</span>
                  }
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
