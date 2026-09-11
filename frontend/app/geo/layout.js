/**
 * The WanderGuesser segment: the game's subtabs under the universal bar
 * (or, on the game's own site, its header and footer; see
 * app/lib/navChrome.js) and the static share card for /geo
 * (docs/LINK_PREVIEWS.md). Pages below override the card.
 */

import { buildShareMetadata } from '@/app/lib/geo/meta';
import GeoHeader from './components/GeoHeader';
import GeoFooter from './components/GeoFooter';

export const metadata = buildShareMetadata({
  title: 'WanderGuesser | ReunitePets',
  description:
    'A street-level guessing game. You are dropped at a random spot with imagery, you place a pin, and points depend on how close you are. Play alone, or in a room with friends.',
  index: false,
});

export default function GeoLayout({ children }) {
  return (
    <>
      <GeoHeader />
      {children}
      <GeoFooter />
    </>
  );
}
