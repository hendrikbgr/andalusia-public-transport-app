'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useLang } from '@/contexts/LangContext';
import { SHARED_STRINGS } from '@/lib/i18n';
import { API } from '@/lib/constants';
import { isStopSaved, addSavedStop, removeSavedStop } from '@/lib/savedStops';

const QRCode = dynamic(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })), { ssr: false });

// ---- Types ----
interface ServiceItem {
  idLinea: string;
  linea: string;
  destino: string;
  servicio: string; // "HH:MM"
  sentido?: string;
  nombre: string;
}

interface ServiceWindow {
  servicios?: ServiceItem[];
  horaFin?: string;
}

interface StopInfo {
  nombre: string;
  nucleo?: string;
  municipio?: string;
  idZona?: string;
  latitud?: string;
  longitud?: string;
}

// ---- Helpers ----
function formatDateForAPI(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}+${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseServiceTime(timeStr: string, refDate: Date): Date {
  const [hh, mm] = timeStr.split(':').map(Number);
  const t = new Date(refDate);
  t.setHours(hh, mm, 0, 0);
  if (t.getTime() < refDate.getTime() - 3600000) t.setDate(t.getDate() + 1);
  return t;
}

function advanceCursor(cursor: Date, horaFin?: string): Date {
  if (horaFin) {
    const [datePart, timePart] = horaFin.split(' ');
    const [y, mo, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    return new Date(new Date(y, mo - 1, d, hh, mm, 0, 0).getTime() + 60000);
  }
  return new Date(cursor.getTime() + 15 * 60000);
}

async function fetchWindow(cId: string, sId: string, cursor: Date): Promise<ServiceWindow> {
  const url = `${API}/${cId}/paradas/${sId}/servicios?horaIni=${formatDateForAPI(cursor)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface EnrichedService extends ServiceItem {
  _scheduled: Date;
}

function enrichAndSort(services: ServiceItem[], now: Date): EnrichedService[] {
  return services
    .map(s => ({ ...s, _scheduled: parseServiceTime(s.servicio, now) }))
    .filter(s => Math.round((s._scheduled.getTime() - now.getTime()) / 60000) >= -1)
    .sort((a, b) => a._scheduled.getTime() - b._scheduled.getTime());
}

// ---- Component ----
export default function StationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLang();
  const t = SHARED_STRINGS[lang];

  const cId = searchParams.get('c') || '';
  const sId = searchParams.get('s') || '';
  const backUrl = searchParams.get('from') || '/stops';

  const [stopInfo, setStopInfo] = useState<StopInfo | null>(null);
  const [services, setServices] = useState<EnrichedService[]>([]);
  const [phase, setPhase] = useState<'loading' | 'scanning' | 'done' | 'empty' | 'error'>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [clockText, setClockText] = useState('');

  // sweep cancellation token
  const sweepTokenRef = useRef<object>({});

  // Pull-to-refresh state
  const mainRef = useRef<HTMLElement>(null);
  const ptrRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef(0);
  const pullingRef = useRef(false);
  const PULL_THRESHOLD = 72;

  // Redirect if no params
  useEffect(() => {
    if (!cId || !sId) router.replace('/stops');
  }, [cId, sId, router]);

  // Saved state
  useEffect(() => {
    if (cId && sId) setIsSaved(isStopSaved(cId, sId));
  }, [cId, sId]);

  // Clock
  useEffect(() => {
    function updateClock() {
      setClockText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, []);

  // Tick minute labels every second
  useEffect(() => {
    const id = setInterval(() => {
      setServices(prev =>
        prev.map(s => ({ ...s, _scheduled: parseServiceTime(s.servicio, new Date()) }))
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Load stop info
  useEffect(() => {
    if (!cId || !sId) return;
    fetch(`${API}/${cId}/paradas/${sId}`)
      .then(r => r.json())
      .then((data: StopInfo) => setStopInfo(data))
      .catch(() => {});
  }, [cId, sId]);

  // Full sweep on load
  const runFullSweep = useCallback(async (silent: boolean) => {
    if (!cId || !sId) return;

    const token = {};
    sweepTokenRef.current = token;
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 0, 0);

    if (!silent) {
      setPhase('loading');
      setServices([]);
    }

    let cursor = new Date(now);
    let foundFirst = false;
    const collected: ServiceItem[] = [];
    const seen = new Set<string>();

    try {
      // Phase 1: find first window with services
      while (cursor <= endOfDay) {
        if (sweepTokenRef.current !== token) return;

        const data = await fetchWindow(cId, sId, cursor);

        if (sweepTokenRef.current !== token) return;

        if (data.servicios && data.servicios.length > 0) {
          for (const s of data.servicios) {
            const key = `${s.idLinea}|${s.servicio}`;
            if (!seen.has(key)) { seen.add(key); collected.push(s); }
          }
          if (!foundFirst) {
            foundFirst = true;
            setPhase('done');
            setServices(enrichAndSort(collected, now));
          } else {
            setServices(enrichAndSort(collected, now));
          }
          cursor = advanceCursor(cursor, data.horaFin);
          break; // move to phase 2
        }

        if (!foundFirst && !silent) setPhase('scanning');
        cursor = advanceCursor(cursor, data.horaFin);
      }

      if (!foundFirst) {
        setPhase('empty');
        return;
      }

      // Phase 2: sweep rest of day
      while (cursor <= endOfDay) {
        if (sweepTokenRef.current !== token) return;
        let data: ServiceWindow;
        try {
          data = await fetchWindow(cId, sId, cursor);
        } catch {
          break;
        }
        if (sweepTokenRef.current !== token) return;
        if (data.servicios && data.servicios.length > 0) {
          let changed = false;
          for (const s of data.servicios) {
            const key = `${s.idLinea}|${s.servicio}`;
            if (!seen.has(key)) { seen.add(key); collected.push(s); changed = true; }
          }
          if (changed) setServices(enrichAndSort(collected, now));
        }
        cursor = advanceCursor(cursor, data.horaFin);
      }
    } catch {
      if (!foundFirst) setPhase('error');
    }
  }, [cId, sId]);

  useEffect(() => {
    runFullSweep(false);
  }, [runFullSweep]);

  // Pull-to-refresh touch handlers
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    function onTouchStart(e: TouchEvent) {
      if (main!.scrollTop === 0) touchStartYRef.current = e.touches[0].clientY;
      else touchStartYRef.current = 0;
    }
    function onTouchMove(e: TouchEvent) {
      if (!touchStartYRef.current) return;
      const dy = e.touches[0].clientY - touchStartYRef.current;
      if (dy > 10 && !isRefreshing) {
        pullingRef.current = true;
        const progress = Math.min(dy / PULL_THRESHOLD, 1);
        if (ptrRef.current) {
          ptrRef.current.classList.remove('hidden');
          ptrRef.current.style.opacity = String(progress);
          ptrRef.current.style.transform = `translateY(${Math.min(dy * 0.4, 32)}px)`;
        }
      }
    }
    function onTouchEnd(e: TouchEvent) {
      if (!touchStartYRef.current) return;
      const dy = e.changedTouches[0].clientY - touchStartYRef.current;
      if (ptrRef.current) {
        ptrRef.current.style.opacity = '';
        ptrRef.current.style.transform = '';
      }
      touchStartYRef.current = 0;
      if (pullingRef.current && dy >= PULL_THRESHOLD && !isRefreshing) {
        triggerRefresh();
      } else {
        ptrRef.current?.classList.add('hidden');
      }
      pullingRef.current = false;
    }

    main.addEventListener('touchstart', onTouchStart, { passive: true });
    main.addEventListener('touchmove', onTouchMove, { passive: true });
    main.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      main.removeEventListener('touchstart', onTouchStart);
      main.removeEventListener('touchmove', onTouchMove);
      main.removeEventListener('touchend', onTouchEnd);
    };
  }, [isRefreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (ptrRef.current) {
      ptrRef.current.classList.remove('hidden');
      ptrRef.current.style.opacity = '1';
      ptrRef.current.style.transform = 'translateY(32px)';
    }
    await runFullSweep(true);
    setIsRefreshing(false);
    if (ptrRef.current) {
      ptrRef.current.classList.add('hidden');
      ptrRef.current.style.transform = '';
    }
  }

  function toggleSave() {
    if (isSaved) {
      removeSavedStop(cId, sId);
    } else {
      addSavedStop({
        idConsorcio: cId,
        idParada: sId,
        nombre: stopInfo?.nombre || `Stop ${sId}`,
        nucleo: stopInfo?.nucleo,
        municipio: stopInfo?.municipio,
      });
    }
    setIsSaved(!isSaved);
  }

  function formatMins(mins: number): string {
    if (mins <= 0) return t.now;
    if (mins < 60) return t.min(mins);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h${m}min`;
  }

  function getMinsClass(mins: number) {
    return mins <= 2 ? 'mins-now' : mins <= 10 ? 'mins-soon' : 'mins-later';
  }

  const metaParts = stopInfo ? [stopInfo.nucleo, stopInfo.municipio].filter(Boolean) : [];
  const zonePart = stopInfo?.idZona ? `  ·  ${t.zone(stopInfo.idZona)}` : '';
  const stationTitle = stopInfo?.nombre || `Stop ${sId}`;

  const hasCoords = stopInfo && parseFloat(stopInfo.latitud || '') && parseFloat(stopInfo.longitud || '');
  const mapHref = hasCoords ? `/map?c=${cId}&s=${sId}&from=${encodeURIComponent(`/station?c=${cId}&s=${sId}`)}` : null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      <AppHeader title={stationTitle} backHref={backUrl} />
      <main className="main-content station-main" id="station-main" ref={mainRef}>

        {/* PTR indicator */}
        <div className="ptr-indicator hidden" id="ptr-indicator" ref={ptrRef}>
          <div className="ptr-spinner"></div>
        </div>

        {/* Station meta */}
        <div className="station-meta-row">
          <div>
            <div id="station-meta" className="station-meta">
              {metaParts.join(' · ')}{zonePart}
            </div>
          </div>
          <div className="station-clock-wrap">
            <span className="live-label" id="live-label">{t.liveLabel}</span>
            <span className="live-clock" id="live-clock">{clockText}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="station-actions">
          <button
            className={`action-btn save-stop-btn${isSaved ? ' saved' : ''}`}
            id="save-stop-btn"
            onClick={toggleSave}
          >
            <span>{isSaved ? '★ ' : '☆ '}</span>
            <span id="save-stop-label">{t[isSaved ? 'unsaveStop' : 'saveStop']}</span>
          </button>

          {mapHref && (
            <a className="action-btn show-on-map-btn" id="show-on-map-btn" href={mapHref}>
              {t.showOnMap}
            </a>
          )}

          <button
            className="action-btn refresh-btn"
            id="refresh-btn"
            onClick={triggerRefresh}
          >
            <span className={`refresh-icon${isRefreshing ? ' spinning' : ''}`}>↻</span>
          </button>

          <button className="action-btn qr-toggle" id="qr-toggle" onClick={() => setShowQR(true)}>
            QR
          </button>
        </div>

        {/* Departures board */}
        <div className="departures-board" id="departures-board">
          {phase === 'loading' && <LoadingSpinner />}
          {phase === 'scanning' && (
            <div className="scanning-indicator" id="scanning-indicator">
              <div className="loading-spinner"></div>
              <p id="scanning-text">{t.scanningServices}</p>
            </div>
          )}
          {phase === 'error' && <p className="hint">{t.noServiceLoad}</p>}
          {phase === 'empty' && (
            <div id="no-service">
              <p id="no-service-text" className="no-service-text">{t.noService}</p>
              <p id="no-service-hint" className="hint">{t.checkBack}</p>
            </div>
          )}
          {phase === 'done' && services.length === 0 && (
            <div id="no-service">
              <p className="no-service-text">{t.noService}</p>
              <p className="hint">{t.checkBack}</p>
            </div>
          )}
          {phase === 'done' && services.map(s => {
            const now = new Date();
            const mins = Math.round((s._scheduled.getTime() - now.getTime()) / 60000);
            const routeName = s.nombre.length > 40 ? s.nombre.slice(0, 38) + '…' : s.nombre;
            return (
              <div
                key={`${s.idLinea}|${s.servicio}`}
                className="departure-card"
                role="button"
                tabIndex={0}
                onClick={() => {
                  const backEncoded = encodeURIComponent(`/station?c=${cId}&s=${sId}`);
                  router.push(
                    `/route?c=${cId}&l=${s.idLinea}&s=${sId}` +
                    `&code=${encodeURIComponent(s.linea)}` +
                    `&dest=${encodeURIComponent(s.destino || '')}` +
                    `&sentido=${encodeURIComponent(s.sentido || '1')}` +
                    `&from=${backEncoded}`
                  );
                }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
              >
                <div className="departure-line">{s.linea}</div>
                <div className="departure-body">
                  <div className="departure-dest">{s.destino || '—'}</div>
                  <div className="departure-name">{routeName}</div>
                </div>
                <div className="departure-time-col">
                  <span className="departure-sched">{s.servicio}</span>
                  <span className={`departure-mins ${getMinsClass(mins)}`}>{formatMins(mins)}</span>
                </div>
                <span className="departure-info-arrow">›</span>
              </div>
            );
          })}
        </div>
      </main>

      {/* QR Modal */}
      {showQR && (
        <div
          className="qr-overlay"
          id="qr-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowQR(false); }}
        >
          <div className="qr-modal">
            <button className="qr-close" id="qr-close" onClick={() => setShowQR(false)}>{t.close}</button>
            <p className="qr-label" id="qr-label">{t.scanQR}</p>
            <div id="qr-code">
              {currentUrl && <QRCode value={currentUrl} size={220} />}
            </div>
            <p className="qr-url" id="qr-url">{currentUrl}</p>
            <button className="qr-close-btn" id="qr-close-btn" onClick={() => setShowQR(false)}>{t.close}</button>
          </div>
        </div>
      )}
    </>
  );
}
