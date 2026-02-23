'use client';

import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';

interface AppHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
}

export default function AppHeader({ title, backHref, backLabel = '←' }: AppHeaderProps) {
  const { lang, toggle } = useLang();

  return (
    <header className="app-header">
      <div className="header-inner">
        {backHref ? (
          <Link href={backHref} className="back-link" title="Back">
            {backLabel}
          </Link>
        ) : (
          <span className="app-icon">🚌</span>
        )}
        <h1>{title}</h1>
        <button className="lang-toggle" onClick={toggle} title="Switch language">
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
      </div>
    </header>
  );
}
