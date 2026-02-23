'use client';

import { useState, useEffect, useRef } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DefaultRegionChip from '@/components/ui/DefaultRegionChip';
import { useLang } from '@/contexts/LangContext';
import { JOURNEY_STRINGS } from '@/lib/i18n';
import { getDefaultRegion } from '@/lib/i18n';
import { API, CONSORTIUM_ICONS } from '@/lib/constants';
import { getConsorcios, getNucleos, getLineas, type Consorcio, type Nucleo } from '@/lib/api';

type Step = 'region' | 'form' | 'results';
type DateMode = 'today' | 'tomorrow' | 'pick';

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getSearchDate(mode: DateMode, pickedDate: Date | null): Date {
  if (mode === 'tomorrow') {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d;
  }
  if (mode === 'pick' && pickedDate) return pickedDate;
  return new Date();
}

interface JourneyTrip {
  codigo?: string;
  idlinea?: string;
  dias?: string;
  depStr: string;
  depTime: Date;
  arrStr?: string;
  arrTime?: Date;
  mins: number;
}

interface Itinerary {
  type: 'direct' | 'transfer';
  leg1: JourneyTrip;
  leg2?: JourneyTrip;
  transferNucleo?: Nucleo;
  waitMins?: number;
  totalDeparture: Date;
  totalArrival?: Date;
}

interface OutOfNetworkDest {
  nombre: string;
  idNucleo: null;
  isOutOfNetwork: true;
}

type SelectedNucleo = Nucleo | OutOfNetworkDest;

interface SheetData {
  html: string;
  itin?: Itinerary;
  oonLine?: { idLinea: string; codigo: string; nombre: string };
}

