/**
 * Register the vendored Inter weights with react-pdf, exactly once per process.
 * react-pdf resolves `src` most reliably from a filesystem path in Node, so we
 * register by path (not Buffer). Idempotent — safe to call before every render.
 */

import { Font } from '@react-pdf/renderer';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'app', 'lib', 'cascade', 'render', 'fonts');

let registered = false;

export function registerFlyerFonts() {
  if (registered) return;
  Font.register({
    family: 'Inter',
    fonts: [
      { src: join(DIR, 'Inter-Regular.ttf'), fontWeight: 400 },
      { src: join(DIR, 'Inter-SemiBold.ttf'), fontWeight: 600 },
      { src: join(DIR, 'Inter-Bold.ttf'), fontWeight: 700 },
      { src: join(DIR, 'Inter-Black.ttf'), fontWeight: 900 },
    ],
  });
  // Don't hyphenate long words (pet names, addresses) mid-line.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
