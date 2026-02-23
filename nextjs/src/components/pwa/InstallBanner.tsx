'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LangContext';
import { HOME_STRINGS } from '@/lib/i18n';
import { getCookie, setCookie } from '@/lib/cookies';

export default function InstallBanner() {
  const { lang } = useLang();
  const s = HOME_STRINGS[lang];
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<any>(null);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (getCookie('pwaPromptDismissed') === '1') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    setCookie('pwaPromptDismissed', '1', 365);
    setVisible(false);
  };

  return (
    <div className="pwa-banner" id="pwa-banner">
      <span className="pwa-banner-text">{s.pwaInstallMsg}</span>
      <button className="pwa-install-btn" onClick={handleInstall}>{s.pwaInstall}</button>
      <button className="pwa-dismiss-btn" onClick={handleDismiss}>{s.pwaDismiss}</button>
    </div>
  );
}
