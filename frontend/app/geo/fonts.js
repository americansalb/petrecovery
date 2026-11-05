/**
 * The game's own type (2026-10-09): a display face with some character
 * for headings and the brand, a plain sans for everything read, and a
 * monospace for numbers, so a score that counts up does not jitter
 * sideways and a coordinate reads as one.
 *
 * Bundled by next/font rather than linked, so the first paint already
 * has them and no third party is asked at runtime. The two faces every
 * page draws are preloaded; the monospace is not, because most pages
 * show only a few figures in it.
 */

import localFont from 'next/font/local';

// Every face comes from the repo (app/fonts/files, app/fonts/README.md);
// the build fetched them from Google Fonts before, which failed every
// Render deploy for two weeks.
const display = localFont({
  src: [
    { path: '../fonts/files/bricolage-latin-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/files/bricolage-latin-700.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/files/bricolage-latin-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--pe-font-display',
});
// Instrument Sans as four static TTFs with the whole character set (latin
// and latin-ext in one file each; next/font/local has no unicode-range).
const body = localFont({
  src: [
    { path: '../fonts/files/instrument-all-400.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/files/instrument-all-500.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/files/instrument-all-600.ttf', weight: '600', style: 'normal' },
    { path: '../fonts/files/instrument-all-700.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--pe-font-body',
});
const mono = localFont({
  src: [
    { path: '../fonts/files/jetbrains-latin-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/files/jetbrains-latin-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--pe-font-mono',
  preload: false,
});

/** The class that sets all three variables, for the game's root. */
export const uiFonts = `${display.variable} ${body.variable} ${mono.variable}`;
