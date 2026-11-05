/**
 * Register the vendored faces with react-pdf, exactly once per process.
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
      { src: join(DIR, 'Inter-Medium.ttf'), fontWeight: 500 },
      { src: join(DIR, 'Inter-SemiBold.ttf'), fontWeight: 600 },
      { src: join(DIR, 'Inter-Bold.ttf'), fontWeight: 700 },
      { src: join(DIR, 'Inter-Black.ttf'), fontWeight: 900 },
    ],
  });
  // The site's display face (app/lib/fonts.js); on the flyer it is LOST DOG,
  // the pet's name and the phone number. OFL like Inter.
  Font.register({
    family: 'Bricolage Grotesque',
    fonts: [
      { src: join(DIR, 'BricolageGrotesque-700.ttf'), fontWeight: 700 },
      { src: join(DIR, 'BricolageGrotesque-800.ttf'), fontWeight: 800 },
    ],
  });
  // The poster face: LOST, the species, the phone number. OFL.
  Font.register({ family: 'Anton', src: join(DIR, 'Anton-Regular.ttf') });
  // Don't hyphenate long words (pet names, addresses) mid-line.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
