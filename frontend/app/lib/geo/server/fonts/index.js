/**
 * The faces the game's link-preview card is drawn with.
 *
 * The game owns these so that the OpenGraph route does not import the
 * pet site's font bundle (docs/WANDERGUESSER_SPLIT.md, phase 1.5).
 *
 * satori and @resvg/resvg-js both need real TTF buffers: neither reads
 * woff2, and neither may fetch a font at render time. So the three
 * weights the card actually uses are vendored next to this file (Inter,
 * OFL, see LICENSE.txt) and read from disk once, at import.
 *
 * ShareCard.jsx sets 400 for its body, 700 for the wordmark and 900 for
 * the score. Adding a weight to the card means adding the file here.
 *
 * Node runtime only.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// From the working directory, not from import.meta.url: this module is
// bundled into the server build, so its own path at runtime is inside
// .next, where the .ttf files are not. This is the same resolution the
// pet site's font bundle uses and it is proven in this deployment.
const DIR = join(process.cwd(), 'app', 'lib', 'geo', 'server', 'fonts');

function load(file) {
  return readFileSync(join(DIR, file));
}

export const INTER_REGULAR = load('Inter-Regular.ttf');
export const INTER_BOLD = load('Inter-Bold.ttf');
export const INTER_BLACK = load('Inter-Black.ttf');

/** satori wants { name, data, weight, style }. */
export const SATORI_FONTS = [
  { name: 'Inter', data: INTER_REGULAR, weight: 400, style: 'normal' },
  { name: 'Inter', data: INTER_BOLD, weight: 700, style: 'normal' },
  { name: 'Inter', data: INTER_BLACK, weight: 900, style: 'normal' },
];

/** resvg wants raw buffers, a default family, and no system fonts. */
export const RESVG_FONT = {
  fontBuffers: [INTER_REGULAR, INTER_BOLD, INTER_BLACK],
  defaultFontFamily: 'Inter',
  loadSystemFonts: false,
};
