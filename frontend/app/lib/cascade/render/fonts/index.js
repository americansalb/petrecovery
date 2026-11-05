/**
 * Bundled fonts for server-side rendering.
 *
 * satori (SVG) and @resvg/resvg-js (PNG) both need real TTF/OTF buffers: they
 * cannot read woff2 or fetch fonts at runtime. react-pdf needs the same files
 * registered once (registerFonts.js). So the faces are vendored as .ttf next
 * to this file (OFL, see LICENSE.txt) and read synchronously from disk at
 * import time.
 *
 * Inter is the body face. Fraunces, a warm display serif, is the cover's
 * word (LOST), its line ("Milo, a tabby cat", in the italic) and the phone
 * number.
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
export const INTER_MEDIUM = load('Inter-Medium.ttf');
export const INTER_SEMIBOLD = load('Inter-SemiBold.ttf');
export const INTER_BOLD = load('Inter-Bold.ttf');
export const INTER_BLACK = load('Inter-Black.ttf');
export const FRAUNCES_900 = load('Fraunces-900.ttf');
export const FRAUNCES_ITALIC_600 = load('Fraunces-Italic-600.ttf');

// satori wants an array of { name, data, weight, style }
export const SATORI_FONTS = [
  { name: 'Inter', data: INTER_REGULAR, weight: 400, style: 'normal' },
  { name: 'Inter', data: INTER_MEDIUM, weight: 500, style: 'normal' },
  { name: 'Inter', data: INTER_SEMIBOLD, weight: 600, style: 'normal' },
  { name: 'Inter', data: INTER_BOLD, weight: 700, style: 'normal' },
  { name: 'Inter', data: INTER_BLACK, weight: 900, style: 'normal' },
  { name: 'Fraunces', data: FRAUNCES_900, weight: 900, style: 'normal' },
  { name: 'Fraunces', data: FRAUNCES_ITALIC_600, weight: 600, style: 'italic' },
];

// resvg wants raw font buffers + a default family, and must not touch the system
export const RESVG_FONT = {
  fontBuffers: [INTER_REGULAR, INTER_MEDIUM, INTER_SEMIBOLD, INTER_BOLD, INTER_BLACK, FRAUNCES_900, FRAUNCES_ITALIC_600],
  defaultFontFamily: 'Inter',
  loadSystemFonts: false,
};

// react-pdf registration is idempotent-guarded by the caller (registerFonts.js)
export const REACT_PDF_FONTS = [
  { src: INTER_REGULAR, fontWeight: 400 },
  { src: INTER_MEDIUM, fontWeight: 500 },
  { src: INTER_SEMIBOLD, fontWeight: 600 },
  { src: INTER_BOLD, fontWeight: 700 },
  { src: INTER_BLACK, fontWeight: 900 },
];
