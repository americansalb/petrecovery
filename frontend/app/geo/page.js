/**
 * /geo: the game menu.
 *
 * It was the lobby, which was a settings form. Then it was one Play
 * button on a globe, which was quick to enter and told you nothing
 * about the rest of the product. It is a menu now: the quick start is
 * still the biggest thing on it, and Script, Friends and the three
 * competitions are visible beside it rather than hidden behind a
 * standings page (docs/PROBABLY_EARTH_UI.md).
 */

import GameMenu from './components/home/GameMenu';
import { buildShareMetadata, GEO_HOME_URL } from '@/app/lib/geo/meta';

// The domain was written out twice here, and this page was the only one
// that got it right: every other game page inherited the layout's base
// and served a localhost og:image on the live site. It comes from
// GEO_HOME_URL now, which is the same value every page resolves against.
export const metadata = buildShareMetadata({
  title: 'Probably Earth: street and language guessing games',
  description: 'Guess the place from street views or written languages. Play free on your own, find an opponent, or invite friends.',
  canonical: `${GEO_HOME_URL}/geo`,
  index: true,
});

export default function GeoPage() {
  return <GameMenu />;
}
