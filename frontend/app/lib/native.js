'use client';

/**
 * Native bridge seam.
 *
 * The single place the web app asks "am I running inside the native shell?"
 * Detection uses the global `window.Capacitor` that the Capacitor shell
 * injects into the page, so the website bundle needs NO build-time dependency
 * to detect native — on an ordinary browser every function here returns
 * web/false and nothing native is touched.
 *
 * Native plugins (splash, status bar, GPS, push, …) are imported only inside
 * native-only code paths (see app/components/CapacitorBootstrap.js), never
 * statically from shared website code.
 */

function cap() {
  if (typeof window === 'undefined') return null;
  return window.Capacitor || null;
}

/** True only inside the Capacitor native app shell. */
export function isNative() {
  const c = cap();
  return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
}

/** Async form, for call sites that already await (kept for ergonomic parity). */
export async function isNativeAsync() {
  return isNative();
}

/** 'ios' | 'android' | 'web' */
export function getPlatform() {
  const c = cap();
  if (c && typeof c.getPlatform === 'function') return c.getPlatform();
  return 'web';
}
