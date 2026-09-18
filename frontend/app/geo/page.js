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
import { buildShareMetadata } from '@/app/lib/geo/meta';

export const metadata = {
  ...buildShareMetadata({
    title: 'Probably Earth — Street and language guessing games',
    description: 'Guess the place from street views or written languages. Play free on your own, find an opponent, or invite friends.',
    canonical: 'https://probablyearth.com/geo',
    index: true,
  }),
  metadataBase: new URL('https://probablyearth.com'),
};

export default function GeoPage() {
  return <GameMenu />;
}
