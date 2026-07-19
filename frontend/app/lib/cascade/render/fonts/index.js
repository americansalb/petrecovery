/**
 * Bundled Inter fonts for server-side rendering.
 *
 * satori (SVG) and @resvg/resvg-js (PNG) both need real TTF/OTF buffers — they
 * cannot read woff2 or fetch fonts at runtime (the agent proxy blocks font
 * CDNs anyway). react-pdf needs the same buffers registered once. So the four
 * weights are vendored as .ttf next to this file (OFL, see LICENSE.txt) and
 * read synchronously from disk at import time.
 *
 * Node runtime only.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'app', 'lib', 'cascade', 'render', 'fonts');

function load(file) {
  return readFileSync(join(DIR, file));
}

// Buffers (react-pdf Font.register accepts a Buffer via `src`)
export const INTER_REGULAR = load('Inter-Regular.ttf');
export const INTER_SEMIBOLD = load('Inter-SemiBold.ttf');
export const INTER_BOLD = load('Inter-Bold.ttf');
export const INTER_BLACK = load('Inter-Black.ttf');

// The poster design system's faces (OFL, see LICENSE.txt)
export const ARCHIVO_400 = load('Archivo-400.ttf');
export const ARCHIVO_600 = load('Archivo-600.ttf');
export const ARCHIVO_700 = load('Archivo-700.ttf');
export const ARCHIVO_800 = load('Archivo-800.ttf');
export const ARCHIVO_BLACK = load('ArchivoBlack.ttf');

// satori wants an array of { name, data, weight, style }
export const SATORI_FONTS = [
  { name: 'Inter', data: INTER_REGULAR, weight: 400, style: 'normal' },
  { name: 'Inter', data: INTER_SEMIBOLD, weight: 600, style: 'normal' },
  { name: 'Inter', data: INTER_BOLD, weight: 700, style: 'normal' },
  { name: 'Inter', data: INTER_BLACK, weight: 900, style: 'normal' },
  { name: 'Archivo', data: ARCHIVO_400, weight: 400, style: 'normal' },
  { name: 'Archivo', data: ARCHIVO_600, weight: 600, style: 'normal' },
  { name: 'Archivo', data: ARCHIVO_700, weight: 700, style: 'normal' },
  { name: 'Archivo', data: ARCHIVO_800, weight: 800, style: 'normal' },
  { name: 'Archivo Black', data: ARCHIVO_BLACK, weight: 400, style: 'normal' },
];

// resvg wants raw font buffers + a default family, and must not touch the system
export const RESVG_FONT = {
  fontBuffers: [INTER_REGULAR, INTER_SEMIBOLD, INTER_BOLD, INTER_BLACK, ARCHIVO_400, ARCHIVO_600, ARCHIVO_700, ARCHIVO_800, ARCHIVO_BLACK],
  defaultFontFamily: 'Archivo',
  loadSystemFonts: false,
};

// react-pdf registration is idempotent-guarded by the caller (registerFonts.js)
export const REACT_PDF_FONTS = [
  { src: INTER_REGULAR, fontWeight: 400 },
  { src: INTER_SEMIBOLD, fontWeight: 600 },
  { src: INTER_BOLD, fontWeight: 700 },
  { src: INTER_BLACK, fontWeight: 900 },
];
