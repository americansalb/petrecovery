/**
 * GET /api/geo/config
 *
 * What the lobby needs before a game: which providers are set up (and
 * the browser key for Google, which is public by design and locked to
 * this site's referrers in the Cloud Console), today's daily seed, and
 * the country list for the pickers. Never returns a server key.
 */

import { NextResponse } from 'next/server';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { countryOptions } from '@/app/lib/geo/server/countries';
import { dailySeed } from '@/app/lib/geo/modes';
import { limitsFromEnv } from '@/app/lib/geo/meter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getGeoServerConfig();
  const missing = [];
  if (!cfg.googleServerKey) missing.push('GOOGLE_STREET_VIEW_API_KEY');
  if (!cfg.googleBrowserKey) missing.push('GOOGLE_MAPS_BROWSER_KEY');
  // The game's own variable, which is what config.js reads first and
  // what the split carries to a standalone deployment. This used to name
  // NEXTAUTH_SECRET, the pet site's, which is only the fallback: the
  // setup screen renders this list verbatim, so it was telling operators
  // to set the one variable the game is trying to stop needing.
  if (!cfg.tokenSecret) missing.push('GEO_TOKEN_SECRET');

  return NextResponse.json(
    {
      providers: {
        google: {
          configured: cfg.googleConfigured && Boolean(cfg.tokenSecret),
          browserKey: cfg.googleConfigured ? cfg.googleBrowserKey : '',
          missing,
        },
        apple: { configured: cfg.appleConfigured && Boolean(cfg.tokenSecret) },
      },
      daily: { seed: dailySeed(), date: new Date().toISOString().slice(0, 10) },
      // The play meter's per-player numbers (docs/GEO.md); the site budgets stay server-side.
      limits: (({ freeGoogleRounds, freeGoogleRoomGames, freeChallengeRounds, ceilingAnonymous, ceilingSignedIn, roundsPerMinute }) => ({
        freeGoogleRounds,
        freeGoogleRoomGames,
        freeChallengeRounds,
        ceilingAnonymous,
        ceilingSignedIn,
        roundsPerMinute,
      }))(limitsFromEnv()),
      countries: countryOptions(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
