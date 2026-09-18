/**
 * GET /api/geo/mapkit-token
 *
 * A MapKit JS token minted for the host this request arrived on, so
 * Apple draws on whichever hostname the player actually landed on
 * rather than only on the one somebody typed into the developer portal
 * months ago (app/lib/geo/server/mapKitToken.js).
 *
 * Never fails the caller. With no signing key configured it answers 200
 * with an empty token and the reason, and the browser goes on using the
 * literal it ships with, which is exactly what happens today.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { canMint, mintMapKitToken } from '@/app/lib/geo/server/mapKitToken';

export const dynamic = 'force-dynamic';

export async function GET() {
  const heads = await headers();
  // Behind a proxy the Host header is the proxy's; the forwarded one is
  // the name the browser used, which is the name Apple will check.
  const host = (heads.get('x-forwarded-host') || heads.get('host') || '').split(',')[0].trim();
  const minted = mintMapKitToken(host);

  return NextResponse.json(
    {
      token: minted.token || '',
      origin: minted.origin || '',
      expiresAt: minted.expiresAt || 0,
      host,
      configured: canMint(),
      reason: minted.reason || '',
    },
    {
      headers: {
        // A token is per host and expires in an hour. Shared caches
        // must not hand one host's token to another's player.
        'Cache-Control': 'private, max-age=600',
      },
    }
  );
}
