'use client';

import { useEffect } from 'react';
import { isNative } from '@/app/lib/native';

/**
 * Makes the webview feel like an app. Runs once on mount, and ONLY inside the
 * native shell: hides the splash when the site is interactive, styles the
 * status bar, routes deep links in-app (so a shared pet/mission link opens a
 * screen instead of bouncing to Safari), and wires the Android hardware back
 * button. On the web every branch is skipped (isNative() === false) and the
 * plugins are never imported. Renders nothing.
 *
 * Mounted from app/components/ClientProviders.js.
 */
export default function CapacitorBootstrap() {
  useEffect(() => {
    if (!isNative()) return;
    let removeListeners = () => {};

    (async () => {
      try {
        const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
          import('@capacitor/splash-screen'),
          import('@capacitor/status-bar'),
          import('@capacitor/app'),
        ]);

        // Site background is light → dark status-bar content.
        try { await StatusBar.setStyle({ style: Style.Dark }); } catch {}
        try { await SplashScreen.hide(); } catch {}

        // Deep links: keep navigation inside the app.
        const urlOpen = await App.addListener('appUrlOpen', ({ url }) => {
          try {
            const u = new URL(url);
            window.location.href = u.pathname + u.search + u.hash;
          } catch {}
        });

        // Android back button: navigate, or exit at the root.
        const back = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });

        removeListeners = () => { urlOpen.remove(); back.remove(); };
      } catch {
        // Plugins unavailable - nothing to do.
      }
    })();

    return () => removeListeners();
  }, []);

  return null;
}
