import type { Metadata, Viewport } from 'next';
import { LangProvider } from '@/contexts/LangContext';
import UpdateBanner from '@/components/pwa/UpdateBanner';
import InstallBanner from '@/components/pwa/InstallBanner';
import Confetti from '@/components/ui/Confetti';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Bus Tracker — Andalusia',
  description: 'Real-time bus tracking for Andalusia, Spain. Live departures, route planner, journey planner and maps.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bus Tracker',
  },
};

export const viewport: Viewport = {
  themeColor: '#1a6fdb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />
      </head>
      <body>
        <LangProvider>
          <UpdateBanner />
          <InstallBanner />
          <Confetti />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
