'use client';

/**
 * /geo/setup: every choice the front door deliberately does not ask for.
 *
 * Imagery, mode, rounds, timer, format and how random the drop is. A
 * player who wants none of this never sees it; the settings are
 * remembered in the browser, so choosing once is enough.
 */

import GeoLobby from '../components/GeoLobby';

export default function GeoSetupPage() {
  return <GeoLobby />;
}
