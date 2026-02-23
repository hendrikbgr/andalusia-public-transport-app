'use client';

import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/contexts/LangContext';
import { HOME_STRINGS } from '@/lib/i18n';

export default function UpdateBanner() {
  const { lang } = useLang();
  const s = HOME_STRINGS[lang];
  const [visible, setVisible] = useState(false);
  const waitingSWRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function showBanner(sw: ServiceWorker) {
      waitingSWRef.current = sw;
      setVisible(true);
    }

    function watchReg(reg: ServiceWorkerRegistration) {
      if (reg.waiting) { showBanner(reg.waiting); return; }
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showBanner(newSW);
          }
        });
      });
    }

    navigator.serviceWorker.register('/sw.js').then(reg => {
      watchReg(reg);
      reg.update();
    });
  }, []);

  const handleReload = () => {
    if (waitingSWRef.current) waitingSWRef.current.postMessage('skipWaiting');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      sessionStorage.setItem('showUpdateConfetti', '1');
      location.reload();
    });
  };

  if (!visible) return null;

  return (
    <div className="update-banner" id="update-banner">
      <span className="update-banner-text">{s.updateMsg}</span>
      <button className="update-reload-btn" onClick={handleReload}>{s.updateReload}</button>
      <button className="update-dismiss-btn" onClick={() => setVisible(false)}>{s.updateDismiss}</button>
    </div>
  );
}
