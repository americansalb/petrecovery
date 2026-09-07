/**
 * Shared by the room route handlers: the error shape the pages rely on,
 * and who is behind a request. Route files may only export handlers,
 * so this lives here.
 */

import { NextResponse } from 'next/server';
import { RoomError } from './rooms';
import { MeterError } from '../meter';
import { meterErrorResponse, subjectsFor } from './meterRequest';

export const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export function roomErrorResponse(error, label) {
  if (error instanceof RoomError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, ...NO_STORE });
  }
  if (error instanceof MeterError) return meterErrorResponse(error);
  console.error(`[geo/rooms] ${label}`, error);
  return NextResponse.json({ error: 'Something went wrong with the room', code: 'internal' }, { status: 500, ...NO_STORE });
}

/**
 * The player behind a request, for ratings and the play meter: their
 * profile (the signed-in account, or the anonymous token the browser
 * sends; nothing is created here, the browser registers its profile
 * through /api/geo/profile first), whether they are signed in, and the
 * hashed IP. Unknown players are simply unrated.
 */
export function playerSubjects(request, name) {
  return subjectsFor(request, { name });
}
