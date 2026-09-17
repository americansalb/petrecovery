/**
 * The Probably Earth segment: the game's subtabs under the universal bar
 * (or, on the game's own site, its header and footer; see
 * app/lib/navChrome.js) and the static share card for /geo
 * (docs/LINK_PREVIEWS.md). Pages below override the card.
 */

import { buildShareMetadata } from '@/app/lib/geo/meta';
import GeoHeader from './components/GeoHeader';
import GeoFooter from './components/GeoFooter';
import './geo.css';

export const metadata = buildShareMetadata({
  // A globe, because the pet site's logo on a geography game was the
  // old answer and this is a site of its own now. Every page under
  // /geo inherits it, including on probablyearth.com.
  icons: { icon: '/globe.svg', shortcut: '/globe.svg', apple: '/globe.svg' },
  title: 'Probably Earth',
  description:
    'A street-level guessing game. You are dropped at a random spot with imagery, you place a pin, and points depend on how close you are. Play alone, or in a room with friends.',
  index: false,
});

/**
 * The game is dark, on every screen.
 *
 * The front door is a globe at night and the round is a photograph, and
 * between them sat Rooms, Rankings and Profile on cream paper with a
 * dark bar over the top. Going from the front door to the one page
 * whose job is multiplayer looked like leaving the game for its admin
 * panel. One surface, set here, so no page can forget it and nothing
 * flashes white between two of them: the body underneath is the pet
 * site's near-white, which shows through for a frame otherwise.
 */
export default function GeoLayout({ children }) {
  return (
    <div className="geo-surface min-h-[100dvh] bg-ocean-950 text-sand-50">
      <GeoHeader />
      {children}
      <GeoFooter />
    </div>
  );
}
