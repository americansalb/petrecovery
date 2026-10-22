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

import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';

const display = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', variable: '--pe-font-display', weight: ['600', '700', '800'] });
const body = Instrument_Sans({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--pe-font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--pe-font-mono', weight: ['500', '700'], preload: false });

/** The class that sets all three variables, for the game's root. */
export const uiFonts = `${display.variable} ${body.variable} ${mono.variable}`;
