'use client';

import { useState, useEffect } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import { useLang } from '@/contexts/LangContext';
import { SETTINGS_STRINGS } from '@/lib/i18n';
import { getDefaultRegion, setDefaultRegion } from '@/lib/i18n';
import { getCookie, setCookie } from '@/lib/cookies';
import { getSavedStops, removeSavedStop, type SavedStop } from '@/lib/savedStops';

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !/Windows Phone/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export default function SettingsPage() {
  const { lang, toggle } = useLang();
  const t = SETTINGS_STRINGS[lang];

  const [dateMode, setDateMode] = useState('today');
  const [defaultRegion, setDefaultRegionState] = useState<{ idConsorcio: string | number; nombre: string } | null>(null);
  const [savedStops, setSavedStops] = useState<SavedStop[]>([]);
  const [toast, setToast] = useState('');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  useEffect(() => {
    setDateMode(getCookie('plannerDateMode') || 'today');
    setDefaultRegionState(getDefaultRegion());
    setSavedStops(getSavedStops());
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(''), 2800);
  }

  function handleLangChange(newLang: 'en' | 'es') {
    if (newLang === lang) return;
    toggle(); // toggle handles setCookie + state
    showToast(t.toastLangSaved(newLang));
  }

  function handleDateMode(mode: string) {
    setCookie('plannerDateMode', mode, 365);
    setDateMode(mode);
    showToast(t.toastDateSaved(mode));
  }

  function handleClearRegion() {
    setCookie('defaultRegion', '', -1);
    setDefaultRegionState(null);
    showToast(t.toastRegionCleared);
  }

  function handleRemoveStop(stop: SavedStop) {
    removeSavedStop(stop.idConsorcio, stop.idParada);
    setSavedStops(getSavedStops());
  }

  function handleClearStops() {
    setCookie('savedStops', '[]', 365);
    setSavedStops([]);
    showToast(t.toastStopsCleared);
  }

  async function handleClearCache() {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    showToast(t.toastCacheCleared);
  }

  const platform = detectPlatform();

  return (
    <>
      <AppHeader title={t.title} backHref="/" />
      <main className="main-content settings-main">

        {/* Language */}
        <div className="settings-section" id="settings-lang-section">
          <div className="settings-section-label">{t.langLabel}</div>
          <div className="settings-card">
            <div className="settings-card-row">
              <div>
                <div className="settings-card-title">{t.langTitle}</div>
                <div className="settings-card-desc">{t.langDesc}</div>
              </div>
              <div className="settings-seg" id="lang-seg">
                <button
                  className={`settings-seg-btn${lang === 'en' ? ' active' : ''}`}
                  onClick={() => handleLangChange('en')}
                >EN</button>
                <button
                  className={`settings-seg-btn${lang === 'es' ? ' active' : ''}`}
                  onClick={() => handleLangChange('es')}
                >ES</button>
              </div>
            </div>
          </div>
        </div>

        {/* Route Planner */}
        <div className="settings-section">
          <div className="settings-section-label">{t.plannerLabel}</div>
          <div className="settings-card">
            <div className="settings-card-row">
              <div>
                <div className="settings-card-title">{t.dateModeTitle}</div>
                <div className="settings-card-desc">{t.dateModeDesc}</div>
              </div>
              <div className="settings-seg" id="datemode-seg">
                <button
                  className={`settings-seg-btn${dateMode === 'today' ? ' active' : ''}`}
                  onClick={() => handleDateMode('today')}
                >{t.segToday}</button>
                <button
                  className={`settings-seg-btn${dateMode === 'tomorrow' ? ' active' : ''}`}
                  onClick={() => handleDateMode('tomorrow')}
                >{t.segTomorrow}</button>
              </div>
            </div>
          </div>
        </div>

        {/* Default Region */}
        <div className="settings-section">
          <div className="settings-section-label">{t.regionLabel}</div>
          <div className="settings-card">
            <div className="settings-card-row">
              <div>
                <div className="settings-card-title">{t.regionTitle}</div>
                <div className="settings-card-desc" id="default-region-name">
                  {defaultRegion ? defaultRegion.nombre : t.regionNone}
                </div>
              </div>
              {defaultRegion && (
                <button className="settings-clear-btn" id="clear-region-btn" onClick={handleClearRegion}>
                  {t.regionClear}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Saved Stops */}
        <div className="settings-section">
          <div className="settings-section-label" id="settings-stops-label">{t.stopsLabel}</div>
          <div className="settings-card">
            {savedStops.length === 0 ? (
              <p className="settings-stops-empty" id="settings-stops-empty">{t.stopsEmpty}</p>
            ) : (
              <div id="settings-saved-list">
                {savedStops.map(stop => (
                  <div key={`${stop.idConsorcio}-${stop.idParada}`} className="settings-stop-card">
                    <a
                      className="settings-stop-link"
                      href={`/station?c=${encodeURIComponent(stop.idConsorcio)}&s=${encodeURIComponent(stop.idParada)}`}
                    >
                      <div className="settings-stop-body">
                        <div className="settings-stop-name">{stop.nombre || stop.idParada}</div>
                        <div className="settings-stop-meta">{stop.nucleo || stop.municipio || ''}</div>
                      </div>
                    </a>
                    <button
                      className="settings-stop-remove"
                      title="Remove"
                      onClick={() => handleRemoveStop(stop)}
                    >{t.stopsRemove}</button>
                  </div>
                ))}
              </div>
            )}
            {savedStops.length > 0 && (
              <button className="settings-clear-stops-btn" id="clear-stops-btn" onClick={handleClearStops}>
                {t.clearStops}
              </button>
            )}
          </div>
        </div>

        {/* Install guide */}
        <div className="settings-section">
          <div className="settings-section-label" id="settings-install-label">{t.installLabel}</div>
          <div className="settings-card">
            <div className="settings-card-row">
              <div>
                <div className="settings-card-title" id="settings-install-title">{t.installTitle}</div>
                <div className="settings-card-desc" id="settings-install-desc">{t.installDesc}</div>
              </div>
              <button
                className="settings-view-btn"
                id="open-install-guide-btn"
                onClick={() => setShowInstallGuide(true)}
              >{t.installBtnView}</button>
            </div>
          </div>
        </div>

        {/* About / Cache */}
        <div className="settings-section">
          <div className="settings-section-label" id="settings-about-label">{t.aboutLabel}</div>
          <div className="settings-card">
            <div className="settings-card-desc" id="settings-about-desc">{t.aboutDesc}</div>
            <div className="settings-card-row" style={{ marginTop: 12 }}>
              <div>
                <div className="settings-card-title" id="settings-cache-title">{t.cacheTitle}</div>
                <div className="settings-card-desc" id="settings-cache-desc">{t.cacheDesc}</div>
              </div>
              <button className="settings-clear-btn" id="clear-cache-btn" onClick={handleClearCache}>
                {t.cacheClear}
              </button>
            </div>
          </div>
        </div>

        {/* Open Source */}
        <div className="settings-section">
          <div className="settings-section-label settings-oss-label" id="settings-oss-label">{t.ossLabel}</div>
          <div className="settings-card settings-oss-card">
            <div className="settings-card-title" id="settings-oss-title">{t.ossTitle}</div>
            <div className="settings-card-desc" id="settings-oss-desc">{t.ossDesc}</div>
            <p className="settings-oss-text" id="settings-oss-text">{t.ossText}</p>
            <a
              className="settings-github-link"
              href="https://github.com/hendrikbgr/andalusia-public-transport-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="settings-github-icon">⭐</span>
              <div>
                <div id="settings-github-title">{t.githubTitle}</div>
                <div className="settings-card-desc" id="settings-github-desc">{t.githubDesc}</div>
              </div>
            </a>
          </div>
        </div>

      </main>

      {/* Toast */}
      {toast && (
        <div className="settings-toast" id="settings-toast">{toast}</div>
      )}

      {/* Install guide overlay */}
      {showInstallGuide && (
        <div
          className="install-guide-overlay"
          id="install-guide-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowInstallGuide(false); }}
        >
          <div className="install-guide-modal">
            <button
              className="install-guide-close"
              id="install-guide-close"
              onClick={() => setShowInstallGuide(false)}
            >✕</button>
            <div className="install-guide-title" id="install-guide-title">{t.installGuideTitle}</div>
            <div id="install-guide-body">
              {platform === 'ios' && (
                <>
                  <p className="install-guide-intro">{t.installIosIntro}</p>
                  <ul className="install-guide-steps">
                    {[
                      { icon: '🌐', text: t.installIosStep1 },
                      { icon: '📤', text: t.installIosStep2 },
                      { icon: '➕', text: t.installIosStep3 },
                      { icon: '✅', text: t.installIosStep4 },
                    ].map((s, i) => (
                      <li key={i} className="install-guide-step">
                        <span className="install-guide-step-icon">{s.icon}</span>
                        <span className="install-guide-step-text">{s.text}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="install-guide-note">{t.installIosNote}</div>
                </>
              )}
              {platform === 'android' && (
                <>
                  <p className="install-guide-intro">{t.installAndroidIntro}</p>
                  <ul className="install-guide-steps">
                    {[
                      { icon: '⋮', text: t.installAndroidStep1 },
                      { icon: '➕', text: t.installAndroidStep2 },
                      { icon: '✅', text: t.installAndroidStep3 },
                    ].map((s, i) => (
                      <li key={i} className="install-guide-step">
                        <span className="install-guide-step-icon">{s.icon}</span>
                        <span className="install-guide-step-text">{s.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {platform === 'other' && (
                <p className="install-guide-intro">{t.installOtherIntro}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
