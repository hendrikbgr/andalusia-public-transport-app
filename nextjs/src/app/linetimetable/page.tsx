'use client';

import { useState, useEffect } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DefaultRegionChip from '@/components/ui/DefaultRegionChip';
import { useLang } from '@/contexts/LangContext';
import { LTT_STRINGS } from '@/lib/i18n';
import { getDefaultRegion } from '@/lib/i18n';
import { API, CONSORTIUM_ICONS } from '@/lib/constants';
import { getConsorcios, getLineas, getGlobalFrecuencias, type Consorcio, type Linea, type TimetableResponse, type HorarioBloque, type HorarioTrip } from '@/lib/api';

type Step = 'region' | 'search' | 'grid';

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface FreqOption {
  idfrecuencia: string;
  acronimo: string;
  nombre: string;
}

export default function LineTimetablePage() {
  const { lang } = useLang();
  const t = LTT_STRINGS[lang];

  const [step, setStep] = useState<Step>('region');
  const [consortiums, setConsortiums] = useState<Consorcio[]>([]);
  const [consortiumsLoading, setConsortiumsLoading] = useState(true);
  const [currentConsorcio, setCurrentConsorcio] = useState<Consorcio | null>(null);
  const [allLines, setAllLines] = useState<Linea[]>([]);
  const [lineQuery, setLineQuery] = useState('');
  const [lineResults, setLineResults] = useState<Linea[]>([]);
  const [noLinesFound, setNoLinesFound] = useState(false);
  const [currentLine, setCurrentLine] = useState<Linea | null>(null);
  const [availableFreqs, setAvailableFreqs] = useState<FreqOption[]>([]);
  const [activeFreqId, setActiveFreqId] = useState<string | null>(null);
  const [activeDir, setActiveDir] = useState<'ida' | 'vuelta'>('ida');
  const [ttData, setTtData] = useState<TimetableResponse | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState(false);
  const [defaultChipVisible, setDefaultChipVisible] = useState(false);

  useEffect(() => { loadConsortiums(); }, []);

  useEffect(() => {
    if (activeFreqId && currentLine && currentConsorcio) {
      loadGrid(currentConsorcio.idConsorcio, currentLine.idLinea, activeFreqId);
    }
  }, [activeFreqId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadConsortiums() {
    setConsortiumsLoading(true);
    try {
      const data = await getConsorcios();
      setConsortiums(data);
      const dr = getDefaultRegion();
      if (dr) {
        const match = data.find(c => String(c.idConsorcio) === String(dr.idConsorcio));
        if (match) { setDefaultChipVisible(true); await selectRegion(match); return; }
      }
    } catch { /* handled */ }
    finally { setConsortiumsLoading(false); }
  }

  async function selectRegion(c: Consorcio) {
    setCurrentConsorcio(c);
    setAllLines([]);
    setLineQuery('');
    setLineResults([]);
    setStep('search');
    try {
      const lines = await getLineas(c.idConsorcio);
      setAllLines(lines);
    } catch { /* non-fatal */ }
  }

  function handleLineInput(val: string) {
    setLineQuery(val);
    const q = normalize(val.trim());
    if (!q) { setLineResults([]); setNoLinesFound(false); return; }
    const matches = allLines.filter(l =>
      normalize(l.codigo || '').includes(q) || normalize(l.nombre || '').includes(q)
    ).slice(0, 12);
    setLineResults(matches);
    setNoLinesFound(matches.length === 0);
  }

  async function openLineTimetable(line: Linea) {
    setCurrentLine(line);
    setLineQuery(line.codigo || '');
    setLineResults([]);
    setStep('grid');
    setGridLoading(true);
    setGridError(false);
    setTtData(null);
    setAvailableFreqs([]);
    setActiveFreqId(null);
    setActiveDir('ida');

    try {
      const today = new Date();
      const dia = today.getDate();
      const mes = today.getMonth() + 1;
      const cid = currentConsorcio!.idConsorcio;

      const globalFreqs = await getGlobalFrecuencias(cid);

      const probeResults = await Promise.all(
        globalFreqs.map(async gf => {
          try {
            const d = await fetch(
              `${API}/${cid}/horarios_lineas?idLinea=${line.idLinea}&idFrecuencia=${gf.idFreq}&dia=${dia}&mes=${mes}`
            ).then(r => r.json()) as TimetableResponse & { frecuencias?: FreqOption[] };
            const hasData = (d.planificadores || []).length > 0;
            const freqsInResp: FreqOption[] = (d as TimetableResponse & { frecuencias?: FreqOption[] }).frecuencias || [];
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
            if (!seenIds.has(f.idfrecuencia)) { seenIds.add(f.idfrecuencia); freqs.push(f); }
          }
        } else {
          if (!seenIds.has(r.idFreq)) {
            seenIds.add(r.idFreq);
            freqs.push({ idfrecuencia: r.idFreq, acronimo: r.gf.acronimo, nombre: r.gf.nombre });
          }
        }
      }

      if (!freqs.length) { setGridLoading(false); return; }
      setAvailableFreqs(freqs);
      setActiveFreqId(freqs[0].idfrecuencia);
      // loadGrid will be triggered by useEffect on activeFreqId
    } catch {
      setGridError(true);
      setGridLoading(false);
    }
  }

  async function loadGrid(cid: string, lineId: string, freqId: string) {
    setGridLoading(true);
    try {
      const today = new Date();
      const dia = String(today.getDate()).padStart(2, '0');
      const mes = String(today.getMonth() + 1).padStart(2, '0');
      const data = await fetch(
        `${API}/${cid}/horarios_lineas?idLinea=${lineId}&idFrecuencia=${freqId}&dia=${dia}&mes=${mes}`
      ).then(r => r.json()) as TimetableResponse;
      setTtData(data);
      const planif = (data.planificadores || [])[0];
      if (planif) {
        const hasIda = (planif.bloquesIda || []).some(b => b.tipo !== '1');
        const hasVuelta = (planif.bloquesVuelta || []).some(b => b.tipo !== '1');
        if (!hasIda && hasVuelta) setActiveDir('vuelta');
        else setActiveDir('ida');
      }
    } catch { setGridError(true); }
    finally { setGridLoading(false); }
  }

  const planif = (ttData?.planificadores || [])[0];
  const bloques: HorarioBloque[] = planif ? (activeDir === 'ida' ? planif.bloquesIda : planif.bloquesVuelta) || [] : [];
  const horario: HorarioTrip[] = planif ? (activeDir === 'ida' ? planif.horarioIda : planif.horarioVuelta) || [] : [];
  const stopRows = bloques.filter(b => b.tipo !== '1');
  const stopIndices: number[] = [];
  bloques.forEach((b, i) => { if (b.tipo !== '1') stopIndices.push(i); });
  const firstStopIdx = stopIndices[0] ?? 0;
  const hasIda = planif ? (planif.bloquesIda || []).some(b => b.tipo !== '1') : false;
  const hasVuelta = planif ? (planif.bloquesVuelta || []).some(b => b.tipo !== '1') : false;

  return (
    <>
      <AppHeader title={t.title} backHref="/" />
      <main className="main-content">

        {/* Region step */}
        {step === 'region' && (
          <div className="step active" id="ltt-region-wrapper">
            <div className="step-label" id="ltt-region-label">{t.regionLabel}</div>
            {consortiumsLoading ? <LoadingSpinner /> : (
              <div className="card-list" id="ltt-region-list">
                {consortiums.map(c => (
                  <div key={c.idConsorcio} className="card" onClick={() => selectRegion(c)}>
                    <div className="card-icon">{CONSORTIUM_ICONS[c.idConsorcio] || '🚌'}</div>
                    <div className="card-body">
                      <div className="card-title">{c.nombre}</div>
                      <div className="card-sub">{c.nombreCorto}</div>
                    </div>
                    <span className="card-arrow">›</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search step */}
        {step === 'search' && currentConsorcio && (
          <div className="step active" id="ltt-search-form">
            {defaultChipVisible && (
              <DefaultRegionChip consorcio={currentConsorcio} onChangeRegion={() => { setDefaultChipVisible(false); setStep('region'); }} />
            )}
            {!defaultChipVisible && (
              <button className="back-link" id="ltt-back-region" style={{ marginBottom: 12 }} onClick={() => setStep('region')}>
                {t.backRegion}
              </button>
            )}
            <div className="ltt-chosen-region" id="ltt-chosen-region">{currentConsorcio.nombre}</div>
            <p className="hint" id="ltt-search-hint">{t.searchHint}</p>
            <div className="planner-input-wrap">
              <input
                className="planner-input ltt-line-input"
                id="ltt-line-input"
                type="text"
                placeholder={t.searchPlaceholder}
                value={lineQuery}
                onChange={e => handleLineInput(e.target.value)}
                onBlur={() => setTimeout(() => setLineResults([]), 200)}
                autoComplete="off"
              />
              {(lineResults.length > 0 || noLinesFound) && (
                <div className="planner-dropdown" id="ltt-line-results">
                  {noLinesFound ? (
                    <div className="planner-dropdown-item ltt-no-results">{t.noLines}</div>
                  ) : lineResults.map(line => (
                    <div
                      key={line.idLinea}
                      className="planner-dropdown-item ltt-line-item"
                      onMouseDown={e => { e.preventDefault(); openLineTimetable(line); }}
                    >
                      <span className="ltt-dropdown-badge">{line.codigo || ''}</span> {line.nombre || ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid step */}
        {step === 'grid' && currentLine && (
          <div className="step active" id="ltt-step-grid">
            <button className="back-link" id="ltt-back-search" style={{ marginBottom: 12 }} onClick={() => { setStep('search'); setTtData(null); }}>
              {t.backSearch}
            </button>
            <div className="ltt-line-header">
              <span className="ltt-line-badge" id="ltt-line-badge">{currentLine.codigo || ''}</span>
              <span className="ltt-line-name" id="ltt-line-name">{currentLine.nombre || ''}</span>
            </div>
            <div className="ltt-line-region" id="ltt-line-region">{currentConsorcio?.nombre || ''}</div>

            {/* Freq tabs */}
            {availableFreqs.length > 1 && (
              <div className="tt-freq-tabs" id="ltt-freq-tabs">
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
            {hasIda && hasVuelta && (
              <div className="direction-tabs" id="ltt-direction-tabs">
                <button className={`direction-tab${activeDir === 'ida' ? ' active' : ''}`} onClick={() => setActiveDir('ida')}>{t.outbound}</button>
                <button className={`direction-tab${activeDir === 'vuelta' ? ' active' : ''}`} onClick={() => setActiveDir('vuelta')}>{t.inbound}</button>
              </div>
            )}

            {/* Grid */}
            <div className="tt-grid-wrapper" id="ltt-grid-wrapper">
              {gridLoading ? <LoadingSpinner /> :
               gridError ? <p className="tt-no-data">{t.noConn}</p> :
               (!stopRows.length || !horario.length) ? <p className="tt-no-data">{t.noData}</p> : (
                <table className="tt-grid">
                  <thead>
                    <tr>
                      <th>{t.stop}</th>
                      {horario.map((trip, i) => {
                        const time = trip.horas?.[firstStopIdx];
                        return <th key={i}>{(time && time !== '--') ? time : '·'}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {stopRows.map((stop, rowIdx) => {
                      const horasIdx = stopIndices[rowIdx];
                      return (
                        <tr key={rowIdx}>
                          <td className="tt-stop-name">{stop.nombre || ''}</td>
                          {horario.map((trip, i) => {
                            const time = trip.horas?.[horasIdx];
                            return (
                              <td key={i} className={(!time || time === '--') ? 'tt-cell-empty' : ''}>
                                {(time && time !== '--') ? time : '·'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
