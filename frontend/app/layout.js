import './globals.css';
import { Inter } from 'next/font/google';
import SessionProvider from './components/SessionProvider';
import { ModeProvider } from './contexts/ModeContext';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from '@/components/OfflineBanner';
import PushNotificationProvider from './components/PushNotificationProvider';
import { GPSProvider } from './lib/gpsService';

// Load Inter font with optimal settings
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'PetRecovery.org - Reunite Lost Pets with Their Families',
  description: 'Beautiful community-powered pet recovery. Get instant help finding your lost pet.',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="m-0 p-0 font-sans antialiased bg-midnight-50 text-midnight-900">
        <SessionProvider>
          <ModeProvider>
            <PushNotificationProvider>
              <GPSProvider>
                <ErrorBoundary>
                  <OfflineBanner />
                  <Navigation />
                  {children}
                </ErrorBoundary>
              </GPSProvider>
            </PushNotificationProvider>
          </ModeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
