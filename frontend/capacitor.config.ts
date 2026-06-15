import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config — ReunitePets native shell (Phase 1).
 *
 * The app IS the website. The native shell loads the live Next.js site and
 * bridges native capabilities (splash, status bar, deep links now; background
 * GPS, push, camera in later phases). One codebase; web updates ship instantly
 * without an App Store resubmission.
 *
 * What the shell loads (server.url):
 *   • Production (default): CAPACITOR_SERVER_URL, else https://www.reunitepets.org
 *   • Dev live-reload: set CAPACITOR_DEV=true and
 *     CAPACITOR_DEV_URL=http://<your-LAN-ip>:3000
 *
 * webDir is only a local fallback bundle (shown if the site is unreachable on
 * a cold start); in remote-URL mode the live site is the real UI.
 *
 * The ios/ and android/ projects are generated on a Mac — see
 * docs/MOBILE_SETUP.md. Do not hand-edit this to point at a placeholder.
 */
const isDev = process.env.CAPACITOR_DEV === 'true';
const PROD_URL = process.env.CAPACITOR_SERVER_URL || 'https://www.reunitepets.org';

const config: CapacitorConfig = {
  appId: 'com.reunitepets.app',
  appName: 'ReunitePets',
  webDir: 'capacitor-www',
  server: isDev
    ? {
        url: process.env.CAPACITOR_DEV_URL || 'http://localhost:3000',
        cleartext: true, // allow http for local dev only
      }
    : {
        url: PROD_URL, // production must be https
      },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
