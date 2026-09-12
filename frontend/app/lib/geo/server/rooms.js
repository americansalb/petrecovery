/**
 * Multiplayer rooms: everything that changes a room.
 *
 * All functions take a store (roomStore.js on Prisma, or the in-memory
 * one for tests) and a clock, and return fresh state. Phase transitions
 * are claimed with a version check, so when several players' polls
 * notice a deadline at the same moment only one request reveals the
 * round or builds the next one; the rest simply re-read.
 *
 * Nothing runs in the background: every request "ticks" the room first,
 * which is enough because someone is always polling a live room.
 *
 * Server only.
 */

import { createHash, randomBytes } from 'node:crypto';
import { haversineKm, scoreForDistance } from '../distance';
import { randomSeedString } from '../random';
import {
  DUEL_START_HP,
  FINAL_REVEAL_SECONDS,
  GUESS_GRACE_MS,
  LOADING_TIMEOUT_MS,
  MAX_PLAYERS,
  MAX_REACTIONS_KEPT,
  ONLINE_WINDOW_MS,
  PLAYER_COLORS,
  REACTION_EMOJI,
  REVEAL_SECONDS,
  ROOM_LISTING_WINDOW_MS,
  describeRoomMode,
  describeRoomRules,
  duelDamages,
  isGameOver,
  normalizeRoomConfig,
  pickColor,
  rankGuesses,
  roomCode,
  roundMultiplier,
  sanitizeName,
  sanitizeRoomName,
  sortStandings,
} from '../rooms';
import { APPLE_CANDIDATES_PER_ROUND, GeoGameError, findRoundImagery } from './game';
import { createCandidateSource, GeoSamplerError } from './sampler';
import { checkRoomEntry, recordRoomRound, subjectsForPlayer } from './meter';
import { awardRoomFinish, awardRoomRound, reactionsForProfile } from './points';
import { allReactionEmoji } from '../items';
import { applyRoomRatings, ratingsForRoom } from './profiles';

export class RoomError extends Error {
  constructor(code, message, status = 400) {
    super(message || code);
    this.name = 'RoomError';
    this.code = code;
    this.status = status;
  }
}

const toMs = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return null;
};

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function newPlayerToken() {
  return randomBytes(24).toString('base64url');
}

const currentRound = (room) => room.rounds.find((r) => r.index === room.roundIndex) || null;
const present = (room) => room.players.filter((p) => !p.leftAt);
const hasGuess = (round, playerId) => Boolean(round?.guesses?.some((g) => g.playerId === playerId));
const isOnline = (player, now) => now - toMs(player.lastSeenAt) < ONLINE_WINDOW_MS;

async function loadRoom(store, code) {
  const room = code ? await store.getRoomByCode(code) : null;
  if (!room) throw new RoomError('not_found', 'No room with that code', 404);
  return room;
}

function findPlayer(room, token) {
  if (!token) return null;
  const hash = hashToken(token);
  return room.players.find((p) => p.tokenHash === hash && !p.leftAt) || null;
}

function requireHost(player) {
  if (!player?.isHost) throw new RoomError('not_host', 'Only the host can do that', 403);
}

