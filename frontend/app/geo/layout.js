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
import './experience.css';
import './home.css';
import './match.css';
import './accounts.css';
import { scriptShowcaseFonts } from './script/fonts';

export const metadata = { ...buildShareMetadata({
  // A globe, because the pet site's logo on a geography game was the
  // old answer and this is a site of its own now. Every page under
  // /geo inherits it, including on probablyearth.com.
  icons: { icon: '/globe.svg', shortcut: '/globe.svg', apple: '/globe.svg' },
  title: 'Probably Earth',
  description:
    'A street-level guessing game. You are dropped at a random spot with imagery, you place a pin, and points depend on how close you are. Play alone, or in a room with friends.',
  index: false,
}), manifest: '/geo/manifest.webmanifest' };

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
    <div
      className={`geo-surface min-h-[100dvh] bg-ocean-950 text-sand-50 ${scriptShowcaseFonts}`}
    >
      {/* The pet site's <main> carries `pb-16` for its mobile tab bar,
          which the game does not render. That padding is outside this
          div, so on a phone every page in the game ended in a 64px
          band of the body's near-white under the footer. The root
          layout's class is unconditional and belongs to the pet site,
          so the game paints behind it instead: one fixed sheet under
          everything, which also covers a short page and the overscroll
          at either end. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-ocean-950"
        aria-hidden="true"
      />
      <GeoHeader />
      {children}
      <GeoFooter />
    </div>
  );
}
