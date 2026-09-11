/**
 * /geo/room/[code]: a multiplayer room. The link is what people send
 * each other, so it unfurls with the room's name and who is in it.
 * Immersive route (app/lib/navChrome.js); the HUD's X leads to
 * /geo/rooms.
 */

import { Suspense } from 'react';
import { buildShareMetadata, genericShareMetadata } from '@/app/lib/geo/meta';
import { VARIANTS, describeRoomMode, describeRoomStatus, normalizeRoomCode } from '@/app/lib/geo/rooms';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { geoMetadataBase } from '@/app/lib/geo/server/siteBase';
import RoomClient from '@/app/geo/components/RoomClient';

export const dynamic = 'force-dynamic';

const FALLBACK_TITLE = 'WanderGuesser rooms | ReunitePets';
const FALLBACK_DESCRIPTION = 'Play the street-level guessing game with friends: everyone guesses the same places on one clock.';

export async function generateMetadata({ params }) {
  const code = normalizeRoomCode(params?.code);
  try {
    const room = code ? await prismaRoomStore.getRoomByCode(code) : null;
    if (!room) return genericShareMetadata(FALLBACK_TITLE, FALLBACK_DESCRIPTION);
    const players = room.players.filter((p) => !p.leftAt);
    const names = players.slice(0, 4).map((p) => p.name).join(', ');
    const description = [
      `${VARIANTS[room.variant]?.label || room.variant}: ${describeRoomMode(room.config)}, ${room.config?.rounds || '?'} rounds, ${room.config?.time || '?'} seconds each.`,
      players.length ? `${players.length} in${names ? ` (${names}${players.length > 4 ? ' and more' : ''})` : ''}.` : 'Nobody in yet.',
      `${describeRoomStatus(room)}.`,
    ].join(' ');
    return {
      ...buildShareMetadata({
        title: `Join ${room.name} on WanderGuesser`,
        description,
        canonical: `/geo/room/${code}`,
        index: false,
      }),
      metadataBase: geoMetadataBase(),
    };
  } catch (error) {
    console.error('[geo/room] metadata', error?.message || error);
    return genericShareMetadata(FALLBACK_TITLE, FALLBACK_DESCRIPTION);
  }
}

export default function GeoRoomPage({ params }) {
  const code = normalizeRoomCode(params?.code) || String(params?.code || '').toUpperCase();
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-midnight-950 text-white/70">Loading the room</div>}>
      <RoomClient code={code} />
    </Suspense>
  );
}
