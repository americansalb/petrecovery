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
 * Detection resolves just after mount (so the first paint matches the
 * server and never flashes); `resolving` lets screens hold their primary
 * CTA for that beat instead of showing the wrong one.
 */

import { useState, useEffect } from 'react';
import { isNative as detectNative } from '@/app/lib/native';

export const INSTRUMENTS = {
  COMMAND: 'command',
  FIELD: 'field',
  BRIDGE: 'bridge',
};

export default function useInstrument() {
  // Native detection (docs/MOBILE_APP_PLAN.md): false on the web, true only
  // inside the Capacitor shell. Resolved in an effect so the first client
  // render matches the server (never native) - no hydration flash.
  const [isNative, setIsNative] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsNative(detectNative());
    setResolved(true);
  }, []);

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
    isNative,
    isDesktop,
    resolving: !resolved,
  };
}
