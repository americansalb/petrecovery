'use client';

/**
 * /geo: the front door.
 *
 * It used to be the lobby, which was a settings form (see
 * docs/PROBABLY_EARTH_UI.md). There is no settings page any more and this
 * is now one button on a picture of the world.
 */

import ColdOpen from './components/home/ColdOpen';

export default function GeoPage() {
  return <ColdOpen />;
}
