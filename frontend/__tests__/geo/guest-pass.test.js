/**
 * The guest pass (app/lib/geo/server/guestPass.js).
 *
 * Founder, 2026-10-09: a free trial nobody can abuse, and an account to
 * save or compete. Pinned here is what "nobody can abuse it" means in
 * the code, one way round it at a time:
 *
 *   - a guest has three games a day, an account has no game limit
 *   - a game is held together by a sealed ticket, so its later rounds
 *     are free and a round without one is another game
 *   - the ticket fits one game: its kind, its seed, its player
 *   - clearing the browser is a new profile on the same address, and
 *     the address has a backstop
 *   - the endless mode has a rounds ceiling under it
 *   - a ticket is never a round token, and a round token never a ticket
 */

const { admitGuestRound, guestAllowance, sealTicket, ticketFits, DEFAULT_GUEST_LIMITS, guestLimitsFromEnv, GuestPassError, GUEST_BUCKET } = require('@/app/lib/geo/server/guestPass');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { evaluateGuess } = require('@/app/lib/geo/server/game');
const { sealToken } = require('@/app/lib/geo/server/tokens');

const SECRET = 'guest-pass-test-secret-long-enough';
const T0 = Date.parse('2026-10-09T12:00:00Z');
const limits = { ...DEFAULT_GUEST_LIMITS, gamesPerIp: 5, rounds: 20, roundsPerIp: 80 };

const guest = (profileId, ipHash = 'ip:home') => ({ profileId, ipHash, signedIn: false });

/** Play one round the way a route does: admit, make the round, record. */
async function play(store, subjects, { kind = 'script', seed, ticket, now = T0 } = {}) {
  const pass = await admitGuestRound(store, { subjects, kind, seed, ticket, secret: SECRET, now, limits });
  if (!pass.guest) return pass;
  const allowance = await pass.record();
  return { ...pass, allowance };
}

/** A whole five-round game, carrying the ticket the first round hands back. */
async function playGame(store, subjects, seed, opts = {}) {
  const first = await play(store, subjects, { ...opts, seed });
  for (let i = 1; i < 5; i++) await play(store, subjects, { ...opts, seed, ticket: first.ticket });
  return first;
}

test('the limits are three games a day by default, and each can be set from the environment', () => {
  expect(DEFAULT_GUEST_LIMITS.games).toBe(3);
  expect(guestLimitsFromEnv({ GEO_GUEST_GAMES: '5', GEO_GUEST_GAMES_PER_IP: '9' })).toMatchObject({ games: 5, gamesPerIp: 9 });
  expect(guestLimitsFromEnv({ GEO_GUEST_GAMES: 'lots' }).games).toBe(3);
});

test('a guest gets three whole games, and the fourth is refused with the time it comes back', async () => {
  const store = createMemoryRoomStore();
  const me = guest('p1');
  for (const seed of ['a', 'b', 'c']) {
    const game = await playGame(store, me, seed);
    expect(game.newGame).toBe(true);
  }
  const allowance = await guestAllowance(store, me, { now: T0, limits });
  expect(allowance).toMatchObject({ guest: true, limit: 3, used: 3, left: 0, network: false });
  expect(allowance.resetAt).toBe(Date.parse('2026-10-10T00:00:00Z'));

  const refused = play(store, me, { seed: 'd' });
  await expect(refused).rejects.toBeInstanceOf(GuestPassError);
  await expect(refused).rejects.toMatchObject({ code: 'guest_limit', network: false, resetAt: Date.parse('2026-10-10T00:00:00Z') });

  // Tomorrow is a new day.
  const tomorrow = await play(store, me, { seed: 'e', now: T0 + 86400000 });
  expect(tomorrow.newGame).toBe(true);
});

test('a signed-in player is not counted at all', async () => {
  const store = createMemoryRoomStore();
  const me = { profileId: 'p1', ipHash: 'ip:home', signedIn: true };
  for (let i = 0; i < 10; i++) expect(await play(store, me, { seed: `s${i}` })).toEqual({ guest: false });
  expect(await guestAllowance(store, me)).toEqual({ guest: false });
});

test('the rounds of one game spend one game, and a refresh with the same ticket is not a new one', async () => {
  const store = createMemoryRoomStore();
  const me = guest('p1');
  const first = await play(store, me, { seed: 'one' });
  expect(first.ticket).toEqual(expect.any(String));
  // Round two, a refresh of round two, round three.
  for (let i = 0; i < 3; i++) {
    const next = await play(store, me, { seed: 'one', ticket: first.ticket });
    expect(next.newGame).toBe(false);
    expect(next.allowance.used).toBe(1);
  }
});

