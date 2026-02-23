'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DefaultRegionChip from '@/components/ui/DefaultRegionChip';
import { useLang } from '@/contexts/LangContext';
import { SHARED_STRINGS } from '@/lib/i18n';
import { CONSORTIUM_ICONS } from '@/lib/constants';
import { getConsorcios, getParadas, type Consorcio, type Parada } from '@/lib/api';
import { getDefaultRegion, setDefaultRegion } from '@/lib/i18n';
import { getSavedStops, removeSavedStop, type SavedStop } from '@/lib/savedStops';
import { getCookie, setCookie } from '@/lib/cookies';

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

type Step = 'consortium' | 'stop';

export default function StopsPage() {
  const { lang } = useLang();
  const t = SHARED_STRINGS[lang];
  const router = useRouter();

  const [step, setStep] = useState<Step>('consortium');
  const [consortiums, setConsortiums] = useState<Consorcio[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentConsorcio, setCurrentConsorcio] = useState<Consorcio | null>(null);
  const [allStops, setAllStops] = useState<Parada[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [savedStops, setSavedStops] = useState<SavedStop[]>([]);
  const [defaultRegion, setDefaultRegionState] = useState<Consorcio | null>(null);
  const [defaultChipVisible, setDefaultChipVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedStops(getSavedStops());
    loadConsortiums();
  }, []);

  async function loadConsortiums() {
    setLoading(true);
    try {
      const data = await getConsorcios();
      const dr = getDefaultRegion();
      setDefaultRegionState(dr ? (data.find(c => String(c.idConsorcio) === String(dr.idConsorcio)) ?? null) : null);

      // Sort: default first
      const sorted = dr
        ? [
            ...data.filter(c => String(c.idConsorcio) === String(dr.idConsorcio)),
            ...data.filter(c => String(c.idConsorcio) !== String(dr.idConsorcio)),
          ]
        : data;
      setConsortiums(sorted);

      // Auto-select default
      if (dr) {
        const match = data.find(c => String(c.idConsorcio) === String(dr.idConsorcio));
        if (match) {
          setDefaultChipVisible(true);
          selectConsortium(match);
        }
      }
    } catch {
      // handled in render
    } finally {
      setLoading(false);
    }
  }

  async function selectConsortium(c: Consorcio) {
    setCurrentConsorcio(c);
    setStep('stop');
    setQuery('');
    setAllStops([]);
    setStopsLoading(true);
    try {
      const stops = await getParadas(c.idConsorcio);
      setAllStops(stops);
    } catch {
      // non-fatal
    } finally {
      setStopsLoading(false);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }

  function handleSetDefault(c: Consorcio) {
    setDefaultRegion(c);
    setDefaultRegionState(c);
    loadConsortiums();
  }

  function handleRemoveSavedStop(idConsorcio: string, idParada: string) {
    removeSavedStop(idConsorcio, idParada);
    setSavedStops(getSavedStops());
  }

  const filteredStops = query.trim()
    ? allStops
        .filter(s =>
          normalize(s.nombre).includes(normalize(query)) ||
          (s.municipio && normalize(s.municipio).includes(normalize(query))) ||
          (s.nucleo && normalize(s.nucleo).includes(normalize(query))),
        )
        .slice(0, 30)
    : [];

  const dr = defaultRegion;

  return (
    <>
      <AppHeader title={t.appTitle} backHref="/" />
      <main className="main-content">

        {/* Consortium step */}
        {step === 'consortium' && (
          <div className="step active">
            <div className="step-label" id="label-choose-region">{t.chooseRegion}</div>

            {/* Saved stops on consortium step */}
            {savedStops.length > 0 && (
              <section className="saved-stops-section" id="saved-stops-section">
                <div className="step-label" id="saved-stops-heading">{t.savedStops}</div>
                <div className="card-list" id="saved-stops-list">
                  {savedStops.map(stop => (
                    <a
                      key={`${stop.idConsorcio}-${stop.idParada}`}
                      className="card saved-stop-card"
                      href={`/station?c=${stop.idConsorcio}&s=${stop.idParada}&from=%2Fstops`}
                    >
                      <div className="card-icon">📍</div>
                      <div className="saved-stop-card-body">
                        <div className="saved-stop-card-name">{stop.nombre}</div>
                        {(stop.nucleo || stop.municipio) && (
                          <div className="saved-stop-card-meta">
                            {[stop.nucleo, stop.municipio].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <button
                        className="saved-stop-remove-btn"
                        title="Remove"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); handleRemoveSavedStop(stop.idConsorcio, stop.idParada); }}
                      >✕</button>
                      <span className="card-arrow">›</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="card-list" id="consortium-list">
                {consortiums.map(c => {
                  const isDefault = dr && String(c.idConsorcio) === String(dr.idConsorcio);
                  return (
                    <div key={c.idConsorcio} className="card consortium-card" onClick={() => selectConsortium(c)}>
                      <div className="card-icon">{CONSORTIUM_ICONS[c.idConsorcio] || '🚌'}</div>
                      <div className="card-body">
                        <div className="card-title">
                          {c.nombre}
                          {isDefault && <span className="default-badge"> {t.defaultBadge}</span>}
                        </div>
                        <div className="card-sub">{c.nombreCorto}</div>
                      </div>
                      <button
                        className="set-default-btn"
                        title={t.setDefault}
                        onClick={e => { e.stopPropagation(); handleSetDefault(c); }}
                      >
                        {isDefault ? '★' : '☆'}
                      </button>
                      <span className="card-arrow">›</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stop search step */}
        {step === 'stop' && currentConsorcio && (
          <div className="step active">
            {defaultChipVisible && (
              <DefaultRegionChip
                consorcio={currentConsorcio}
                onChangeRegion={() => { setDefaultChipVisible(false); setStep('consortium'); }}
              />
            )}
            <button
              className="back-link"
              style={{ display: defaultChipVisible ? 'none' : 'inline-flex', marginBottom: 12 }}
              onClick={() => setStep('consortium')}
            >
              {t.backBtn}
            </button>
            <div className="consortium-title">{currentConsorcio.nombre}</div>
            <input
              ref={searchRef}
              className="stop-search"
              id="stop-search"
              type="search"
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="card-list" id="stop-list">
              {stopsLoading ? (
                <LoadingSpinner />
              ) : query.trim() === '' ? (
                <p className="hint">{t.stopsHint(allStops.length)}</p>
              ) : filteredStops.length === 0 ? (
                <p className="hint">{t.noStops(query)}</p>
              ) : (
                filteredStops.map(s => (
                  <div
                    key={s.idParada}
                    className="card"
                    onClick={() => router.push(`/station?c=${currentConsorcio.idConsorcio}&s=${s.idParada}`)}
                  >
                    <div className="card-icon">📍</div>
                    <div className="card-body">
                      <div className="card-title">{s.nombre}</div>
                      {(s.nucleo || s.municipio) && (
                        <div className="card-sub">{[s.nucleo, s.municipio].filter(Boolean).join(' · ')}</div>
                      )}
                    </div>
                    <span className="card-arrow">›</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
