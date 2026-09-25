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
  title: 'Script | Probably Earth',
  // No count and no names: what the game covers is kept secret
  // (app/lib/geo/script.js), and a link preview is the most public
  // thing it says.
  description:
    'Read a few lines and pin where the language is spoken. Scored by the distance to the places it is used, not by country.',
  index: false,
});

export default function ScriptLayout({ children }) {
  return <div className={scriptFontClasses}>{children}</div>;
}
