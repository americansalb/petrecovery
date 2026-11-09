import { getBaseUrl } from '@/app/lib/config';
import './globals.css';
import localFont from 'next/font/local';
import SessionProvider from './components/SessionProvider';
import { ModeProvider } from './contexts/ModeContext';
import Navigation from './components/Navigation';
import SiteFooter from './components/SiteFooter';
import GlobalBottomNav from './components/GlobalBottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from '@/components/OfflineBanner';
import PushNotificationProvider from './components/PushNotificationProvider';
import { GPSProvider } from './lib/gpsService';
import ClientProviders from './components/ClientProviders';

// Inter, the body face, from the repo (app/fonts/files): the build used to
// fetch it from Google Fonts, which failed every Render deploy for two weeks
// (app/fonts/README.md).
const inter = localFont({
  src: './fonts/files/inter-latin-var.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
});

// Next 14 ignores a `viewport` key inside `metadata` and warns on every route.
// The old block also set maximumScale:1 / userScalable:false - blocking pinch
// zoom, a WCAG 1.4.4 failure - and was only harmless because it was ignored.
// Moved to the export Next actually reads, minus those two keys.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F172A',
};

const BASE = getBaseUrl();
// The link-preview card for the site itself (public/share/home.jpg, 1200 by
// 630): a sample flyer on the lit yellow ground beside the pitch. Messengers
// crop a square logo to a strip, which is what showed before.
const HOME_CARD = {
  url: `${BASE}/share/home.jpg`,
  width: 1200,
  height: 630,
  alt: 'ReunitePets: one place for the whole search. A sample lost-pet flyer beside the pitch.',
};
const HOME_DESCRIPTION =
  'Report a lost pet in a few minutes. The flyer, the share images and the map are made for you, and every sighting lands on one page.';

export const metadata = {
  metadataBase: new URL(BASE),
  title: 'ReunitePets: one place for the whole search for a lost pet',
  description: HOME_DESCRIPTION,
  // Without this there is no <link rel="manifest"> in the document at all, so
  // public/manifest.json was inert and the app was never installable.
  manifest: '/manifest.json',
  icons: {
    icon: '/brand/logo-192.png',
    shortcut: '/brand/logo-192.png',
    apple: '/brand/logo-512.png',
  },
  openGraph: {
    title: 'ReunitePets: one place for the whole search',
    description: HOME_DESCRIPTION,
    images: [HOME_CARD],
    type: 'website',
    siteName: 'ReunitePets',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReunitePets: one place for the whole search',
    description: HOME_DESCRIPTION,
    images: [HOME_CARD.url],
  },
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the game's layout marks <html> with
    // data-geo-profile from an inline script before React hydrates
    // (app/geo/layout.js), on purpose, so that attribute never matches
    // the server's HTML. This silences that one element's attributes
    // only; everything inside it is still checked.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/* Leaflet's CSS ships inside each map component's own chunk (imported
          from node_modules), so text-only pages load no map assets at all. */}
      <body className="m-0 p-0 font-sans antialiased bg-midnight-50 text-midnight-900">
        <SessionProvider>
          <ModeProvider>
            <PushNotificationProvider>
              <GPSProvider>
                <ErrorBoundary>
                  <ClientProviders>
                    <OfflineBanner />
                    <Navigation />
                    {/* No bottom padding for the phone tab bar here: SiteFooter
                        clears it (pb-24), and routes without the footer hide
                        the tab bar too. Padding main drew a pale band between
                        a page's last section and the footer. */}
                    <main>
                      {children}
                    </main>
                    <SiteFooter />
                    <GlobalBottomNav />
                  </ClientProviders>
                </ErrorBoundary>
              </GPSProvider>
            </PushNotificationProvider>
          </ModeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
