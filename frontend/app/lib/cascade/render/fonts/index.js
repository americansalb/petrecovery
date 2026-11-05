/**
 * Bundled fonts for server-side rendering.
 *
 * satori (SVG) and @resvg/resvg-js (PNG) both need real TTF/OTF buffers: they
 * cannot read woff2 or fetch fonts at runtime. react-pdf needs the same files
 * registered once (registerFonts.js). So the faces are vendored as .ttf next
 * to this file (OFL, see LICENSE.txt) and read synchronously from disk at
 * import time.
 *
 * Inter is the body face. Anton, a poster face, is LOST, the species and
 * the phone number, the three things the flyer says from across a street.
 * Bricolage Grotesque, the site's display face, stays for the share images'
 * smaller headings.
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
export const BRICOLAGE_700 = load('BricolageGrotesque-700.ttf');
export const BRICOLAGE_800 = load('BricolageGrotesque-800.ttf');
// The poster face: LOST, the species and the phone number, as big as the sheet allows.
export const ANTON = load('Anton-Regular.ttf');

// satori wants an array of { name, data, weight, style }
export const SATORI_FONTS = [
  { name: 'Inter', data: INTER_REGULAR, weight: 400, style: 'normal' },
  { name: 'Inter', data: INTER_SEMIBOLD, weight: 600, style: 'normal' },
  { name: 'Inter', data: INTER_BOLD, weight: 700, style: 'normal' },
  { name: 'Inter', data: INTER_BLACK, weight: 900, style: 'normal' },
  { name: 'Bricolage Grotesque', data: BRICOLAGE_700, weight: 700, style: 'normal' },
  { name: 'Bricolage Grotesque', data: BRICOLAGE_800, weight: 800, style: 'normal' },
  { name: 'Anton', data: ANTON, weight: 400, style: 'normal' },
];

// resvg wants raw font buffers + a default family, and must not touch the system
export const RESVG_FONT = {
  fontBuffers: [INTER_REGULAR, INTER_SEMIBOLD, INTER_BOLD, INTER_BLACK, BRICOLAGE_700, BRICOLAGE_800, ANTON],
  defaultFontFamily: 'Inter',
  loadSystemFonts: false,
};

// react-pdf registration is idempotent-guarded by the caller (registerFonts.js)
export const REACT_PDF_FONTS = [
  { src: INTER_REGULAR, fontWeight: 400 },
  { src: INTER_SEMIBOLD, fontWeight: 600 },
  { src: INTER_BOLD, fontWeight: 700 },
  { src: INTER_BLACK, fontWeight: 900 },
];