const MIN_TRANSFER_MINS = 10;
const LEG_COLORS = ['#27ae60', '#e7231e'];

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildFreqMap(frecuencias: Array<{ acronimo: string; nombre: string }>, now: Date) {
  const dow = now.getDay();
  const isWeekday = dow >= 1 && dow <= 5;
  const isSat = dow === 6;
  const isSun = dow === 0;
  const map: Record<string, boolean> = {};
  frecuencias.forEach(f => {
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

function parseNucleosIndices(data: { nucleos?: Array<{ colspan?: number }>; horario?: Array<{ horas: string[] }> }) {
  const nucleos = data.nucleos || [];
  let colOffset = 0; let originIndices: number[] = []; let destIndices: number[] = [];
  for (let i = 0; i < nucleos.length; i++) {
    const span = nucleos[i].colspan || 1;
    if (i === 0) continue;
    const indices = Array.from({ length: span }, (_, k) => colOffset + k);
    if (i === 1) originIndices = indices;
    else if (i === 2) destIndices = indices;
    colOffset += span;
  }
  if (!originIndices.length) originIndices = [0];
  if (!destIndices.length) destIndices = [(data.horario?.[0]?.horas?.length ?? 1) - 1];
  return { originIndices, destIndices };
}

function extractTrips(data: {
  horario?: Array<{ codigo?: string; idlinea?: string; dias?: string; horas: string[] }>;
  frecuencias?: Array<{ acronimo: string; nombre: string }>;
  nucleos?: Array<{ colspan?: number }>;
}, now: Date, allDay = false): JourneyTrip[] {
  const horario = data.horario || [];
  if (!horario.length) return [];
  const freqMap = buildFreqMap(data.frecuencias || [], now);
  const { originIndices, destIndices } = parseNucleosIndices(data);
  const realNow = new Date();

  return horario.map(trip => {
    let depStr: string | null = null;
    for (const idx of originIndices) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { depStr = h; break; }
    }
    if (!depStr) return null;
    const [hh, mm] = depStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;
    const depTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    let arrStr: string | null = null;
    for (const idx of [...destIndices].reverse()) {
      const h = trip.horas?.[idx];
      if (h && h !== '--') { arrStr = h; break; }
    }
    let arrTime: Date | undefined;
    if (arrStr) {
      const [ah, am] = arrStr.split(':').map(Number);
      if (!isNaN(ah) && !isNaN(am)) {
        arrTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ah, am, 0, 0);
        if (arrTime < depTime) arrTime.setDate(arrTime.getDate() + 1);
      }
    }
    const dias = (trip.dias || '').trim();
    const runsToday = dias in freqMap ? freqMap[dias] : true;
    if (!runsToday) return null;
    const mins = Math.round((depTime.getTime() - realNow.getTime()) / 60000);
    if (!allDay && mins < -5) return null;
    return { codigo: trip.codigo, idlinea: trip.idlinea, dias: trip.dias, depStr, depTime, arrStr: arrStr || undefined, arrTime, mins };
  }).filter((x): x is JourneyTrip => x !== null)
    .sort((a, b) => a.depTime.getTime() - b.depTime.getTime());
}

export default function JourneyPage() {
  const { lang } = useLang();
  const t = JOURNEY_STRINGS[lang];

  const [step, setStep] = useState<Step>('region');
  const [consortiums, setConsortiums] = useState<Consorcio[]>([]);
  const [consortiumsLoading, setConsortiumsLoading] = useState(true);
  const [currentConsorcio, setCurrentConsorcio] = useState<Consorcio | null>(null);
  const [allNucleos, setAllNucleos] = useState<Nucleo[]>([]);
  const [fromVal, setFromVal] = useState('');
  const [toVal, setToVal] = useState('');
  const [selectedFrom, setSelectedFrom] = useState<SelectedNucleo | null>(null);
  const [selectedTo, setSelectedTo] = useState<SelectedNucleo | null>(null);
  const [fromDropdown, setFromDropdown] = useState<Nucleo[]>([]);
  const [toDropdown, setToDropdown] = useState<Array<Nucleo | { ghost: true; label: string }>>([]);
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searching, setSearching] = useState(false);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [oonLines, setOonLines] = useState<Array<{ idLinea: string; codigo: string; nombre: string }>>([]);
  const [resultsSummary, setResultsSummary] = useState('');
  const [noResults, setNoResults] = useState(false);
  const [resultsError, setResultsError] = useState(false);
  const [defaultChipVisible, setDefaultChipVisible] = useState(false);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const allConsorcioLinesRef = useRef<Array<{ idLinea: string; codigo: string; nombre: string }> | null>(null);
  const fromTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadConsortiums(); }, []);

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
    } catch { /* handled in render */ }
    finally { setConsortiumsLoading(false); }
  }

  async function selectRegion(c: Consorcio) {
    setCurrentConsorcio(c);
    setSelectedFrom(null); setSelectedTo(null);
    setFromVal(''); setToVal('');
    allConsorcioLinesRef.current = null;
    setStep('form');
    try {
      const nucleos = await getNucleos(c.idConsorcio);
      setAllNucleos(nucleos);
    } catch { /* non-fatal */ }
  }

  function handleFromInput(val: string) {
    setFromVal(val); setSelectedFrom(null);
    if (fromTimerRef.current) clearTimeout(fromTimerRef.current);
    fromTimerRef.current = setTimeout(() => {
      const q = normalize(val.trim());
      if (!q) { setFromDropdown([]); return; }
      setFromDropdown(allNucleos.filter(n => normalize(n.nombre).includes(q)).slice(0, 10));
    }, 180);
  }

  function handleToInput(val: string) {
    setToVal(val); setSelectedTo(null);
    if (toTimerRef.current) clearTimeout(toTimerRef.current);
    toTimerRef.current = setTimeout(() => {
      const q = normalize(val.trim());
      if (!q) { setToDropdown([]); return; }
      const matches = allNucleos.filter(n => normalize(n.nombre).includes(q)).slice(0, 10);
      if (!matches.length && q) {
        setToDropdown([{ ghost: true, label: t.outOfNetworkItem(val.trim()) }]);
      } else {
        setToDropdown(matches);
      }
    }, 180);
  }

  function swapFromTo() {
    if ((selectedTo as OutOfNetworkDest)?.isOutOfNetwork) return;
    const tmpVal = fromVal; const tmpSel = selectedFrom;
    setFromVal(toVal); setSelectedFrom(selectedTo);
    setToVal(tmpVal); setSelectedTo(tmpSel);
  }

  const canSearch = selectedFrom && selectedTo &&
    (!(selectedFrom as Nucleo).idNucleo || !(selectedTo as Nucleo).idNucleo ||
      (selectedFrom as Nucleo).idNucleo !== (selectedTo as Nucleo).idNucleo);

  async function findJourneys(origin: Nucleo, dest: Nucleo, now: Date): Promise<Itinerary[]> {
    const cid = currentConsorcio!.idConsorcio;
    const directData = await fetchJSON<{ horario?: Array<{ codigo?: string; idlinea?: string; dias?: string; horas: string[] }>; frecuencias?: Array<{ acronimo: string; nombre: string }>; nucleos?: Array<{ colspan?: number }> }>(
      `${API}/${cid}/horarios_origen_destino?idNucleoOrigen=${origin.idNucleo}&idNucleoDestino=${dest.idNucleo}`
    );
    const directTrips = extractTrips(directData, now);

    if (directTrips.length) {
      return directTrips.slice(0, 5).map(t => ({
        type: 'direct', leg1: t,
        totalDeparture: t.depTime, totalArrival: t.arrTime,
      }));
    }

    const candidates = allNucleos.filter(
      n => String(n.idNucleo) !== String(origin.idNucleo) && String(n.idNucleo) !== String(dest.idNucleo)
    );

    const probeResults = await Promise.all(
      candidates.map(async candidate => {
        try {
          const [l1, l2] = await Promise.all([
            fetchJSON<typeof directData>(`${API}/${cid}/horarios_origen_destino?idNucleoOrigen=${origin.idNucleo}&idNucleoDestino=${candidate.idNucleo}`),
            fetchJSON<typeof directData>(`${API}/${cid}/horarios_origen_destino?idNucleoOrigen=${candidate.idNucleo}&idNucleoDestino=${dest.idNucleo}`),
          ]);
          const l1Trips = extractTrips(l1, now);
          const l2Trips = extractTrips(l2, now, true);
          if (!l1Trips.length || !l2Trips.length) return null;
          return { candidate, leg1Trips: l1Trips, leg2Trips: l2Trips };
        } catch { return null; }
      })
    );

    const valid = probeResults.filter((x): x is { candidate: Nucleo; leg1Trips: JourneyTrip[]; leg2Trips: JourneyTrip[] } => x !== null);
    if (!valid.length) return [];

    const itins: Itinerary[] = [];
    for (const { candidate, leg1Trips, leg2Trips } of valid) {
      for (const leg1 of leg1Trips) {
        const arrAtTransfer = leg1.arrTime || new Date(leg1.depTime.getTime() + 30 * 60000);
        const earliest = new Date(arrAtTransfer.getTime() + MIN_TRANSFER_MINS * 60000);
        const leg2 = leg2Trips.find(l => l.depTime >= earliest);
        if (leg2) {
          const waitMins = Math.round((leg2.depTime.getTime() - arrAtTransfer.getTime()) / 60000);
          itins.push({ type: 'transfer', leg1, leg2, transferNucleo: candidate, waitMins, totalDeparture: leg1.depTime, totalArrival: leg2.arrTime });
          break;
        }
      }
    }

    itins.sort((a, b) => (a.totalArrival || a.totalDeparture).getTime() - (b.totalArrival || b.totalDeparture).getTime());
    return itins.slice(0, 5);
  }

  async function runOutOfNetworkSearch(origin: Nucleo, destName: string) {
    const cid = currentConsorcio!.idConsorcio;
    const normDest = normalize(destName);
    if (!allConsorcioLinesRef.current) {
      const lines = await getLineas(cid);
      allConsorcioLinesRef.current = lines as typeof allConsorcioLinesRef.current;
    }
    const matching = (allConsorcioLinesRef.current || []).filter(l => normalize(l.nombre || '').includes(normDest));
    if (!matching.length) { setNoResults(true); return; }
    setOonLines(matching);
  }

  async function runSearch() {
    if (!selectedFrom || !selectedTo || !currentConsorcio) return;
    setStep('results');
    setSearching(true);
    setNoResults(false);
    setItineraries([]);
    setOonLines([]);
    setResultsError(false);
    setResultsSummary(`${selectedFrom.nombre}  →  ${selectedTo.nombre}`);
    const now = getSearchDate(dateMode, pickedDate);

    try {
      if ((selectedTo as OutOfNetworkDest).isOutOfNetwork) {
        await runOutOfNetworkSearch(selectedFrom as Nucleo, selectedTo.nombre);
      } else {
        const found = await findJourneys(selectedFrom as Nucleo, selectedTo as Nucleo, now);
        if (!found.length) setNoResults(true);
        else setItineraries(found);
      }
    } catch { setResultsError(true); }
    finally { setSearching(false); }
  }

  async function openSheet(itin: Itinerary) {
    const cid = currentConsorcio!.idConsorcio;
    setSheetData({ html: '' });
    setSheetOpen(true);

    try {
      const legs = itin.type === 'direct'
        ? [{ trip: itin.leg1, color: LEG_COLORS[0] }]
        : [{ trip: itin.leg1, color: LEG_COLORS[0] }, { trip: itin.leg2!, color: LEG_COLORS[1] }];

      const polyResults = await Promise.all(legs.map(async ({ trip, color }) => {
        if (!trip.idlinea) return null;
        try {
          const data = await fetchJSON<{ polilinea?: Array<{ lat: number; lon: number }> }>(`${API}/${cid}/lineas/${trip.idlinea}`);
          const poly = data.polilinea || [];
          return poly.length ? { points: poly, color, code: trip.codigo || '', lineaId: String(trip.idlinea) } : null;
        } catch { return null; }
      }));
      const journeyPolys = polyResults.filter(Boolean);
      if (journeyPolys.length) {
        sessionStorage.setItem('journeyPolylines', JSON.stringify(journeyPolys));
        sessionStorage.removeItem('routePolyline');
        sessionStorage.removeItem('routePolylineCode');
        sessionStorage.removeItem('routeLineaId');
      }
      setSheetData({ html: '', itin });
    } catch {
      setSheetData({ html: '', itin });
    }
  }

  async function openOonSheet(line: { idLinea: string; codigo: string; nombre: string }) {
    setSheetData({ html: 'loading', oonLine: line });
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setTimeout(() => setSheetData(null), 280);
  }

  const realNow = new Date();

  return (
    <>
      <AppHeader title={t.journeyTitle} backHref="/" />
      <main className="main-content">

        {/* Region step */}
        {step === 'region' && (
          <div className="step active" id="step-region">
            <div className="step-label" id="label-region">{t.labelRegion}</div>
            {consortiumsLoading ? <LoadingSpinner /> : (
              <div className="card-list" id="journey-region-list">
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

        {/* Form step */}
        {step === 'form' && currentConsorcio && (
          <div className="step active" id="step-form">
            {defaultChipVisible && (
              <DefaultRegionChip consorcio={currentConsorcio} onChangeRegion={() => { setDefaultChipVisible(false); setStep('region'); }} />
            )}
            {!defaultChipVisible && (
              <button className="back-link" style={{ marginBottom: 12 }} onClick={() => setStep('region')}>{t.backRegion}</button>
            )}
            <div className="planner-region-label" id="journey-region-label">{currentConsorcio.nombre}</div>

            <div className="date-mode-row">
              <button className={`date-btn${dateMode === 'today' ? ' active' : ''}`} onClick={() => { setDateMode('today'); setShowDatePicker(false); }}>{t.dateToday}</button>
              <button className={`date-btn${dateMode === 'tomorrow' ? ' active' : ''}`} onClick={() => { setDateMode('tomorrow'); setShowDatePicker(false); }}>{t.dateTomorrow}</button>
              <button className={`date-btn${dateMode === 'pick' ? ' active' : ''}`} onClick={() => { setDateMode('pick'); setShowDatePicker(true); }}>{t.datePick}</button>
            </div>
            {showDatePicker && (
              <input type="date" className="date-picker-input" min={new Date().toISOString().slice(0, 10)}
                onChange={e => { if (e.target.value) { const [y,m,d]=e.target.value.split('-').map(Number); setPickedDate(new Date(y,m-1,d,0,0,0,0)); }}} />
            )}

            <div className="planner-form">
              <div className="planner-field">
                <label className="planner-label">{t.labelFrom}</label>
                <div className="planner-input-wrap">
                  <input className="planner-input" type="text" placeholder={t.placeholder} value={fromVal}
                    onChange={e => handleFromInput(e.target.value)}
                    onFocus={() => { if (fromVal.trim()) { const q=normalize(fromVal.trim()); setFromDropdown(allNucleos.filter(n=>normalize(n.nombre).includes(q)).slice(0,10)); }}}
                    onBlur={() => setTimeout(() => setFromDropdown([]), 200)} autoComplete="off" />
                  {fromDropdown.length > 0 && (
                    <div className="planner-dropdown">
                      {fromDropdown.map(n => (
                        <div key={n.idNucleo} className="planner-dropdown-item"
                          onMouseDown={e => { e.preventDefault(); setSelectedFrom(n); setFromVal(n.nombre); setFromDropdown([]); }}>
                          {n.nombre}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button className="swap-btn" onClick={swapFromTo}>⇅</button>
              <div className="planner-field">
                <label className="planner-label">{t.labelTo}</label>
                <div className="planner-input-wrap">
                  <input className="planner-input" type="text" placeholder={t.placeholder} value={toVal}
                    onChange={e => handleToInput(e.target.value)}
                    onFocus={() => { if (toVal.trim()) handleToInput(toVal); }}
                    onBlur={() => setTimeout(() => setToDropdown([]), 200)} autoComplete="off" />
                  {toDropdown.length > 0 && (
                    <div className="planner-dropdown">
                      {toDropdown.map((item, i) => {
                        if ('ghost' in item) return (
                          <div key="ghost" className="planner-dropdown-item planner-dropdown-ghost"
                            onMouseDown={e => { e.preventDefault(); setSelectedTo({ nombre: toVal.trim(), idNucleo: null, isOutOfNetwork: true }); setToDropdown([]); }}>
                            {item.label}
                          </div>
                        );
                        const n = item as Nucleo;
                        return (
                          <div key={n.idNucleo} className="planner-dropdown-item"
                            onMouseDown={e => { e.preventDefault(); setSelectedTo(n); setToVal(n.nombre); setToDropdown([]); }}>
                            {n.nombre}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <button className="search-btn" disabled={!canSearch} onClick={runSearch}>
                {t.searchBtn}
              </button>
            </div>
          </div>
        )}

        {/* Results step */}
        {step === 'results' && (
          <div className="step active" id="step-results">
            <button className="back-link" style={{ marginBottom: 12 }} onClick={() => setStep('form')}>{t.backForm}</button>
            <div className="route-summary">{resultsSummary}</div>
            <div className="results-label">{t.resultsLabel(dateMode)}</div>

            {searching && (
              <div id="results-loading">
                <LoadingSpinner />
                <p>{t.searching}</p>
              </div>
            )}
            {!searching && resultsError && <p className="hint">{t.noConn}</p>}
            {!searching && noResults && (
              <div id="results-no-service">
                <p>{t.noRoutes}</p>
                <p className="hint">{t.noRoutesHint}</p>
              </div>
            )}

            {/* Normal itineraries */}
            <div className="card-list" id="itinerary-list">
              {!searching && itineraries.map((itin, i) => {
                const leg = itin.leg1;
                const mins = Math.round((leg.depTime.getTime() - realNow.getTime()) / 60000);
                const minsClass = mins <= 2 ? 'mins-now' : mins <= 15 ? 'mins-soon' : 'mins-later';
                const showCountdown = dateMode === 'today';
                return (
                  <div key={i} className={`card journey-card ${itin.type === 'direct' ? 'journey-card-direct' : 'journey-card-transfer'}`}
                    role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => openSheet(itin)}>
                    {itin.type === 'direct' ? (
                      <>
                        <div className="journey-direct-badge">{t.direct}</div>
                        <div className="journey-leg">
                          <div className="journey-leg-body">
                            <div className="departure-line">{leg.codigo || ''}</div>
                            <div className="departure-body">
                              <div className="departure-dest">{selectedTo?.nombre}</div>
                              <div className="departure-name planner-days">{leg.dias || ''}</div>
                            </div>
                            <div className="departure-time-col">
                              <span className="departure-sched">{leg.depStr}</span>
                              {leg.arrStr && <span className="planner-arrival">→ {leg.arrStr}</span>}
                              {showCountdown && <span className={`departure-mins ${minsClass}`}>{t.minsLabel(mins)}</span>}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="journey-leg">
                          <div className="journey-leg-label">{t.leg1Label}</div>
                          <div className="journey-leg-body">
                            <div className="departure-line">{leg.codigo || ''}</div>
                            <div className="departure-body">
                              <div className="departure-dest">{itin.transferNucleo?.nombre}</div>
                              <div className="departure-name planner-days">{leg.dias || ''}</div>
                            </div>
                            <div className="departure-time-col">
                              <span className="departure-sched">{leg.depStr}</span>
                              {leg.arrStr && <span className="planner-arrival">→ {leg.arrStr}</span>}
                              {showCountdown && <span className={`departure-mins ${minsClass}`}>{t.minsLabel(mins)}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="journey-transfer-banner">
                          <span className="journey-transfer-icon">⇄</span>
                          <span className="journey-transfer-text">{t.transfer} {itin.transferNucleo?.nombre}</span>
                          <span className="journey-transfer-wait">{t.transferWait(itin.waitMins || 0)}</span>
                        </div>
                        <div className="journey-leg">
                          <div className="journey-leg-label">{t.leg2Label}</div>
                          <div className="journey-leg-body">
                            <div className="departure-line">{itin.leg2?.codigo || ''}</div>
                            <div className="departure-body">
                              <div className="departure-dest">{selectedTo?.nombre}</div>
                              <div className="departure-name planner-days">{itin.leg2?.dias || ''}</div>
                            </div>
                            <div className="departure-time-col">
                              <span className="departure-sched">{itin.leg2?.depStr}</span>
                              {itin.leg2?.arrStr && <span className="planner-arrival">→ {itin.leg2.arrStr}</span>}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Out-of-network lines */}
            {!searching && oonLines.length > 0 && (
              <div id="results-lines-hint">
                <div className="results-lines-label">{t.linesHeading}</div>
                <div className="card-list" id="results-lines-list">
                  {oonLines.map(line => (
                    <div key={line.idLinea} className="card" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => openOonSheet(line)}>
                      <div className="departure-line" style={{ flexShrink: 0 }}>{line.codigo || line.idLinea}</div>
                      <div className="departure-body">
                        <div className="departure-dest">{line.nombre || ''}</div>
                      </div>
                      <span className="departure-info-arrow">›</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom sheet */}
      {sheetData !== null && (
        <>
          <div className={`journey-sheet-backdrop${sheetOpen ? ' open' : ''}`} onClick={closeSheet} />
          <div className={`journey-detail-sheet${sheetOpen ? ' open' : ''}`} id="journey-detail-sheet">
            <div className="journey-sheet-content" id="journey-sheet-content">
              {sheetData.html === 'loading' ? (
                <LoadingSpinner />
              ) : sheetData.itin ? (
                <JourneySheetContent itin={sheetData.itin} selectedToName={selectedTo?.nombre || ''} lang={lang} t={t} cId={currentConsorcio?.idConsorcio || ''} />
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function JourneySheetContent({ itin, selectedToName, lang: _lang, t, cId }: {
  itin: Itinerary;
  selectedToName: string;
  lang: string;
  t: typeof JOURNEY_STRINGS['en'];
  cId: string;
}) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('journeyPolylines');
    if (stored) setMapUrl(`/map?c=${cId}&polyline=1`);
    else setMapUrl(`/map?c=${cId}`);
  }, [cId]);

  const steps = buildSteps(itin, selectedToName, t);

  return (
    <>
      {steps.map((step, i) => (
        <div key={i} className="journey-step">
          <div className={`journey-step-icon ${step.iconClass}`}>{step.icon}</div>
          <div className="journey-step-body">
            <div className="journey-step-action">{step.action}</div>
            <div className="journey-step-main">{step.main}</div>
            {step.sub && <div className="journey-step-sub">{step.sub}</div>}
          </div>
          {step.time && <div className="journey-step-time">{step.time}</div>}
        </div>
      ))}
      {mapUrl ? (
        <a className="journey-map-btn" href={mapUrl} style={{ marginTop: 16 }}>{t.viewOnMap}</a>
      ) : (
        <button className="journey-map-btn" disabled style={{ marginTop: 16 }}>{t.viewOnMap}</button>
      )}
    </>
  );
}

function buildSteps(itin: Itinerary, selectedToName: string, t: typeof JOURNEY_STRINGS['en']) {
  const steps: Array<{ iconClass: string; icon: string; action: string; main: string; sub?: string; time?: string }> = [];
  if (itin.type === 'direct') {
    const { leg1 } = itin;
    steps.push({ iconClass: '', icon: '🚌', action: t.stepBoard, main: `${leg1.codigo || ''} → ${selectedToName}`, sub: leg1.dias || '', time: leg1.depStr });
    steps.push({ iconClass: 'arrive', icon: '✓', action: t.stepArrive, main: selectedToName, time: leg1.arrStr || '—' });
  } else {
    const { leg1, leg2, transferNucleo, waitMins } = itin;
    steps.push({ iconClass: '', icon: '🚌', action: t.stepBoard, main: `${leg1.codigo || ''} → ${transferNucleo?.nombre}`, sub: leg1.dias || '', time: leg1.depStr });
    steps.push({ iconClass: 'transfer', icon: '⇄', action: t.stepTransfer, main: transferNucleo?.nombre || '', sub: t.stepWait(waitMins || 0), time: leg1.arrStr || '' });
    steps.push({ iconClass: '', icon: '🚌', action: t.stepBoard, main: `${leg2?.codigo || ''} → ${selectedToName}`, sub: leg2?.dias || '', time: leg2?.depStr });
    steps.push({ iconClass: 'arrive', icon: '✓', action: t.stepArrive, main: selectedToName, time: leg2?.arrStr || '—' });
  }
  return steps;
}
