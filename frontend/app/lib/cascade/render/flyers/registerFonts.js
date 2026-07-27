/**
 * Register the vendored Inter weights with react-pdf, exactly once per process.
 * react-pdf resolves `src` most reliably from a filesystem path in Node, so we
 * register by path (not Buffer). Idempotent - safe to call before every render.
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
  // The poster design system (claude.ai/design "Lost pet poster generator")
  // is set in Archivo + Archivo Black; both are OFL like the vendored Inter.
  Font.register({
    family: 'Archivo',
    fonts: [
      { src: join(DIR, 'Archivo-400.ttf'), fontWeight: 400 },
      { src: join(DIR, 'Archivo-600.ttf'), fontWeight: 600 },
      { src: join(DIR, 'Archivo-700.ttf'), fontWeight: 700 },
      { src: join(DIR, 'Archivo-800.ttf'), fontWeight: 800 },
    ],
  });
  Font.register({ family: 'Archivo Black', src: join(DIR, 'ArchivoBlack.ttf') });
  // Don't hyphenate long words (pet names, addresses) mid-line.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
