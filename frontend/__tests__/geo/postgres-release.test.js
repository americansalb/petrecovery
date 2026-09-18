/** Real PostgreSQL release checks. Never use a production database here. */
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { databaseStoreFor } = require('@/app/lib/geo/server/roomStore');
const { matchmaking } = require('@/app/lib/geo/server/matchmaking');
const { getRoomView, roomAction } = require('@/app/lib/geo/server/rooms');
const url = process.env.GEO_PG_TEST_URL;
if (url) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/probablyearth_launch_qa') {
    throw new Error('Release database tests only accept localhost/probablyearth_launch_qa.');
  }
}

(url ? describe : describe.skip)('PostgreSQL release checks', () => {
  let clients, stores, previousSecret;
  const accounts = [];
  const profiles = [];
  const now = Date.now();
  beforeAll(() => {
    previousSecret = process.env.GEO_TOKEN_SECRET;
    process.env.GEO_TOKEN_SECRET = 'local-postgres-release-test-secret';
    clients = Array.from({ length: 2 }, () => new PrismaClient({ datasources: { db: { url } } }));
    stores = clients.map(databaseStoreFor);
  });
  afterAll(async () => {
    // Only rows created by this suite, in the guarded local QA database.
    const rooms = await clients[0].geoRoomPlayer.findMany({ where: { profileId: { in: profiles } }, select: { roomId: true } });
    await clients[0].geoRoom.deleteMany({ where: { id: { in: rooms.map((row) => row.roomId) } } });
    await clients[0].geoAccount.deleteMany({ where: { id: { in: accounts } } });
    await Promise.all(clients.map((client) => client.$disconnect()));
    if (previousSecret === undefined) delete process.env.GEO_TOKEN_SECRET;
    else process.env.GEO_TOKEN_SECRET = previousSecret;
  });
  async function player() {
    const key = randomUUID();
    const account = await stores[0].createAccount({ email: `${key}@example.test` });
    accounts.push(account.id);
    const profile = await stores[0].createProfile({ name: 'Database QA', accountId: account.id, tokenHash: key });
    profiles.push(profile.id);
    return { signedIn: true, profileId: profile.id, profile, ipHash: key };
  }
  const find = (store, subjects, action = 'join') => matchmaking(store, { subjects, action, game: 'script', now });

  test('two independent connection pools pair concurrent duplicate joins exactly once', async () => {
    const people = await Promise.all(Array.from({ length: 10 }, player));
    await Promise.all(people.flatMap((person) => stores.map((store) => find(store, person))));
    const seats = await Promise.all(people.map((person, index) => find(stores[index % 2], person, 'poll')));
    expect(seats.every((seat) => seat.status === 'matched')).toBe(true);
    const codes = [...new Set(seats.map((seat) => seat.code))];
    expect(codes).toHaveLength(5);
    for (const code of codes) {
      const room = await stores[0].getRoomByCode(code);
      expect(room.players).toHaveLength(2);
      expect(new Set(room.players.map((row) => row.profileId)).size).toBe(2);
      expect(room.rounds).toHaveLength(1);
      expect(room.phase).toBe('guessing');
    }
    // A fresh client simulates losing all process-local state, including locks.
    const restarted = new PrismaClient({ datasources: { db: { url } } });
    try {
      const recovered = await find(databaseStoreFor(restarted), people[0], 'poll');
      expect(recovered).toEqual(seats[0]);
      const view = await getRoomView(databaseStoreFor(restarted), { code: recovered.code, token: recovered.token, now });
      expect(view.me.id).toBe(recovered.playerId);
      expect(view.round.text).toBeTruthy();
      const peer = seats.find((seat) => seat.code === recovered.code && seat.playerId !== recovered.playerId);
      let at = now + 1000;
      let state;
      // Concurrent guesses, automatic reveals and five-round completion on the
      // real database. Equal guesses preserve health so every round runs.
      for (let round = 0; round < 5; round++) {
        await Promise.all([recovered, peer].map((seat, index) => getRoomView(stores[index], { code: seat.code, token: seat.token, now: at })));
        await Promise.all([recovered, peer].map((seat, index) => roomAction(stores[index], {
          code: seat.code, token: seat.token, action: 'guess', body: { lat: 35, lng: 139 }, now: at + 100,
        })));
        state = await getRoomView(stores[0], { code: recovered.code, token: recovered.token, now: at + 200 });
        expect(state.room.phase).toBe('reveal');
        expect(state.reveal.guesses).toHaveLength(2);
        expect(state.reveal.guesses.every((guess) => guess.damage === 0)).toBe(true);
        at = +new Date(state.room.phaseEndsAt) + 1;
        state = await getRoomView(stores[0], { code: recovered.code, token: recovered.token, now: at });
      }
      expect(state.room.status).toBe('finished');
      const finished = await stores[1].getRoomByCode(recovered.code);
      expect(finished.rounds).toHaveLength(5);
      expect(finished.rounds.every((round) => round.guesses.length === 2)).toBe(true);
    } finally { await restarted.$disconnect(); }
  }, 30000);

  test('a failed queue transaction rolls back the ticket and releases its lock', async () => {
    const person = await player();
    await expect(stores[0].withMatchmakingLock(async (locked) => {
      await locked.putMatchmakingTicket({ profileId: person.profileId, game: 'script', name: 'Rollback QA', joinedAt: new Date(now), lastSeenAt: new Date(now) });
      throw new Error('simulated failure');
    })).rejects.toThrow('simulated failure');
    expect(await stores[1].getMatchmakingTicket(person.profileId)).toBeNull();
    expect(await find(stores[1], person)).toMatchObject({ status: 'waiting' });
    await find(stores[1], person, 'cancel');
  });

  test('competing cloud saves use compare-and-swap and survive a new connection', async () => {
    const person = await player();
    const saves = [{ kind: 'script', snapshot: { score: 100 } }, { kind: 'script', snapshot: { score: 200 } }];
    const results = await Promise.all(stores.map((store, index) => store.saveAccountGame(person.profile.accountId, 0, saves[index])));
    expect(results.filter(Boolean)).toHaveLength(1);
    const account = await stores[1].getAccountById(person.profile.accountId);
    expect(account.savedGameRevision).toBe(1);
    expect(account.savedGame).toEqual(saves[results.indexOf(true)]);
    expect(await stores[0].saveAccountGame(account.id, 0, saves[1])).toBe(false);
  });
});
