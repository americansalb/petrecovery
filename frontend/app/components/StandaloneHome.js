'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * App-like entry. When the site is opened as an installed app (added to the
 * home screen → "standalone" display mode), the marketing homepage is the
 * wrong first screen — an app should open into your stuff. So in standalone
 * mode only, send "/" to the dashboard (which is also the bottom-nav "Home").
 *
 * In a normal browser tab this never fires, so the public website is
 * completely unchanged. Renders nothing.
 */
function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true
  );
}

export default function StandaloneHome() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/' && isStandalone()) {
      router.replace('/dashboard');
    }
  }, [pathname, router]);

  return null;
}
