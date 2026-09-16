/**
 * GET /api/geo/config
 *
 * What the lobby needs before a game: whether the game is set up at all,
 * today's daily seed, the day's per-player limits and the country list
 * for the pickers. Never returns a secret.
 *
 * There is one imagery now (docs/GEO.md, "Apple first"), so there is one
 * provider here. The shape is still a map keyed by provider id because
 * the lobby, the room form and the play page all look themselves up in
 * it by the config's provider.
 */

import { NextResponse } from 'next/server';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { countryOptions } from '@/app/lib/geo/server/countries';
import { PRIMARY_PROVIDER, dailySeed } from '@/app/lib/geo/modes';
import { limitsFromEnv } from '@/app/lib/geo/meter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getGeoServerConfig();
  // The game's own variable, which is what config.js reads first and
  // what the split carries to a standalone deployment. This used to name
  // NEXTAUTH_SECRET, the pet site's, which is only the fallback: the
  // setup screen renders this list verbatim, so it was telling operators
  // to set the one variable the game is trying to stop needing.
  const missing = cfg.tokenSecret ? [] : ['GEO_TOKEN_SECRET'];

  return NextResponse.json(
    {
      providers: {
        apple: { configured: cfg.appleConfigured && Boolean(cfg.tokenSecret), missing },
      },
      // The imagery the lobby starts on and the shared boards are played on.
      primary: PRIMARY_PROVIDER,
      daily: { seed: dailySeed(), date: new Date().toISOString().slice(0, 10) },
      // The play meter's per-player numbers (docs/GEO.md); the site's own
      // day stays server-side, because it is the number that says how
      // close the whole site is to Apple's account quota.
      limits: (({ ceilingAnonymous, ceilingSignedIn, roundsPerMinute }) => ({ ceilingAnonymous, ceilingSignedIn, roundsPerMinute }))(limitsFromEnv()),
      countries: countryOptions(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
