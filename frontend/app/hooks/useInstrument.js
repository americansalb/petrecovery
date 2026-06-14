'use client';

/**
 * useInstrument - which of the three instruments is the user holding?
 *
 * The platform doctrine: one mission, three instruments.
 *   command - desktop web. Coordinate, document, strategize. Never GPS.
 *   field   - the native app. GPS search legs, one-tap actions.
 *   bridge  - mobile web. Orient, report, share, join; field work
 *             belongs in the app.
 *
 * Native always wins (a tablet running the app is still a field unit).
 * Resolution is async because Capacitor detection is; `resolving` lets
 * screens hold their primary CTA for a beat instead of flashing the
 * wrong one.
 */

import { useState, useEffect } from 'react';

export const INSTRUMENTS = {
  COMMAND: 'command',
  FIELD: 'field',
  BRIDGE: 'bridge',
};

export default function useInstrument() {
  // The native app is being rebuilt from scratch (docs/MOBILE_APP_PLAN.md).
  // Until Field Mode ships there is no field instrument: web resolves to
  // command (desktop) or bridge (mobile). This constant is the seam where
  // Capacitor native detection plugs back in.
  const isNative = false;
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const instrument = isNative
    ? INSTRUMENTS.FIELD
    : isDesktop
      ? INSTRUMENTS.COMMAND
      : INSTRUMENTS.BRIDGE;

  return {
    instrument,
    isNative: !!isNative,
    isDesktop,
    resolving: isNative === null,
  };
}
