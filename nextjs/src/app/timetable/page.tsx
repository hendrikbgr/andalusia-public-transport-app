'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useLang } from '@/contexts/LangContext';
import { LTT_STRINGS } from '@/lib/i18n';
import { API } from '@/lib/constants';
import { getGlobalFrecuencias, type GlobalFrecuencia, type TimetableResponse, type HorarioBloque, type HorarioTrip } from '@/lib/api';

interface FreqOption {
  idfrecuencia: string;
  acronimo: string;
  nombre: string;
}

export default function TimetablePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLang();
  const t = LTT_STRINGS[lang];

  const cId = searchParams.get('c') || '';
  const lId = searchParams.get('l') || '';
  const lineaCode = searchParams.get('code') || '';
  const backUrl = searchParams.get('from') || '/stops';

  const [availableFreqs, setAvailableFreqs] = useState<FreqOption[]>([]);
  const [activeFreqId, setActiveFreqId] = useState<string | null>(null);
  const [activeDir, setActiveDir] = useState<'ida' | 'vuelta'>('ida');
  const [ttData, setTtData] = useState<TimetableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    if (!cId || !lId) { router.replace('/stops'); return; }
    loadFreqs();
  }, [cId, lId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeFreqId) loadAndRender(activeFreqId);
  }, [activeFreqId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFreqs() {
    setLoading(true);
    try {
      const today = new Date();
      const dia = today.getDate();
      const mes = today.getMonth() + 1;

      const globalFreqs = await getGlobalFrecuencias(cId);

      const probeResults = await Promise.all(
        globalFreqs.map(async (gf: GlobalFrecuencia) => {
          try {
            const d = await fetch(
              `${API}/${cId}/horarios_lineas?idLinea=${lId}&idFrecuencia=${gf.idFreq}&dia=${dia}&mes=${mes}`
            ).then(r => r.json()) as TimetableResponse & { frecuencias?: FreqOption[] };
            const hasData = (d.planificadores || []).length > 0;
            const freqsInResp = (d as TimetableResponse & { frecuencias?: FreqOption[] }).frecuencias || [];
            return hasData ? { idFreq: gf.idFreq, gf, freqsInResp } : null;
          } catch { return null; }
        })
      );

      const seenIds = new Set<string>();
      const freqs: FreqOption[] = [];
      for (const r of probeResults) {
        if (!r) continue;
        if (r.freqsInResp.length) {
          for (const f of r.freqsInResp) {
            if (!seenIds.has(f.idfrecuencia)) {
              seenIds.add(f.idfrecuencia);
              freqs.push(f);
            }
          }
        } else {
          if (!seenIds.has(r.idFreq)) {
            seenIds.add(r.idFreq);
            freqs.push({ idfrecuencia: r.idFreq, acronimo: r.gf.acronimo, nombre: r.gf.nombre });
          }
        }
      }

      if (!freqs.length) { setNoData(true); setLoading(false); return; }
      setAvailableFreqs(freqs);
      setActiveFreqId(freqs[0].idfrecuencia);
    } catch {
      setNoData(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadAndRender(freqId: string) {
    setGridLoading(true);
    try {
      const today = new Date();
      const dia = String(today.getDate()).padStart(2, '0');
      const mes = String(today.getMonth() + 1).padStart(2, '0');
      const data = await fetch(
        `${API}/${cId}/horarios_lineas?idLinea=${lId}&idFrecuencia=${freqId}&dia=${dia}&mes=${mes}`
      ).then(r => r.json()) as TimetableResponse;
      setTtData(data);

      // Auto-select correct direction
      const p = (data.planificadores || [])[0];
      if (p) {
        const hasIda = (p.bloquesIda || []).filter(b => b.tipo !== '1').length > 0;
        const hasVuelta = (p.bloquesVuelta || []).filter(b => b.tipo !== '1').length > 0;
        if (!hasIda && hasVuelta) setActiveDir('vuelta');
        else setActiveDir('ida');
      }
    } catch {
      setNoData(true);
    } finally {
      setGridLoading(false);
    }
  }

  const planificador = (ttData?.planificadores || [])[0];
  const bloques: HorarioBloque[] = planificador
    ? (activeDir === 'ida' ? planificador.bloquesIda : planificador.bloquesVuelta) || []
    : [];
  const horario: HorarioTrip[] = planificador
    ? (activeDir === 'ida' ? planificador.horarioIda : planificador.horarioVuelta) || []
    : [];

  const stopRows = bloques.filter(b => b.tipo !== '1');
  const stopIndices: number[] = [];
  bloques.forEach((b, i) => { if (b.tipo !== '1') stopIndices.push(i); });

  const hasIda = planificador ? (planificador.bloquesIda || []).filter(b => b.tipo !== '1').length > 0 : false;
  const hasVuelta = planificador ? (planificador.bloquesVuelta || []).filter(b => b.tipo !== '1').length > 0 : false;
  const showDirTabs = hasIda && hasVuelta;

  // Endpoint labels for direction tabs
  function endpointLabel(blks: HorarioBloque[]) {
    const stops = blks.filter(b => b.tipo !== '1');
    if (stops.length < 2) return '';
    return `${stops[0].nombre} → ${stops[stops.length - 1].nombre}`;
  }

  const title = lineaCode || `Line ${lId}`;

  return (
    <>
      <AppHeader title={title} backHref={backUrl} />
      <main className="main-content">
        <div className="tt-meta" id="tt-meta">{t.title}</div>

        {/* Frequency tabs */}
        {availableFreqs.length > 1 && (
          <div className="tt-freq-tabs" id="tt-freq-tabs">
            {availableFreqs.map(f => (
              <button
                key={f.idfrecuencia}
                className={`tt-freq-tab${f.idfrecuencia === activeFreqId ? ' active' : ''}`}
                onClick={() => setActiveFreqId(f.idfrecuencia)}
              >
                {f.nombre || f.acronimo || f.idfrecuencia}
              </button>
            ))}
          </div>
        )}

        {/* Direction tabs */}
        {showDirTabs && planificador && (
          <div className="direction-tabs" id="tt-direction-tabs">
            <button
              className={`dir-tab${activeDir === 'ida' ? ' active' : ''}`}
              onClick={() => setActiveDir('ida')}
            >
              {t.outbound}
              {endpointLabel(planificador.bloquesIda || []) && (
                <span className="dir-tab-sub">{endpointLabel(planificador.bloquesIda || [])}</span>
              )}
            </button>
            <button
              className={`dir-tab${activeDir === 'vuelta' ? ' active' : ''}`}
              onClick={() => setActiveDir('vuelta')}
            >
              {t.inbound}
              {endpointLabel(planificador.bloquesVuelta || []) && (
                <span className="dir-tab-sub">{endpointLabel(planificador.bloquesVuelta || [])}</span>
              )}
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="tt-grid-wrapper" id="tt-grid-wrapper">
          {(loading || gridLoading) ? (
            <LoadingSpinner />
          ) : noData || !stopRows.length || !horario.length ? (
            <p className="tt-no-data">{t.noData}</p>
          ) : (
            <table className="tt-grid">
              <thead>
                <tr>
                  <th>{t.stop}</th>
                  {horario.map((trip, i) => (
                    <th key={i}>
                      {(trip.horas || []).find(h => h && h !== '--') || ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stopIndices.map((origIdx, rowNum) => (
                  <tr key={rowNum}>
                    <td>{stopRows[rowNum].nombre}</td>
                    {horario.map((trip, i) => {
                      const time = (trip.horas || [])[origIdx];
                      return <td key={i}>{(time && time !== '--') ? time : ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
