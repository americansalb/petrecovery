/**
 * GET  /api/geo/rooms            public rooms active in the last 20 minutes
 * POST /api/geo/rooms            { name, hostName, settings } -> a new room,
 *                                the host's player token, and the room state
 *
 * Multiplayer for Where on Earth (docs/GEO.md). Players are anonymous:
 * the token in the response is the only proof of who you are in the
 * room, so the browser keeps it and sends it back as x-geo-player.
 */

import { NextResponse } from 'next/server';
import { RateLimitPresets, rateLimitResponse, withRateLimitAsync } from '@/app/lib/rateLimit';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { NO_STORE, playerSubjects, roomErrorResponse } from '@/app/lib/geo/server/roomRoute';
import { createRoom, listRooms } from '@/app/lib/geo/server/rooms';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rooms = await listRooms(prismaRoomStore);
    return NextResponse.json({ rooms }, NO_STORE);
  } catch (error) {
    return roomErrorResponse(error, 'list');
  }
}

export async function POST(request) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'geo-room-create');
  if (!limit.success) return rateLimitResponse(limit);

  const cfg = getGeoServerConfig();
  if (!cfg.googleConfigured || !cfg.tokenSecret) {
    return NextResponse.json({ error: 'Google Street View is not configured on this server', code: 'google_not_configured' }, { status: 503, ...NO_STORE });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with the room name and your name' }, { status: 400, ...NO_STORE });
  }

  try {
    const subjects = await playerSubjects(request, body?.hostName);
    const profileId = subjects.profileId;
    const { room, player, token, state } = await createRoom(prismaRoomStore, {
      name: body?.name,
      hostName: body?.hostName,
      settings: body?.settings && typeof body.settings === 'object' ? body.settings : body || {},
      profileId,
      subjects,
    });
    return NextResponse.json({ ok: true, code: room.code, token, playerId: player.id, state }, NO_STORE);
  } catch (error) {
    return roomErrorResponse(error, 'create');
  }
}
