'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import { useLang } from '@/contexts/LangContext';
import { HOME_STRINGS, SHARED_STRINGS } from '@/lib/i18n';
import { getSavedStops, removeSavedStop, type SavedStop } from '@/lib/savedStops';

export default function HomePage() {
  const { lang } = useLang();
  const s = HOME_STRINGS[lang];
  const shared = SHARED_STRINGS[lang];
  const [savedStops, setSavedStops] = useState<SavedStop[]>([]);

  useEffect(() => {
    setSavedStops(getSavedStops());
  }, []);

  function handleRemoveStop(idConsorcio: string, idParada: string) {
    removeSavedStop(idConsorcio, idParada);
    setSavedStops(getSavedStops());
  }

  return (
    <>
      <AppHeader title={shared.appTitle} />
      <main className="main-content">
        <div className="home-greeting">{s.greeting()}</div>

        {savedStops.length > 0 && (
          <section className="saved-stops-section">
            <div className="home-section-label">{s.savedStopsLabel}</div>
            <div className="card-list">
              {savedStops.map(stop => (
                <a
                  key={`${stop.idConsorcio}-${stop.idParada}`}
                  className="card saved-stop-card"
                  href={`/station?c=${stop.idConsorcio}&s=${stop.idParada}`}
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
                    aria-label={`Remove ${stop.nombre}`}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveStop(stop.idConsorcio, stop.idParada);
                    }}
                  >
                    ✕
                  </button>
                  <span className="card-arrow">›</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="home-section-label">{s.featuresLabel}</div>

        <div className="home-features card-list">
          <Link href="/stops" className="home-feature-card card">
            <div className="card-icon">🚏</div>
            <div className="card-body">
              <div className="card-title">{s.featTimetable}</div>
              <div className="card-sub">{s.featTimetableDesc}</div>
            </div>
            <span className="card-arrow">›</span>
          </Link>

          <Link href="/linetimetable" className="home-feature-card card">
            <div className="card-icon">📋</div>
            <div className="card-body">
              <div className="card-title">{s.featLineTimetable}</div>
              <div className="card-sub">{s.featLineTimetableDesc}</div>
            </div>
            <span className="card-arrow">›</span>
          </Link>

          <Link href="/planner" className="home-feature-card card">
            <div className="card-icon">🗺️</div>
            <div className="card-body">
              <div className="card-title">{s.featPlanner}</div>
              <div className="card-sub">{s.featPlannerDesc}</div>
            </div>
            <span className="card-arrow">›</span>
          </Link>

          <Link href="/journey" className="home-feature-card card">
            <div className="card-icon">🔄</div>
            <div className="card-body">
              <div className="card-title">{s.featJourney}</div>
              <div className="card-sub">{s.featJourneyDesc}</div>
            </div>
            <span className="card-arrow">›</span>
          </Link>

          <Link href="/map" className="home-feature-card card">
            <div className="card-icon">📍</div>
            <div className="card-body">
              <div className="card-title">{s.featMap}</div>
              <div className="card-sub">{s.featMapDesc}</div>
            </div>
            <span className="card-arrow">›</span>
          </Link>

          <Link href="/settings" className="home-feature-card card">
            <div className="card-icon">⚙️</div>
            <div className="card-body">
              <div className="card-title">{lang === 'en' ? 'Settings' : 'Ajustes'}</div>
              <div className="card-sub">{lang === 'en' ? 'Language, region, saved stops' : 'Idioma, región, paradas guardadas'}</div>
            </div>
            <span className="card-arrow">›</span>
          </Link>
        </div>
      </main>
    </>
  );
}
