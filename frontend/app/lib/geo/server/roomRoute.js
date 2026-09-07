/**
 * Shared by the room route handlers: the error shape the pages rely on,
 * and the rating profile behind a request. Route files may only export
 * handlers, so this lives here.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaRoomStore } from './roomStore';
import { resolveProfile } from './profiles';
import { RoomError } from './rooms';

export const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export function roomErrorResponse(error, label) {
  if (error instanceof RoomError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, ...NO_STORE });
  }
  console.error(`[geo/rooms] ${label}`, error);
  return NextResponse.json({ error: 'Something went wrong with the room', code: 'internal' }, { status: 500, ...NO_STORE });
}

/**
 * The rating profile behind a request: the signed-in account, or the
 * anonymous token the browser sends. Nothing is created here; the
 * browser registers its profile through /api/geo/profile first.
 * Unknown players are simply unrated.
 */
export async function profileIdFor(request, name) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const { profile } = await resolveProfile(prismaRoomStore, {
      token: request.headers.get('x-geo-profile') || '',
      userId: session?.user?.id || null,
      name,
      createIfMissing: false,
    });
    return profile?.id || null;
  } catch {
    return null;
  }
}
