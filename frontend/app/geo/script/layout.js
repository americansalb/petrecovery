/**
 * The script game's segment. A server layout so the route has its own
 * link preview rather than inheriting the panorama game's card
 * (docs/LINK_PREVIEWS.md); the font variables for every non-Latin
 * script in the corpus are attached here, so both the lobby and the
 * round have them (app/geo/script/fonts.js).
 */

import { buildShareMetadata } from '@/app/lib/geo/meta';
import { scriptFontClasses } from './fonts';

export const metadata = buildShareMetadata({
  title: 'Script | Where on Earth',
  description:
    'Read a sentence, pin where that language is spoken. Seventy-six languages across twenty-six writing systems, scored by distance rather than by country, so Tamil and Marathi are different answers.',
  index: false,
});

export default function ScriptLayout({ children }) {
  return <div className={scriptFontClasses}>{children}</div>;
}
