import SessionProvider from './components/SessionProvider';
import { ModeProvider } from './contexts/ModeContext';
import Navigation from './components/Navigation';

export const metadata = {
  title: 'PetRecovery.org - Reunite Lost Pets with Their Families',
  description: 'Beautiful community-powered pet recovery. Get instant help finding your lost pet.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <SessionProvider>
          <ModeProvider>
            <Navigation />
            {children}
          </ModeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
