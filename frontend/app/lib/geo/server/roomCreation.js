import { createHash, createHmac } from 'node:crypto';
import { createRoom, getRoomView, hashToken, RoomError } from './rooms';
import { getGeoServerConfig } from './config';

/** A link opened in another tab and the original signup sheet share one intent. */
export async function createRoomOnce(store, options) {
  const { requestId, profileId, now = Date.now() } = options;
  // Older clients remain compatible, but always create atomically as well.
  if (!requestId) return store.withMatchmakingLock((locked) => createRoom(locked, options));
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) {
    throw new RoomError('bad_request_id', 'Please reopen room setup and try again.', 400);
  }
  if (!profileId) throw new RoomError('sign_in_required', 'Sign in to open a room.', 401);
  const creationKey = createHash('sha256').update(`${profileId}:${requestId}`).digest('hex');
  // Stable only for this account and this intent; no raw host credential is
  // stored in the room. A caller cannot derive it from the public retry ID.
  const token = createHmac('sha256', getGeoServerConfig().tokenSecret)
    .update(`geo-room-creation:${creationKey}`).digest('base64url');
  const result = await store.withMatchmakingLock(async (locked) => {
    const room = await locked.getRoomByCreationKey(creationKey);
    if (!room) return createRoom(locked, { ...options, creationKey, hostToken: token });
    const player = room.players.find((entry) => entry.isHost && entry.profileId === profileId && !entry.leftAt);
    if (!player) throw new RoomError('room_left', 'You already left this room. Open a new room to play again.', 409);
    if (player.tokenHash !== hashToken(token)) await locked.updatePlayer(player.id, { tokenHash: hashToken(token) });
    return { room, player, token };
  });
  // Advancing an existing room can sample imagery; do not hold a DB lock for it.
  if (!result.state) result.state = await getRoomView(store, { code: result.room.code, token, now });
  return result;
}
