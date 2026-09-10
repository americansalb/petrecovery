/**
 * GET  /api/geo/rooms/:code      the room as you see it (x-geo-player header
 *                                optional; without it you are a spectator)
 * POST /api/geo/rooms/:code      { action: 'join', name }
 *                                { action: 'start' | 'locate' | 'guess' | 'next' |
 *                                  'react' | 'leave' | 'rematch', ... }
 *
 * Every call moves the room's clock first (reveal on deadline, next round
 * after the reveal), so a room never depends on a background job.
 */

import { NextResponse } from 'next/server';
import { RateLimitPresets, rateLimitResponse, withRateLimitAsync } from '@/app/lib/geo/server/limiter';
import { normalizeRoomCode } from '@/app/lib/geo/rooms';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { getRoomView, joinRoom, roomAction } from '@/app/lib/geo/server/rooms';
import { NO_STORE, playerSubjects, roomErrorResponse } from '@/app/lib/geo/server/roomRoute';

export const dynamic = 'force-dynamic';

const ACTIONS = new Set(['start', 'guess', 'locate', 'next', 'react', 'leave', 'rematch']);
const errorResponse = roomErrorResponse;

function playerToken(request, body) {
  return request.headers.get('x-geo-player') || (typeof body?.token === 'string' ? body.token : '') || '';
}

export async function GET(request, { params }) {
  const code = normalizeRoomCode(params?.code);
  if (!code) return NextResponse.json({ error: 'No room with that code', code: 'not_found' }, { status: 404, ...NO_STORE });
  try {
    const state = await getRoomView(prismaRoomStore, { code, token: playerToken(request) });
    return NextResponse.json({ ok: true, state }, NO_STORE);
  } catch (error) {
    return errorResponse(error, 'view');
  }
}

export async function POST(request, { params }) {
  const code = normalizeRoomCode(params?.code);
  if (!code) return NextResponse.json({ error: 'No room with that code', code: 'not_found' }, { status: 404, ...NO_STORE });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with an action' }, { status: 400, ...NO_STORE });
  }
  const action = String(body?.action || '');

  try {
    if (action === 'join') {
      const limit = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'geo-room-join');
      if (!limit.success) return rateLimitResponse(limit);
      const subjects = await playerSubjects(request, body?.name);
      const { player, token, state } = await joinRoom(prismaRoomStore, { code, name: body?.name, profileId: subjects.profileId, subjects });
      return NextResponse.json({ ok: true, token, playerId: player.id, state }, NO_STORE);
    }
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: `Unknown action: ${action || '(none)'}`, code: 'unknown_action' }, { status: 400, ...NO_STORE });
    }
    if (action === 'start') {
      // Apple Look Around rooms need no server key; Google rooms do.
      const cfg = getGeoServerConfig();
      const room = await prismaRoomStore.getRoomByCode(code);
      if (room?.config?.provider !== 'apple' && !cfg.googleConfigured) {
        return NextResponse.json({ error: 'Google Street View is not configured on this server', code: 'google_not_configured' }, { status: 503, ...NO_STORE });
      }
    }
    const result = await roomAction(prismaRoomStore, { code, token: playerToken(request, body), action, body });
    return NextResponse.json({ ok: true, ...result }, NO_STORE);
  } catch (error) {
    return errorResponse(error, action);
  }
}