function uniqueName(name, players) {
  const taken = new Set(players.map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; n < 100; n++) {
    const candidate = `${name.slice(0, 17)} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${name.slice(0, 15)} ${Math.floor(Math.random() * 1000)}`;
}

/** A plain bump: version + activity, no claim. */
async function touchRoom(store, room, now, extra = {}) {
  await store.updateRoom(room.id, { version: room.version + 1, lastActiveAt: new Date(now), ...extra });
}

// ---------------------------------------------------------------------------
// Create, join, leave
// ---------------------------------------------------------------------------

export async function createRoom(store, { name, hostName, settings = {}, profileId = null, subjects = null, now = Date.now() }) {
  const { config, variant, visibility } = normalizeRoomConfig(settings);
  // The play meter: a person at the day's ceiling, a site past its
  // budget, or on Google a player whose free room game is used and who
  // has no prepaid rounds, does not open a room. The solo allowance is
  // not checked here.
  if (subjects) await checkRoomEntry(store, { subjects, provider: config.provider, now });
  config.seed = randomSeedString();
  let room = null;
  for (let i = 0; i < 6 && !room; i++) {
    const code = roomCode();
    if (await store.getRoomByCode(code)) continue;
    room = await store.createRoom({
      code,
      name: sanitizeRoomName(name),
      visibility,
      status: 'lobby',
      phase: 'lobby',
      variant,
      config,
      roundIndex: -1,
      version: 1,
      reactions: [],
      retries: 0,
      createdAt: new Date(now),
      lastActiveAt: new Date(now),
    });
  }
  if (!room) throw new RoomError('no_code', 'Could not allocate a room code, try again', 500);
  const token = newPlayerToken();
  const player = await store.createPlayer({
    roomId: room.id,
    tokenHash: hashToken(token),
    name: sanitizeName(hostName, 'Host'),
    color: pickColor(0),
    isHost: true,
    hp: DUEL_START_HP,
    profileId: profileId || null,
    ipHash: subjects?.ipHash || null,
    entry: null,
    joinedAt: new Date(now),
    lastSeenAt: new Date(now),
  });
  const fresh = await store.getRoomByCode(room.code);
  return { room: fresh, player, token, state: serialize(fresh, player, now, await ratingsForRoom(store, fresh)) };
}

export async function joinRoom(store, { code, name, profileId = null, subjects = null, now = Date.now() }) {
  const room = await loadRoom(store, code);
  if (room.status === 'finished') throw new RoomError('finished', 'This game is over', 409);
  if (subjects) await checkRoomEntry(store, { subjects, provider: room.config?.provider || 'google', now });
  if (room.status === 'playing' && room.variant === 'duel') {
    throw new RoomError('duel_in_progress', 'A duel is in progress. Ask the host for a rematch when it ends.', 409);
  }
  // Claim the seat before taking it. Two joins used to read the same
  // snapshot, both pass the cap check, and both create a player: a
  // twelve-seat room could hold thirteen, two players could share a map
  // colour and be indistinguishable on the reveal, and two could be
  // handed the same display name.
  let seat = null;
  let current = room;
  for (let attempt = 0; attempt < 4 && !seat; attempt++) {
    if (attempt) current = await loadRoom(store, code);
    const here = present(current);
    if (here.length >= MAX_PLAYERS) throw new RoomError('room_full', `This room is full (${MAX_PLAYERS} players)`, 409);
    const claimed = await store.updateRoom(
      current.id,
      { version: current.version + 1, lastActiveAt: new Date(now) },
      { expectVersion: current.version }
    );
    if (claimed) seat = here;
  }
  if (!seat) throw new RoomError('busy', 'The room changed just now, try again', 409);
  const players = seat;
  const used = new Set(players.map((p) => p.color));
  const color = PLAYER_COLORS.find((c) => !used.has(c)) || pickColor(current.players.length);
  const token = newPlayerToken();
  const player = await store.createPlayer({
    roomId: current.id,
    tokenHash: hashToken(token),
    name: uniqueName(sanitizeName(name), players),
    color,
    isHost: players.length === 0,
    hp: DUEL_START_HP,
    profileId: profileId || null,
    ipHash: subjects?.ipHash || null,
    entry: null,
    joinedAt: new Date(now),
    lastSeenAt: new Date(now),
  });
  const fresh = await store.getRoomByCode(code);
  return { room: fresh, player, token, state: serialize(fresh, player, now, await ratingsForRoom(store, fresh)) };
}

async function leaveRoom(store, room, me, now) {
  await store.updatePlayer(me.id, { leftAt: new Date(now), isHost: false });
  if (me.isHost) {
    const heir = present(room).find((p) => p.id !== me.id);
    if (heir) await store.updatePlayer(heir.id, { isHost: true });
  }
  await touchRoom(store, room, now);
}

// ---------------------------------------------------------------------------
// The clock: reveal on deadline, advance after the reveal, recover a stall
// ---------------------------------------------------------------------------

export async function tick(store, room, now, fetchImpl) {
  if (room.phase === 'guessing') {
    const round = currentRound(room);
    const deadline = toMs(round?.deadline);
    const online = present(room).filter((p) => !p.eliminated && isOnline(p, now));
    const everyoneGuessed = online.length > 0 && online.every((p) => hasGuess(round, p.id));
    if (!round || (deadline && now >= deadline) || everyoneGuessed) {
      return revealRound(store, room, now);
    }
    return room;
  }
  if (room.phase === 'reveal' && room.phaseEndsAt && now >= toMs(room.phaseEndsAt)) {
    return advanceRound(store, room, now, fetchImpl);
  }
  if (room.phase === 'locating' && room.phaseEndsAt && now >= toMs(room.phaseEndsAt)) {
    // Nobody's browser found Look Around imagery among the places offered:
    // offer the next ones, same round, and wait again.
    const round = currentRound(room);
    const retries = (room.retries || 0) + 1;
    const candidates = appleCandidates(room.config, room.roundIndex, retries);
    const claimed = await store.updateRoom(
      room.id,
      { phaseEndsAt: new Date(now + LOCATING_TIMEOUT_MS), lastError: 'No Look Around imagery at the places tried. Trying more.', retries, version: room.version + 1 },
      { expectVersion: room.version }
    );
    if (claimed && round && candidates.length) {
      await store.updateRound(round.id, { candidates, lat: candidates[0].lat, lng: candidates[0].lng, startedAt: new Date(now) });
    }
    return store.getRoomByCode(room.code);
  }
  if (room.phase === 'loading' && room.phaseEndsAt && now >= toMs(room.phaseEndsAt)) {
    // The request that claimed the build died mid-probe. Hand it back.
    const fallbackPhase = room.roundIndex < 0 ? 'lobby' : 'reveal';
    await store.updateRoom(room.id, {
      phase: fallbackPhase,
      status: room.roundIndex < 0 ? 'lobby' : 'playing',
      phaseEndsAt: new Date(now),
      lastError: 'The round took too long to build. Trying again.',
      retries: (room.retries || 0) + 1,
      version: room.version + 1,
    });
    return store.getRoomByCode(room.code);
  }
  return room;
}

/** Score everyone, apply damage, and open the reveal. Claimed by version. */
async function revealRound(store, room, now) {
  const round = currentRound(room);
  if (!round) {
    await store.updateRoom(room.id, { phase: 'reveal', phaseEndsAt: new Date(now), version: room.version + 1 }, { expectVersion: room.version });
    return store.getRoomByCode(room.code);
  }
  const players = present(room).filter((p) => !p.eliminated);
  const guesses = players.map((p) => {
    const existing = round.guesses.find((g) => g.playerId === p.id);
    return existing
      ? { ...existing, player: p, isNew: false }
      : { playerId: p.id, player: p, lat: null, lng: null, distanceKm: null, score: 0, damage: 0, timedOut: true, isNew: true };
  });

  const isDuel = room.variant === 'duel';
  let updates = [];
  function recomputeUpdates() {
    const scoresById = Object.fromEntries(guesses.map((g) => [g.playerId, g.score || 0]));
    const { damages, best } = isDuel ? duelDamages(scoresById, round.index) : { damages: {}, best: Math.max(0, ...Object.values(scoresById)) };
    updates = players.map((p) => {
      const score = scoresById[p.id] || 0;
      const damage = isDuel ? damages[p.id] || 0 : 0;
      const hp = isDuel ? Math.max(0, (p.hp ?? DUEL_START_HP) - damage) : p.hp;
      return {
        id: p.id,
        data: {
          score: (p.score || 0) + score,
          roundWins: (p.roundWins || 0) + (score > 0 && score === best ? 1 : 0),
          hp,
          eliminated: isDuel ? hp <= 0 : false,
        },
        damage,
      };
    });
  }
  recomputeUpdates();

  const after = present(room).map((p) => {
    const u = updates.find((x) => x.id === p.id);
    return u ? { ...p, ...u.data } : p;
  });
  const last = isGameOver({ variant: room.variant, roundIndex: room.roundIndex, roundsTotal: room.config.rounds, players: after });
  const phaseEndsAt = new Date(now + (last ? FINAL_REVEAL_SECONDS : REVEAL_SECONDS) * 1000);

  const claimed = await store.updateRoom(
    room.id,
    { phase: 'reveal', phaseEndsAt, lastActiveAt: new Date(now), version: room.version + 1 },
    { expectVersion: room.version }
  );
  if (!claimed) return store.getRoomByCode(room.code);

  // The claim is the serialization point, and everything above was
  // computed from a snapshot taken before it. A guess written in that
  // window used to be overwritten with a timed-out row: the real
  // coordinates were destroyed in the database, the player scored zero
  // for a guess their own browser had been told was accepted, and in a
  // duel they took full damage for it and could be eliminated by it.
  // So the scores are recomputed here, from the rows as they actually
  // stand now.
  const settled = currentRound(await store.getRoomByCode(room.code)) || round;
  for (const g of guesses) {
    const landed = settled.guesses.find((row) => row.playerId === g.playerId);
    if (!landed || !g.isNew) continue;
    Object.assign(g, landed, { player: g.player, isNew: false });
  }
  recomputeUpdates();

  // Points for the round (docs/GEO.md, "Points and cosmetics"); the
  // ledger's refs make a repeat harmless, and a failure costs nothing.
  let earned = {};
  try {
    earned = await awardRoomRound(store, room, round, guesses, now);
  } catch (error) {
    console.error('[geo/rooms] round points', error?.message || error);
  }
  for (const u of updates) {
    const before = players.find((p) => p.id === u.id)?.pointsEarned || 0;
    u.data.pointsEarned = before + (earned[u.id] || 0);
  }

  for (const g of guesses) {
    const u = updates.find((x) => x.id === g.playerId);
    if (g.isNew) {
      await store.createGuessIfAbsent({ roundId: round.id, playerId: g.playerId, lat: null, lng: null, distanceKm: null, score: 0, damage: u?.damage || 0, timedOut: true, submittedAt: new Date(now) });
    } else if (isDuel) {
      await store.upsertGuess({ roundId: round.id, playerId: g.playerId, damage: u?.damage || 0 });
    }
  }
  for (const u of updates) await store.updatePlayer(u.id, u.data);
  await store.updateRound(round.id, { revealedAt: new Date(now) });
  return store.getRoomByCode(room.code);
}

/**
 * A message fit to put on a room screen. The game's own errors are
 * written for players; anything else is logged and replaced, because
 * this string reaches everyone in the room and everyone holding its
 * code, and a Prisma or Google message names models, fields, keys and
 * project state.
 */
function roomSafeError(error, tag) {
  if (error instanceof GeoGameError || error instanceof GeoSamplerError) return error.message;
  console.error(tag, error?.message || error);
  return 'Could not find imagery for the next round. Trying again.';
}

/** After a reveal: finish, or claim the build of the next round. */
async function advanceRound(store, room, now, fetchImpl) {
  const over = isGameOver({ variant: room.variant, roundIndex: room.roundIndex, roundsTotal: room.config.rounds, players: room.players });
  if (over) {
    const claimed = await store.updateRoom(
      room.id,
      { status: 'finished', phase: 'finished', phaseEndsAt: null, lastActiveAt: new Date(now), version: room.version + 1 },
      { expectVersion: room.version }
    );
    if (claimed) {
      const finished = await store.getRoomByCode(room.code);
      try {
        await applyRoomRatings(store, finished, now);
      } catch (error) {
        console.error('[geo/rooms] rating failed', error?.message || error);
      }
      // Points for finishing, by placement among those who stayed.
      try {
        const earned = await awardRoomFinish(store, finished, now);
        for (const p of finished.players) {
          if (earned[p.id]) await store.updatePlayer(p.id, { pointsEarned: (p.pointsEarned || 0) + earned[p.id] });
        }
      } catch (error) {
        console.error('[geo/rooms] finish points', error?.message || error);
      }
    }
    return store.getRoomByCode(room.code);
  }
  const claimed = await store.updateRoom(
    room.id,
    { status: 'playing', phase: 'loading', phaseEndsAt: new Date(now + LOADING_TIMEOUT_MS), lastActiveAt: new Date(now), version: room.version + 1 },
    { expectVersion: room.version }
  );
  if (!claimed) return store.getRoomByCode(room.code);
  return buildRound(store, await store.getRoomByCode(room.code), room.roundIndex + 1, now, fetchImpl);
}

/** How long a room waits for someone's browser to find Look Around imagery. */
export const LOCATING_TIMEOUT_MS = 25000;

/**
 * Apple rooms: the places to try for a round, in the seeded order, with
 * the country and city kept server-side so the round can be filled in
 * once a browser reports which one has imagery. `attempt` skips past
 * places that were already tried.
 */
function appleCandidates(config, index, attempt = 0) {
  const source = createCandidateSource(config, index);
  const skip = Math.max(0, Math.min(20, Math.floor(Number(attempt) || 0))) * APPLE_CANDIDATES_PER_ROUND;
  for (let i = 0; i < skip; i++) if (!source.next()) break;
  const out = [];
  for (let i = 0; i < APPLE_CANDIDATES_PER_ROUND; i++) {
    const c = source.next();
    if (!c) break;
    out.push({
      lat: Math.round(c.lat * 1e6) / 1e6,
      lng: Math.round(c.lng * 1e6) / 1e6,
      cc: c.country?.cca2 || '',
      cn: c.country?.name || '',
      cf: c.country?.flag || '',
      city: c.city || '',
      sizeKm: source.sizeKm,
    });
  }
  return out;
}

/** Probe for imagery and open the guessing phase. Only the claimant calls this. */
async function buildRound(store, room, index, now, fetchImpl) {
  try {
    if (room.config?.provider === 'apple') {
      // No server-side probe exists for Look Around: offer places and let
      // a browser find one (the locate action), then everyone opens it.
      const candidates = appleCandidates(room.config, index, room.retries || 0);
      if (!candidates.length) throw new RoomError('no_candidates', 'No places to try for this mode', 422);
      const first = candidates[0];
      await store.createRound({
        roomId: room.id,
        index,
        panoId: '',
        heading: 0,
        lat: first.lat,
        lng: first.lng,
        countryCode: first.cc || null,
        countryName: first.cn || null,
        countryFlag: first.cf || null,
        city: first.city || null,
        imageDate: null,
        sizeKm: first.sizeKm,
        stats: null,
        candidates,
        startedAt: new Date(now),
        deadline: null,
      });
      const fresh = await store.getRoomById(room.id);
      await store.updateRoom(room.id, {
        status: 'playing',
        phase: 'locating',
        roundIndex: index,
        phaseEndsAt: new Date(now + LOCATING_TIMEOUT_MS),
        lastError: null,
        lastActiveAt: new Date(now),
        version: fresh.version + 1,
      });
      return store.getRoomByCode(room.code);
    }
    const imagery = await findRoundImagery({ config: room.config, roundIndex: index, attempt: room.retries || 0, fetchImpl });
    const deadline = new Date(now + room.config.time * 1000);
    await store.createRound({
      roomId: room.id,
      index,
      panoId: imagery.panoId,
      heading: imagery.heading,
      lat: imagery.lat,
      lng: imagery.lng,
      countryCode: imagery.country?.cca2 || null,
      countryName: imagery.country?.name || null,
      countryFlag: imagery.country?.flag || null,
      city: imagery.city || null,
      imageDate: imagery.date || null,
      sizeKm: imagery.sizeKm,
      stats: imagery.stats || null,
      startedAt: new Date(now),
      deadline,
    });
    const fresh = await store.getRoomById(room.id);
    await store.updateRoom(room.id, {
      status: 'playing',
      phase: 'guessing',
      roundIndex: index,
      phaseEndsAt: deadline,
      lastError: null,
      lastActiveAt: new Date(now),
      version: fresh.version + 1,
    });
    // Every player present sees this panorama: one round each on the meter.
    await recordRoomRound(store, fresh, now);
  } catch (error) {
    const fresh = await store.getRoomById(room.id);
    const backToLobby = index === 0;
    await store.updateRoom(room.id, {
      status: backToLobby ? 'lobby' : 'playing',
      phase: backToLobby ? 'lobby' : 'reveal',
      // A reveal that is already over retries on the next poll.
      phaseEndsAt: backToLobby ? null : new Date(now + 3000),
      // Only the game's own errors are safe to show: everything else
      // here is Prisma's or an upstream's, and this string is rendered
      // to every player and to anyone holding the room's code.
      lastError: roomSafeError(error, '[geo/rooms] build'),
      retries: (fresh.retries || 0) + 1,
      lastActiveAt: new Date(now),
      version: fresh.version + 1,
    });
  }
  return store.getRoomByCode(room.code);
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export const MIN_PLAYERS_TO_START = 2;

async function startRoom(store, room, now, fetchImpl) {
  if (room.status !== 'lobby') throw new RoomError('already_started', 'The game has already started', 409);
  if (present(room).length < MIN_PLAYERS_TO_START) {
    throw new RoomError('need_players', 'A room needs at least two players to start. Share the code.', 409);
  }
  const claimed = await store.updateRoom(
    room.id,
    { status: 'playing', phase: 'loading', phaseEndsAt: new Date(now + LOADING_TIMEOUT_MS), lastActiveAt: new Date(now), version: room.version + 1 },
    { expectVersion: room.version }
  );
  if (!claimed) throw new RoomError('busy', 'The room changed just now, try again', 409);
  return buildRound(store, await store.getRoomByCode(room.code), 0, now, fetchImpl);
}

async function submitGuess(store, room, me, body, now) {
  if (room.phase !== 'guessing') throw new RoomError('not_guessing', 'There is no round to guess right now', 409);
  if (me.eliminated) throw new RoomError('eliminated', 'You are out of this duel', 403);
  const round = currentRound(room);
  if (!round) throw new RoomError('no_round', 'No round is open', 409);
  if (hasGuess(round, me.id)) throw new RoomError('already_guessed', 'You already guessed this round', 409);
  if (round.deadline && now > toMs(round.deadline) + GUESS_GRACE_MS) throw new RoomError('too_late', 'Time was up for this round', 409);
  if (round.revealedAt) throw new RoomError('too_late', 'That round was already revealed', 409);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new RoomError('bad_guess', 'A guess needs a latitude and a longitude', 400);
  }
  const distanceKm = haversineKm({ lat, lng }, { lat: round.lat, lng: round.lng });
  const score = scoreForDistance(distanceKm, round.sizeKm);
  await store.upsertGuess({ roundId: round.id, playerId: me.id, lat, lng, distanceKm, score, damage: 0, timedOut: false, submittedAt: new Date(now) });
  await touchRoom(store, room, now);
  return store.getRoomByCode(room.code);
}

/**
 * Apple rooms: a browser found Look Around imagery at one of the places
 * offered. The first report wins (claimed by version); the round takes
 * that place and the clock starts for everyone.
 */
async function locateRound(store, room, me, body, now) {
  if (room.phase !== 'locating') throw new RoomError('not_locating', 'This round already has its place', 409);
  const round = currentRound(room);
  const candidates = Array.isArray(round?.candidates) ? round.candidates : [];
  const index = Number(body?.index);
  if (!round || !Number.isInteger(index) || index < 0 || index >= candidates.length) {
    throw new RoomError('bad_candidate', 'That is not one of the places offered', 400);
  }
  const deadline = new Date(now + room.config.time * 1000);
  const claimed = await store.updateRoom(
    room.id,
    { phase: 'guessing', phaseEndsAt: deadline, lastActiveAt: new Date(now), version: room.version + 1 },
    { expectVersion: room.version }
  );
  if (!claimed) throw new RoomError('not_locating', 'Someone else placed this round first', 409);
  const c = candidates[index];
  await store.updateRound(round.id, {
    lat: c.lat,
    lng: c.lng,
    countryCode: c.cc || null,
    countryName: c.cn || null,
    countryFlag: c.cf || null,
    city: c.city || null,
    sizeKm: c.sizeKm || round.sizeKm,
    startedAt: new Date(now),
    deadline,
  });
  await recordRoomRound(store, await store.getRoomById(room.id), now);
  return store.getRoomByCode(room.code);
}

async function react(store, room, me, emoji, now) {
  if (!allReactionEmoji(REACTION_EMOJI).includes(emoji)) throw new RoomError('bad_reaction', 'Pick one of the offered reactions', 400);
  const reactions = [...(Array.isArray(room.reactions) ? room.reactions : []), { p: me.id, n: me.name, e: emoji, at: now }].slice(-MAX_REACTIONS_KEPT);
  await touchRoom(store, room, now, { reactions });
  return store.getRoomByCode(room.code);
}

async function rematch(store, room, me, now) {
  if (room.status !== 'finished') throw new RoomError('not_finished', 'The game is still on', 409);
  if (room.rematchCode) {
    return { rematch: { code: room.rematchCode } };
  }
  // A rematch is a new game: it goes through the play meter's door like
  // any other room, with the player's profile and address as they were.
  // Claim the right to open it before opening it. Two clicks used to
  // both see rematchCode null, both create a room, and the second
  // overwrite the first: the host's reply carried her room's code and
  // token while everyone else followed the room's rematchCode to the
  // other one, so she sat alone and the rest sat in a room whose only
  // host record she had no token for. The orphan also burned a second
  // room game from her daily allowance.
  const claimed = await store.updateRoom(
    room.id,
    { version: room.version + 1, lastActiveAt: new Date(now) },
    { expectVersion: room.version }
  );
  if (!claimed) {
    const settled = await store.getRoomByCode(room.code);
    if (settled?.rematchCode) return { rematch: { code: settled.rematchCode } };
    throw new RoomError('busy', 'The room changed just now, try again', 409);
  }
  const subjects = me.profileId || me.ipHash ? await subjectsForPlayer(store, me) : null;
  const created = await createRoom(store, {
    name: room.name,
    hostName: me.name,
    settings: { ...room.config, variant: room.variant, visibility: room.visibility },
    profileId: me.profileId || null,
    subjects,
    now,
  });
  await touchRoom(store, { ...room, version: room.version + 1 }, now, { rematchCode: created.room.code });
  return { rematch: { code: created.room.code, token: created.token, playerId: created.player.id } };
}

/** One entry point for everything a joined player can do. */
export async function roomAction(store, { code, token, action, body = {}, now = Date.now(), fetchImpl }) {
  let room = await loadRoom(store, code);
  room = await tick(store, room, now, fetchImpl);
  const me = findPlayer(room, token);
  if (!me) throw new RoomError('not_a_player', 'Join the room first', 401);
  await store.updatePlayer(me.id, { lastSeenAt: new Date(now) });

  let extra = null;
  switch (action) {
    case 'start':
      requireHost(me);
      room = await startRoom(store, room, now, fetchImpl);
      break;
    case 'guess':
      room = await submitGuess(store, room, me, body, now);
      room = await tick(store, room, now, fetchImpl);
      break;
    case 'next': {
      requireHost(me);
      // Skip what the host was actually looking at. roomAction ticks
      // first, so the clock can move the room inside this same request:
      // a reveal countdown expiring here used to advance to the next
      // round and then be skipped straight past it, revealing a
      // brand-new round nobody had seen with everyone timed out.
      //
      // The phase, not the version. The version moves for reasons that
      // have nothing to do with the phase - another player's guess, a
      // reaction - and pinning to it refused ordinary clicks.
      const seenPhase = typeof body?.phase === 'string' ? body.phase : '';
      const seenRound = Number(body?.roundIndex);
      const movedOn =
        (seenPhase && seenPhase !== room.phase) ||
        (Number.isFinite(seenRound) && seenRound !== room.roundIndex);
      if (movedOn) throw new RoomError('moved_on', 'The room already moved on', 409);
      if (room.phase === 'guessing') room = await revealRound(store, room, now);
      else if (room.phase === 'reveal') room = await advanceRound(store, room, now, fetchImpl);
      else throw new RoomError('nothing_to_skip', 'Nothing to move on from right now', 409);
      break;
    }
    case 'locate':
      room = await locateRound(store, room, me, body, now);
      break;
    case 'react':
      room = await react(store, room, me, body?.emoji, now);
      break;
    case 'leave':
      await leaveRoom(store, room, me, now);
      room = await store.getRoomByCode(code);
      break;
    case 'rematch':
      requireHost(me);
      extra = await rematch(store, room, me, now);
      room = await store.getRoomByCode(code);
      break;
    default:
      throw new RoomError('unknown_action', `Unknown action: ${action}`, 400);
  }
  const meFresh = findPlayer(room, token);
  return { state: serialize(room, meFresh, now, await ratingsForRoom(store, room), await extrasFor(store, meFresh)), ...(extra || {}) };
}

/** What only the asking player sees: the reactions they may send. */
async function extrasFor(store, me) {
  try {
    return { reactions: await reactionsForProfile(store, me?.profileId || null) };
  } catch {
    return { reactions: [...REACTION_EMOJI] };
  }
}

/** The room as one player sees it, after moving the clock. */
export async function getRoomView(store, { code, token, now = Date.now(), fetchImpl }) {
  let room = await loadRoom(store, code);
  room = await tick(store, room, now, fetchImpl);
  const me = findPlayer(room, token);
  if (me && now - toMs(me.lastSeenAt) > 5000) {
    await store.updatePlayer(me.id, { lastSeenAt: new Date(now) });
    me.lastSeenAt = new Date(now);
  }
  return serialize(room, me, now, await ratingsForRoom(store, room), await extrasFor(store, me));
}

export async function listRooms(store, { now = Date.now() } = {}) {
  const rooms = await store.listPublicRooms({ since: now - ROOM_LISTING_WINDOW_MS });
  return rooms.map((room) => ({
    code: room.code,
    name: room.name,
    variant: room.variant,
    status: room.status,
    phase: room.phase,
    roundIndex: room.roundIndex,
    roundsTotal: room.config?.rounds || 0,
    time: room.config?.time || 0,
    provider: room.config?.provider || 'google',
    mode: describeRoomMode(room.config),
    rules: describeRoomRules(room.config),
    players: present(room).length,
    maxPlayers: MAX_PLAYERS,
    createdAt: toMs(room.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// What the browser gets
// ---------------------------------------------------------------------------

function revealOf(round, room) {
  return {
    index: round.index,
    answer: {
      lat: round.lat,
      lng: round.lng,
      country: round.countryCode || round.countryName ? { code: round.countryCode || '', name: round.countryName || '', flag: round.countryFlag || '' } : null,
      city: round.city || '',
      date: round.imageDate || '',
    },
    sizeKm: round.sizeKm,
    multiplier: room.variant === 'duel' ? roundMultiplier(round.index) : 1,
    guesses: rankGuesses(
      (round.guesses || []).map((g) => ({
        playerId: g.playerId,
        lat: g.lat,
        lng: g.lng,
        distanceKm: g.distanceKm,
        score: g.score || 0,
        damage: g.damage || 0,
        timedOut: Boolean(g.timedOut),
      }))
    ),
  };
}

export function serialize(room, me, now = Date.now(), ratings = {}, extras = {}) {
  const current = currentRound(room);
  const players = sortStandings(
    present(room).map((p) => {
      const rating = p.profileId ? ratings[p.profileId] || null : null;
      const rated = Number.isFinite(p.ratingBefore) && Number.isFinite(p.ratingAfter);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        isHost: Boolean(p.isHost),
        score: p.score || 0,
        hp: p.hp ?? DUEL_START_HP,
        eliminated: Boolean(p.eliminated),
        roundWins: p.roundWins || 0,
        online: isOnline(p, now),
        guessed: room.phase === 'guessing' && hasGuess(current, p.id),
        you: Boolean(me && me.id === p.id),
        rated: Boolean(p.profileId),
        rating: rating ? { value: rating.value, tier: rating.tier, provisional: rating.provisional, games: rating.games } : null,
        ratingDelta: rated ? Math.round(p.ratingAfter - p.ratingBefore) : null,
        ratingAfter: rated ? Math.round(p.ratingAfter) : null,
        placement: p.placement || null,
        cosmetics: rating?.cosmetics || null,
        pointsEarned: p.pointsEarned || 0,
      };
    }),
    room.variant
  );
  const config = room.config || {};
  return {
    serverNow: now,
    room: {
      code: room.code,
      name: room.name,
      visibility: room.visibility,
      status: room.status,
      phase: room.phase,
      variant: room.variant,
      roundIndex: room.roundIndex,
      roundsTotal: config.rounds || 0,
      phaseEndsAt: toMs(room.phaseEndsAt),
      version: room.version,
      rematchCode: room.rematchCode || null,
      lastError: room.lastError || null,
      hostId: present(room).find((p) => p.isHost)?.id || null,
      config: {
        provider: config.provider || 'google',
        mode: config.mode,
        region: config.region || '',
        rounds: config.rounds,
        time: config.time,
        move: config.move,
        pan: config.pan,
        zoom: config.zoom,
        radius: config.radius,
      },
    },
    players,
    me: me
      ? {
          id: me.id,
          name: me.name,
          color: me.color,
          isHost: Boolean(me.isHost),
          eliminated: Boolean(me.eliminated),
          score: me.score || 0,
          hp: me.hp ?? DUEL_START_HP,
          pointsEarned: me.pointsEarned || 0,
          reactions: extras.reactions || [...REACTION_EMOJI],
        }
      : null,
    round:
      current && room.phase === 'guessing'
        ? {
            index: current.index,
            provider: config.provider || 'google',
            // Imagery goes to players only. A Street View panorama is a
            // billed load and recordRoomRound charges the room's players,
            // so anyone who opened the link without joining used to cost
            // money that nothing counted: not their profile, not their
            // address, not even the site's budget.
            panoId: me ? current.panoId : null,
            heading: current.heading,
            // Apple rooms open Look Around at the round's place in every
            // player's browser; the place is known to the browser, as in
            // solo play.
            coordinate: me && config.provider === 'apple' ? { lat: current.lat, lng: current.lng } : null,
            deadline: toMs(current.deadline),
            startedAt: toMs(current.startedAt),
            stats: current.stats || null,
          }
        : null,
    locating:
      current && room.phase === 'locating'
        ? {
            index: current.index,
            candidates: me ? (Array.isArray(current.candidates) ? current.candidates : []).map((c) => ({ lat: c.lat, lng: c.lng })) : [],
            startedAt: toMs(current.startedAt),
            endsAt: toMs(room.phaseEndsAt),
          }
        : null,
    reveal: current && (room.phase === 'reveal' || room.phase === 'finished') ? revealOf(current, room) : null,
    history: room.rounds.filter((r) => r.revealedAt).map((r) => revealOf(r, room)),
    reactions: (Array.isArray(room.reactions) ? room.reactions : []).slice(-12),
  };
}
