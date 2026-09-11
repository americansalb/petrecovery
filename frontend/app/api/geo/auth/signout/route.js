/**
 * POST /api/geo/auth/signout
 *
 * Drop the game's session cookies. The browser keeps its play token, so
 * signing out leaves you playing anonymously rather than throwing away
 * the profile.
 */

import { NextResponse } from 'next/server';
import { clearSession } from '@/app/lib/geo/server/identity';

export const dynamic = 'force-dynamic';

export async function POST() {
  return clearSession(NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } }));
}
