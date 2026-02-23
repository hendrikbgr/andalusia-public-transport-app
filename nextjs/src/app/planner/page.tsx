'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DefaultRegionChip from '@/components/ui/DefaultRegionChip';
import { useLang } from '@/contexts/LangContext';
import { PLANNER_STRINGS } from '@/lib/i18n';
import { getDefaultRegion } from '@/lib/i18n';
import { API, CONSORTIUM_ICONS } from '@/lib/constants';
import { getConsorcios, getNucleos, getHorariosOrigenDestino, type Consorcio, type Nucleo, type HorariosResponse } from '@/lib/api';

type Step = 'region' | 'form' | 'results';
type DateMode = 'today' | 'tomorrow' | 'pick';

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getSearchDate(mode: DateMode, pickedDate: Date | null): Date {
  if (mode === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (mode === 'pick' && pickedDate) return pickedDate;
  return new Date();
}

interface HorarioTrip {
  codigo: string;
  idlinea: string;
  dias: string;
  horas: string[];
}

interface PlannerResult {
  trip: HorarioTrip;
  depTime: Date;
  mins: number;
  departureStr: string;
  arrivalStr: string | null;
  stopNames: string[];
  originIndices: number[];
  destIndices: number[];
}

export default function PlannerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLang();
  const t = PLANNER_STRINGS[lang];

  // Restore params
  const initC = searchParams.get('c');
  const initFromN = searchParams.get('fromN');
  const initToN = searchParams.get('toN');
  const initDate = searchParams.get('date') as DateMode | null;

  const [step, setStep] = useState<Step>('region');
  const [consortiums, setConsortiums] = useState<Consorcio[]>([]);
  const [consortiumsLoading, setConsortiumsLoading] = useState(true);
  const [currentConsorcio, setCurrentConsorcio] = useState<Consorcio | null>(null);
  const [allNucleos, setAllNucleos] = useState<Nucleo[]>([]);
  const [fromVal, setFromVal] = useState('');
  const [toVal, setToVal] = useState('');
  const [selectedFrom, setSelectedFrom] = useState<Nucleo | null>(null);
  const [selectedTo, setSelectedTo] = useState<Nucleo | null>(null);
  const [fromDropdown, setFromDropdown] = useState<Nucleo[]>([]);
  const [toDropdown, setToDropdown] = useState<Nucleo[]>([]);
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlannerResult[]>([]);
  const [directResults, setDirectResults] = useState<PlannerResult[]>([]);
  const [resultsSummary, setResultsSummary] = useState('');
  const [noResults, setNoResults] = useState(false);
  const [defaultChipVisible, setDefaultChipVisible] = useState(false);
  const [resultsError, setResultsError] = useState(false);

  const fromTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load consortiums
  useEffect(() => {
    loadConsortiums();
  }, []);

  // Restore search from URL params
  useEffect(() => {
    if (initC && initFromN && initToN) {
      if (initDate === 'tomorrow' || initDate === 'today') setDateMode(initDate);
      restoreSearch(initC, initFromN, initToN);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadConsortiums() {
    setConsortiumsLoading(true);
    try {
      const data = await getConsorcios();
      setConsortiums(data);
      // Auto-select default region
      const dr = getDefaultRegion();
      if (dr) {
        const match = data.find(c => String(c.idConsorcio) === String(dr.idConsorcio));
        if (match) {
          setDefaultChipVisible(true);
          await selectRegion(match);
          return;
        }
      }
    } catch { /* handled in render */ }
    finally { setConsortiumsLoading(false); }
  }

  async function selectRegion(c: Consorcio) {
    setCurrentConsorcio(c);
    setSelectedFrom(null);
    setSelectedTo(null);
    setFromVal('');
    setToVal('');
    setStep('form');
    try {
      const nucleos = await getNucleos(c.idConsorcio);
      setAllNucleos(nucleos);
    } catch { /* non-fatal */ }
  }

  async function restoreSearch(cId: string, fromId: string, toId: string) {
    try {
      const [consorcios, nucleos] = await Promise.all([
        getConsorcios(),
        getNucleos(cId),
      ]);
      const consorcio = consorcios.find(c => String(c.idConsorcio) === String(cId));
      if (!consorcio) return;
      setCurrentConsorcio(consorcio);
      setAllNucleos(nucleos);
      const from = nucleos.find(n => String(n.idNucleo) === String(fromId));
      const to = nucleos.find(n => String(n.idNucleo) === String(toId));
      if (!from || !to) return;
      setSelectedFrom(from);
      setSelectedTo(to);
      setFromVal(from.nombre);
      setToVal(to.nombre);
      await runSearch(consorcio, from, to, dateMode, pickedDate);
    } catch { /* fallback to region step */ }
  }

  function handleFromInput(val: string) {
    setFromVal(val);
    setSelectedFrom(null);
    if (fromTimeoutRef.current) clearTimeout(fromTimeoutRef.current);
    fromTimeoutRef.current = setTimeout(() => {
      const q = normalize(val.trim());
      if (!q) { setFromDropdown([]); return; }
      setFromDropdown(allNucleos.filter(n => normalize(n.nombre).includes(q)).slice(0, 10));
    }, 180);
  }

  function handleToInput(val: string) {
    setToVal(val);
    setSelectedTo(null);
    if (toTimeoutRef.current) clearTimeout(toTimeoutRef.current);
    toTimeoutRef.current = setTimeout(() => {
      const q = normalize(val.trim());
      if (!q) { setToDropdown([]); return; }
      setToDropdown(allNucleos.filter(n => normalize(n.nombre).includes(q)).slice(0, 10));
    }, 180);
  }

  function swapFromTo() {
    const tmpVal = fromVal;
    const tmpSel = selectedFrom;
    setFromVal(toVal);
    setSelectedFrom(selectedTo);
    setToVal(tmpVal);
    setSelectedTo(tmpSel);
  }

  function buildFreqMap(data: HorariosResponse, now: Date) {
    const dow = now.getDay();
    const isWeekday = dow >= 1 && dow <= 5;
    const isSat = dow === 6;
    const isSun = dow === 0;
    const map: Record<string, boolean> = {};
    (data.frecuencias || []).forEach((f: { acronimo: string; nombre: string }) => {
      const acr = f.acronimo.trim();
      const name = (f.nombre || '').toLowerCase();
      let runs = false;
      if (name.includes('monday to friday') || name.includes('lunes a viernes')) runs = isWeekday;
      else if (name.includes('monday to saturday') || name.includes('lunes a sábado') || name.includes('lunes a sabado')) runs = isWeekday || isSat;
      else if ((name.includes('saturday') && name.includes('sunday')) || (name.includes('sábado') && name.includes('domingo'))) runs = isSat || isSun;
      else if (name.includes('saturday') || name.includes('sábado')) runs = isSat;
      else if (name.includes('sunday') || name.includes('domingo')) runs = isSun;
      else runs = true;
      map[acr] = runs;
    });
    return map;
  }

  function parseIndices(data: HorariosResponse) {
    const nucleos = data.nucleos || [];
    let colOffset = 0;
    let originIndices: number[] = [];
    let destIndices: number[] = [];
    for (let i = 0; i < nucleos.length; i++) {
      const span = nucleos[i].colspan || 1;
      if (i === 0) continue;
      const indices = Array.from({ length: span }, (_, k) => colOffset + k);
      if (i === 1) originIndices = indices;
      else if (i === 2) destIndices = indices;
      colOffset += span;
    }
    if (!originIndices.length) originIndices = [0];
    const firstHoraLen = (data.horario?.[0]?.horas || []).length;
    if (!destIndices.length) destIndices = [firstHoraLen - 1];
    return { originIndices, destIndices };
  }

  async function runSearch(
    consorcio: Consorcio,
    from: Nucleo,
    to: Nucleo,
    mode: DateMode,
    picked: Date | null,
  ) {
    setStep('results');
    setSearching(true);
    setNoResults(false);
    setResults([]);
    setDirectResults([]);
    setResultsError(false);
    setResultsSummary(`${from.nombre}  →  ${to.nombre}`);

    try {
      const now = getSearchDate(mode, picked);
      const data = await getHorariosOrigenDestino(consorcio.idConsorcio, from.idNucleo, to.idNucleo);
      const horario = data.horario || [];
      const bloques = data.bloques || [];
      const stopNames = bloques.slice(1, -1).map(b => b.nombre.trim());
      const { originIndices, destIndices } = parseIndices(data);
      const freqMap = buildFreqMap(data, now);

      const enriched: PlannerResult[] = horario.map((trip: HorarioTrip) => {
        let depStr: string | null = null;
        for (const idx of originIndices) {
          const h = trip.horas[idx];
          if (h && h !== '--') { depStr = h; break; }
        }
        if (!depStr) return null;
        const [hh, mm] = depStr.split(':').map(Number);
        if (isNaN(hh) || isNaN(mm)) return null;
        const depTime = new Date(now);
        depTime.setHours(hh, mm, 0, 0);
        let arrStr: string | null = null;
        for (const idx of [...destIndices].reverse()) {
          const h = trip.horas[idx];
          if (h && h !== '--') { arrStr = h; break; }
        }
        const dias = (trip.dias || '').trim();
        const runsToday = dias in freqMap ? freqMap[dias] : true;
        const realNow = new Date();
        const mins = Math.round((depTime.getTime() - realNow.getTime()) / 60000);
        return { trip, depTime, mins, departureStr: depStr, arrivalStr: arrStr, stopNames, originIndices, destIndices, runsToday };
      })
      .filter((x): x is PlannerResult & { runsToday: boolean } => {
        if (!x || !x.runsToday) return false;
        return mode === 'today' ? x.mins > -5 : true;
      })
      .sort((a, b) => a.depTime.getTime() - b.depTime.getTime())
      .slice(0, 12);

      if (!enriched.length) { setNoResults(true); }
      else setResults(enriched);

      // Direct connections (all day)
      const allTrips: PlannerResult[] = horario.map((trip: HorarioTrip) => {
        let depStr: string | null = null;
        for (const idx of originIndices) {
          const h = trip.horas[idx];
          if (h && h !== '--') { depStr = h; break; }
        }
        if (!depStr) return null;
        const [hh, mm] = depStr.split(':').map(Number);
        if (isNaN(hh) || isNaN(mm)) return null;
        const depTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
        let arrStr: string | null = null;
        for (const idx of [...destIndices].reverse()) {
          const h = trip.horas[idx];
          if (h && h !== '--') { arrStr = h; break; }
        }
        const dias = (trip.dias || '').trim();
        const runsToday = dias in freqMap ? freqMap[dias] : true;
        if (!runsToday) return null;
        return { trip, depTime, mins: 0, departureStr: depStr, arrivalStr: arrStr, stopNames, originIndices, destIndices };
      })
      .filter((x): x is PlannerResult => x !== null)
      .sort((a, b) => a.depTime.getTime() - b.depTime.getTime());
      setDirectResults(allTrips);
    } catch {
      setResultsError(true);
    } finally {
      setSearching(false);
    }
  }

  const canSearch = selectedFrom && selectedTo && selectedFrom.idNucleo !== selectedTo.idNucleo;

  return (
    <>
      <AppHeader title={t.plannerTitle} backHref="/" />
      <main className="main-content">

        {/* Region step */}
        {step === 'region' && (
          <div className="step active" id="step-region">
            <div className="step-label" id="label-region">{t.labelRegion}</div>
            {consortiumsLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="card-list" id="planner-region-list">
                {consortiums.map(c => (
                  <div
                    key={c.idConsorcio}
                    className="card"
                    onClick={async () => { await selectRegion(c); }}
                  >
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

        {/* Form step */}
        {step === 'form' && currentConsorcio && (
          <div className="step active" id="step-form">
            {defaultChipVisible && (
              <DefaultRegionChip
                consorcio={currentConsorcio}
                onChangeRegion={() => { setDefaultChipVisible(false); setStep('region'); }}
              />
            )}
            {!defaultChipVisible && (
              <button className="back-link" style={{ marginBottom: 12 }} onClick={() => setStep('region')}>
                {t.backRegion}
              </button>
            )}
            <div className="planner-region-label" id="planner-region-label">{currentConsorcio.nombre}</div>

            {/* Date mode */}
            <div className="date-mode-row">
              <button className={`date-btn${dateMode === 'today' ? ' active' : ''}`} onClick={() => { setDateMode('today'); setShowDatePicker(false); }}>
                {t.dateToday}
              </button>
              <button className={`date-btn${dateMode === 'tomorrow' ? ' active' : ''}`} onClick={() => { setDateMode('tomorrow'); setShowDatePicker(false); }}>
                {t.dateTomorrow}
              </button>
              <button className={`date-btn${dateMode === 'pick' ? ' active' : ''}`} onClick={() => { setDateMode('pick'); setShowDatePicker(true); }}>
                {t.datePick}
              </button>
            </div>
            {showDatePicker && (
              <input
                type="date"
                className="date-picker-input"
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => {
                  if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setPickedDate(new Date(y, m - 1, d, 0, 0, 0, 0));
                  }
                }}
              />
            )}

            {/* From/To inputs */}
            <div className="planner-form">
              <div className="planner-field">
                <label className="planner-label" id="label-from">{t.labelFrom}</label>
                <div className="planner-input-wrap">
                  <input
                    className="planner-input"
                    id="from-input"
                    type="text"
                    placeholder={t.placeholder}
                    value={fromVal}
                    onChange={e => handleFromInput(e.target.value)}
                    onFocus={() => {
                      if (fromVal.trim()) {
                        const q = normalize(fromVal.trim());
                        setFromDropdown(allNucleos.filter(n => normalize(n.nombre).includes(q)).slice(0, 10));
                      }
                    }}
                    onBlur={() => setTimeout(() => setFromDropdown([]), 200)}
                    autoComplete="off"
                  />
                  {fromDropdown.length > 0 && (
                    <div className="planner-dropdown" id="from-results">
                      {fromDropdown.map(n => (
                        <div
                          key={n.idNucleo}
                          className="planner-dropdown-item"
                          onMouseDown={e => {
                            e.preventDefault();
                            setSelectedFrom(n);
                            setFromVal(n.nombre);
                            setFromDropdown([]);
                          }}
                        >{n.nombre}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button className="swap-btn" id="swap-btn" onClick={swapFromTo}>⇅</button>

              <div className="planner-field">
                <label className="planner-label" id="label-to">{t.labelTo}</label>
                <div className="planner-input-wrap">
                  <input
                    className="planner-input"
                    id="to-input"
                    type="text"
                    placeholder={t.placeholder}
                    value={toVal}
                    onChange={e => handleToInput(e.target.value)}
                    onFocus={() => {
                      if (toVal.trim()) {
                        const q = normalize(toVal.trim());
                        setToDropdown(allNucleos.filter(n => normalize(n.nombre).includes(q)).slice(0, 10));
                      }
                    }}
                    onBlur={() => setTimeout(() => setToDropdown([]), 200)}
                    autoComplete="off"
                  />
                  {toDropdown.length > 0 && (
                    <div className="planner-dropdown" id="to-results">
                      {toDropdown.map(n => (
                        <div
                          key={n.idNucleo}
                          className="planner-dropdown-item"
                          onMouseDown={e => {
                            e.preventDefault();
                            setSelectedTo(n);
                            setToVal(n.nombre);
                            setToDropdown([]);
                          }}
                        >{n.nombre}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                className="search-btn"
                id="search-btn"
                disabled={!canSearch}
                onClick={() => {
                  if (currentConsorcio && selectedFrom && selectedTo) {
                    runSearch(currentConsorcio, selectedFrom, selectedTo, dateMode, pickedDate);
                  }
                }}
              >
                <span id="search-btn-text">{t.searchBtn}</span>
              </button>
            </div>
          </div>
        )}

        {/* Results step */}
        {step === 'results' && (
          <div className="step active" id="step-results">
            <button className="back-link" style={{ marginBottom: 12 }} onClick={() => setStep('form')}>
              {t.backForm}
            </button>
            <div className="route-summary" id="route-summary">{resultsSummary}</div>
            <div className="results-label" id="results-label">{t.resultsLabel(dateMode)}</div>

            <div className="card-list" id="results-list">
              {searching && <LoadingSpinner />}
              {resultsError && <p className="hint">{t.noConn}</p>}
              {!searching && noResults && (
                <div id="results-no-service">
                  <p id="results-no-service-text">{t.noRoutes}</p>
                  <p className="hint" id="results-no-service-hint">{t.noRoutesHint}</p>
                </div>
              )}
              {!searching && results.map((r, i) => {
                const showCountdown = dateMode === 'today';
                const via = r.trip.horas
                  .map((h: string, idx: number) => {
                    if (r.originIndices.includes(idx) || r.destIndices.includes(idx)) return null;
                    if (!h || h === '--') return null;
                    return r.stopNames[idx - 1] || null;
                  })
                  .filter(Boolean).join(', ');
                return (
                  <div
                    key={i}
                    className="card planner-result-card"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (!currentConsorcio || !selectedFrom || !selectedTo) return;
                      const plannerBack = `/planner?c=${currentConsorcio.idConsorcio}&fromN=${selectedFrom.idNucleo}&toN=${selectedTo.idNucleo}`;
                      router.push(
                        `/route?c=${currentConsorcio.idConsorcio}&l=${r.trip.idlinea}` +
                        `&code=${encodeURIComponent(r.trip.codigo)}` +
                        `&dest=${encodeURIComponent(selectedTo?.nombre || '')}` +
                        `&sentido=1&from=${encodeURIComponent(plannerBack)}`
                      );
                    }}
                  >
                    <div className="departure-line">{r.trip.codigo}</div>
                    <div className="departure-body">
                      <div className="departure-dest">{selectedTo?.nombre}</div>
                      {via && <div className="departure-name">{t.passesThrough} {via}</div>}
                      <div className="departure-name planner-days">{r.trip.dias}</div>
                    </div>
                    <div className="departure-time-col">
                      <span className="departure-sched">{r.departureStr}</span>
                      {r.arrivalStr && r.arrivalStr !== '--' && (
                        <span className="planner-arrival">→ {r.arrivalStr}</span>
                      )}
                      {showCountdown && (
                        <span className={`departure-mins ${r.mins <= 2 ? 'mins-now' : r.mins <= 15 ? 'mins-soon' : 'mins-later'}`}>
                          {t.minsLabel(r.mins)}
                        </span>
                      )}
                    </div>
                    <span className="departure-info-arrow">›</span>
                  </div>
                );
              })}
            </div>

            {/* Direct connections (all day) */}
            {!searching && directResults.length > 0 && (
              <div id="direct-section">
                <div className="direct-section-label" id="direct-section-label">
                  {t.directConnections(dateMode)}
                </div>
                <div className="card-list" id="direct-list">
                  {directResults.map((r, i) => {
                    const isPast = r.depTime < new Date();
                    return (
                      <div
                        key={i}
                        className={`card direct-result-card${isPast ? ' direct-result-past' : ''}`}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (!currentConsorcio || !selectedFrom || !selectedTo) return;
                          const plannerBack = `/planner?c=${currentConsorcio.idConsorcio}&fromN=${selectedFrom.idNucleo}&toN=${selectedTo.idNucleo}`;
                          router.push(
                            `/route?c=${currentConsorcio.idConsorcio}&l=${r.trip.idlinea}` +
                            `&code=${encodeURIComponent(r.trip.codigo || '')}` +
                            `&dest=${encodeURIComponent(selectedTo?.nombre || '')}` +
                            `&sentido=1&from=${encodeURIComponent(plannerBack)}`
                          );
                        }}
                      >
                        <div className="departure-line">{r.trip.codigo || ''}</div>
                        <div className="departure-body">
                          <div className="departure-dest">{selectedTo?.nombre || ''}</div>
                          <div className="departure-name planner-days">{r.trip.dias || ''}</div>
                        </div>
                        <div className="departure-time-col">
                          <span className="departure-sched">{r.departureStr}</span>
                          {r.arrivalStr && <span className="planner-arrival">→ {r.arrivalStr}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
