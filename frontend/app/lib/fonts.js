import localFont from 'next/font/local';

// Display face for the homepage headlines. Body text stays Inter
// (app/layout.js); only the big headings use this. The files live in the
// repo (app/fonts/files, see app/fonts/README.md): nothing is fetched from
// Google at build time.
export const displayFont = localFont({
  src: [
    { path: '../fonts/files/bricolage-latin-700.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/files/bricolage-latin-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
});
