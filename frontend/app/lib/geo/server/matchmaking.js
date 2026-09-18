import { createRoom, joinRoom, roomAction, hashToken, RoomError } from './rooms';
import { accountSeatToken } from './roomSeat';
import { getGeoServerConfig } from './config';
import { sealToken, openToken } from './tokens';
import { sanitizeName } from '../rooms';

export const QUEUE_LEASE_MS = 20000;
const tokenOptions = (now) => ({ secret: getGeoServerConfig().tokenSecret, now, ttlMs: 24 * 60 * 60 * 1000 });
const seal = (token, now) => sealToken({ purpose: 'matchmaking-seat', token }, tokenOptions(now));

/** All queue changes and room allocation commit together, across all instances. */
export async function matchmaking(store, { subjects, game = 'street', action = 'join', now = Date.now() }) {
  if (!subjects?.signedIn || !subjects.profileId) throw new RoomError('sign_in_required', 'Sign in to find a match.', 401);
  if (!['street', 'script'].includes(game) || !['join', 'poll', 'cancel'].includes(action)) throw new RoomError('bad_queue', 'Choose Street or Script.', 400);
  const profileId = subjects.profileId;
  const result = await store.withMatchmakingLock(async (locked) => {
    let ticket = await locked.getMatchmakingTicket(profileId);
    if (ticket?.roomCode) {
      const room = await locked.getRoomByCode(ticket.roomCode);
      const player = room?.players.find((p) => p.profileId === profileId && !p.leftAt);
      if (room && room.status !== 'finished' && player) {
        // Recovery after a lost response, refresh, or a second device is idempotent.
        let token;
        try { token = openToken(ticket.token, tokenOptions(now)).token; } catch { /* Recover below. */ }
        if (!token || hashToken(token) !== player.tokenHash) {
          token = accountSeatToken(room.id, player.id, profileId);
          await locked.updatePlayer(player.id, { tokenHash: hashToken(token) });
          await locked.putMatchmakingTicket({ ...ticket, token: seal(token, now) });
        }
        return { status: 'matched', code: room.code, playerId: player.id, token };
      }
      await locked.deleteMatchmakingTicket(profileId);
      ticket = null;
    }
    if (action === 'cancel') {
      await locked.deleteMatchmakingTicket(profileId);
      return { status: 'idle' };
    }
    if (action === 'poll' && (!ticket || now - +new Date(ticket.lastSeenAt) > QUEUE_LEASE_MS)) {
      await locked.deleteMatchmakingTicket(profileId);
      return { status: 'expired' };
    }
    // A different device cannot silently change an active queue's selected game.
    if (ticket && now - +new Date(ticket.lastSeenAt) <= QUEUE_LEASE_MS) game = ticket.game;
    const mine = {
      profileId, game, name: sanitizeName(subjects.profile?.name), ipHash: subjects.ipHash || null,
      joinedAt: ticket && now - +new Date(ticket.lastSeenAt) <= QUEUE_LEASE_MS ? ticket.joinedAt : new Date(now),
      lastSeenAt: new Date(now), roomCode: null, playerId: null, token: null,
    };
    const opponent = await locked.findMatchmakingOpponent({ game, profileId, since: now - QUEUE_LEASE_MS });
    if (!opponent) {
      await locked.putMatchmakingTicket(mine);
      return { status: 'waiting', game, joinedAt: +new Date(mine.joinedAt) };
    }
    const otherSubjects = { signedIn: true, profileId: opponent.profileId, ipHash: opponent.ipHash };
    const host = await createRoom(locked, {
      hostName: opponent.name, name: `${game === 'script' ? 'Script' : 'Street'} match`,
      profileId: opponent.profileId, subjects: otherSubjects, now,
      settings: { game, variant: 'duel', visibility: 'private', provider: 'apple', mode: 'balanced', rounds: 5, time: 60 },
    });
    const peer = await joinRoom(locked, { code: host.room.code, name: mine.name, profileId, subjects, now });
    // Lock the roster after both seats exist. Room codes aren't permission to add a third player.
    await locked.updateRoom(host.room.id, { config: { ...host.room.config, matchmaking: true } });
    await locked.putMatchmakingTicket({ ...opponent, roomCode: host.room.code, playerId: host.player.id, token: seal(host.token, now) });
    await locked.putMatchmakingTicket({ ...mine, roomCode: host.room.code, playerId: peer.player.id, token: seal(peer.token, now) });
    return { status: 'matched', code: host.room.code, playerId: peer.player.id, token: peer.token };
  });
  if (result.status === 'matched') {
    const room = await store.getRoomByCode(result.code);
    if (room?.status === 'lobby') {
      const host = room.players.find((player) => player.isHost && !player.leftAt);
      const hostTicket = host && await store.getMatchmakingTicket(host.profileId);
      if (hostTicket?.token) {
        const hostToken = openToken(hostTicket.token, tokenOptions(now)).token;
        // Sampling happens after commit. Either player's retry can start the match
        // if the process died immediately after the pair was assigned.
        try { await roomAction(store, { code: room.code, token: hostToken, action: 'start', now }); }
        catch (error) { if (!['already_started', 'busy'].includes(error?.code)) throw error; }
      }
    }
  }
  return result;
}