test('a round without a ticket is another game, so skipping round one does not get round the count', async () => {
  const store = createMemoryRoomStore();
  const me = guest('p1');
  // Three ticketless requests: each is a game.
  for (const seed of ['x', 'y', 'z']) expect((await play(store, me, { seed })).newGame).toBe(true);
  await expect(play(store, me, { seed: 'w' })).rejects.toMatchObject({ code: 'guest_limit' });
});

test('a ticket fits one game: the same kind, the same seed, the same player', async () => {
  const store = createMemoryRoomStore();
  const me = guest('p1');
  const ticket = sealTicket({ kind: 'script', seed: 'one', subjects: me, secret: SECRET, now: T0 });
  const fits = (over) => ticketFits(ticket, { kind: 'script', seed: 'one', subjects: me, secret: SECRET, now: T0, ...over });
  expect(fits()).toBe(true);
  expect(fits({ seed: 'two' })).toBe(false);
  expect(fits({ kind: 'street' })).toBe(false);
  expect(fits({ subjects: guest('p2') })).toBe(false);
  expect(fits({ secret: 'some-other-secret-entirely' })).toBe(false);
  expect(fits({ now: T0 + 7 * 60 * 60 * 1000 })).toBe(false);
  // A game with no seed draws fresh places every time, so no ticket fits it.
  expect(ticketFits(sealTicket({ kind: 'script', seed: '', subjects: me, secret: SECRET, now: T0 }), { kind: 'script', seed: '', subjects: me, secret: SECRET, now: T0 })).toBe(false);
  // And a ticket from another game is just another game.
  const other = await play(store, me, { seed: 'two', ticket });
  expect(other.newGame).toBe(true);
});

test('clearing the browser is a new profile on the same address, and the address has a backstop', async () => {
  const store = createMemoryRoomStore();
  // limits.gamesPerIp is 5 here: two profiles' worth and a bit.
  for (const seed of ['a', 'b', 'c']) await play(store, guest('first'), { seed });
  for (const seed of ['d', 'e']) await play(store, guest('second'), { seed });
  const third = guest('third');
  const allowance = await guestAllowance(store, third, { now: T0, limits });
  // Nothing played by this browser, so it is not told it played three games.
  expect(allowance).toMatchObject({ used: 0, left: 0, network: true });
  await expect(play(store, third, { seed: 'f' })).rejects.toMatchObject({ code: 'guest_limit', network: true });
});

test('a browser with no profile is never charged with the rest of its network', async () => {
  const store = createMemoryRoomStore();
  await play(store, guest('first'), { seed: 'a' });
  expect(await guestAllowance(store, { profileId: null, ipHash: 'ip:home', signedIn: false }, { now: T0, limits })).toMatchObject({ used: 0, left: 3 });
});

test('the endless mode has a rounds ceiling under it', async () => {
  const store = createMemoryRoomStore();
  const me = guest('p1');
  const first = await play(store, me, { kind: 'street', seed: 'streak' });
  for (let i = 1; i < limits.rounds; i++) await play(store, me, { kind: 'street', seed: 'streak', ticket: first.ticket });
  await expect(play(store, me, { kind: 'street', seed: 'streak', ticket: first.ticket })).rejects.toMatchObject({ code: 'guest_limit' });
});

test('nothing is written until the round is made, so a round that fails costs nothing', async () => {
  const store = createMemoryRoomStore();
  const me = guest('p1');
  await admitGuestRound(store, { subjects: me, kind: 'street', seed: 'a', secret: SECRET, now: T0, limits });
  expect(await store.listUsage(['profile:p1', 'ip:home'], '2026-10-09')).toEqual([]);
  await play(store, me, { kind: 'street', seed: 'a' });
  const rows = await store.listUsage(['profile:p1', 'ip:home'], '2026-10-09');
  expect(rows.map((r) => [r.subject, r.provider, r.games, r.rounds]).sort()).toEqual([
    ['ip:home', GUEST_BUCKET, 1, 1],
    ['profile:p1', GUEST_BUCKET, 1, 1],
  ]);
});

test('a ticket is never a round token, and a round token never a ticket', () => {
  const me = guest('p1');
  const ticket = sealTicket({ kind: 'street', seed: 'a', subjects: me, secret: SECRET, now: T0 });
  expect(() => evaluateGuess({ token: ticket, guess: { lat: 0, lng: 0 }, env: { GEO_TOKEN_SECRET: SECRET }, now: T0 })).toThrow();
  const round = sealToken({ t: 'guest-game', g: 'street', seed: 'a', h: 'profile:p1' }, { secret: SECRET, now: T0 });
  expect(ticketFits(round, { kind: 'street', seed: 'a', subjects: me, secret: SECRET, now: T0 })).toBe(false);
});
