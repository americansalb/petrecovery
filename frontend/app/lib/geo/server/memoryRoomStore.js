/**
 * The room store contract, backed by plain objects. Used by the tests
 * and handy for local hacking without a database. The Prisma store in
 * roomStore.js implements the same methods.
 *
 * Methods return copies; readers must go through the store to change
 * anything. updateRoom takes an optional expectVersion and returns false
 * when the stored version differs, which is what makes phase transitions
 * safe against two requests racing.
 */

import { seasonFor } from '../season';

export function createMemoryRoomStore() {
  const rooms = new Map();
  const players = new Map();
  const rounds = new Map();
  const guesses = new Map();
  const profiles = new Map();
  const accounts = new Map();
  const loginTokens = new Map();
  const ratings = new Map(); // key `${profileId}|${ladder}`
  const results = new Map();
  const usage = new Map(); // key `${subject}|${day}|${provider}`
  const challengeRounds = new Map(); // key `${profileId}|${key}|${index}`
  const challengeEntries = new Map(); // key `${profileId}|${key}`
  const ledger = new Map(); // key `${profileId}|${ref}`
  const unlocks = new Map(); // key `${profileId}|${itemId}`
  const badges = new Map(); // key `${profileId}|${countryCode}`
  const finals = new Map(); // challenge key -> { finalizedAt, prizes }
  let seq = 0;
  const id = (prefix) => `${prefix}_${++seq}`;

  function compose(room) {
    if (!room) return null;
    const roomPlayers = [...players.values()]
      .filter((p) => p.roomId === room.id)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ ...p }));
    const roomRounds = [...rounds.values()]
      .filter((r) => r.roomId === room.id)
      .sort((a, b) => a.index - b.index)
      .map((r) => ({ ...r, guesses: [...guesses.values()].filter((g) => g.roundId === r.id).map((g) => ({ ...g })) }));
    return { ...room, players: roomPlayers, rounds: roomRounds };
  }

  return {
    async getRoomByCode(code) {
      return compose([...rooms.values()].find((r) => r.code === code));
    },
    async getRoomById(roomId) {
      return compose(rooms.get(roomId));
    },
    async listPublicRooms({ since }) {
      return [...rooms.values()]
        .filter((r) => r.visibility === 'public' && r.status !== 'finished' && r.lastActiveAt >= since)
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
        .map(compose);
    },
    async createRoom(data) {
      const room = { id: id('room'), version: 1, roundIndex: -1, reactions: [], lastError: null, rematchCode: null, phaseEndsAt: null, ...data };
      rooms.set(room.id, room);
      return compose(room);
    },
    async updateRoom(roomId, data, { expectVersion } = {}) {
      const room = rooms.get(roomId);
      if (!room) return false;
      if (expectVersion !== undefined && room.version !== expectVersion) return false;
      Object.assign(room, data);
      return true;
    },
    async createPlayer(data) {
      const player = { id: id('player'), score: 0, hp: 6000, eliminated: false, roundWins: 0, isHost: false, leftAt: null, ...data };
      players.set(player.id, player);
      return { ...player };
    },
    async updatePlayer(playerId, data) {
      const player = players.get(playerId);
      if (!player) return null;
      Object.assign(player, data);
      return { ...player };
    },
    async createRound(data) {
      const round = { id: id('round'), revealedAt: null, ...data };
      rounds.set(round.id, round);
      return { ...round, guesses: [] };
    },
    async updateRound(roundId, data) {
      const round = rounds.get(roundId);
      if (!round) return null;
      Object.assign(round, data);
      return { ...round };
    },
    async createGuessIfAbsent({ roundId, playerId, ...data }) {
      const existing = [...guesses.values()].find((g) => g.roundId === roundId && g.playerId === playerId);
      if (existing) return null;
      const guess = { id: id('guess'), roundId, playerId, score: 0, damage: 0, timedOut: false, ...data };
      guesses.set(guess.id, guess);
      return { ...guess };
    },
    async upsertGuess({ roundId, playerId, ...data }) {
      const existing = [...guesses.values()].find((g) => g.roundId === roundId && g.playerId === playerId);
      if (existing) {
        Object.assign(existing, data);
        return { ...existing };
      }
      const guess = { id: id('guess'), roundId, playerId, score: 0, damage: 0, timedOut: false, ...data };
      guesses.set(guess.id, guess);
      return { ...guess };
    },
    // Profiles and ratings
    async getProfileByTokenHash(tokenHash) {
      const p = [...profiles.values()].find((x) => x.tokenHash === tokenHash);
      return p ? { ...p } : null;
    },
    async getProfileByAccountId(accountId) {
      const p = [...profiles.values()].find((x) => x.accountId && x.accountId === accountId);
      return p ? { ...p } : null;
    },
    // The game's own accounts and sign-in links.
    async getAccountByEmail(email) {
      const a = [...accounts.values()].find((x) => x.email === email);
      return a ? { ...a } : null;
    },
    async getAccountById(accountId) {
      const a = accounts.get(accountId);
      return a ? { ...a } : null;
    },
    async createAccount(data) {
      const account = { id: id('account'), createdAt: new Date(), lastSeenAt: new Date(), ...data };
      accounts.set(account.id, account);
      return { ...account };
    },
    async updateAccount(accountId, data) {
      const account = accounts.get(accountId);
      if (!account) return null;
      Object.assign(account, data);
      return { ...account };
    },
    async createLoginToken(data) {
      const row = { id: id('login'), usedAt: null, createdAt: new Date(), ...data };
      loginTokens.set(row.id, row);
      return { ...row };
    },
    async getLoginTokenByHash(tokenHash) {
      const row = [...loginTokens.values()].find((x) => x.tokenHash === tokenHash);
      return row ? { ...row } : null;
    },
    async useLoginToken(tokenId, at) {
      const row = loginTokens.get(tokenId);
      if (!row || row.usedAt) return false;
      row.usedAt = at;
      return true;
    },
    async deleteExpiredLoginTokens(before) {
      let count = 0;
      for (const [key, row] of loginTokens) {
        if (new Date(row.expiresAt).getTime() < new Date(before).getTime()) {
          loginTokens.delete(key);
          count += 1;
        }
      }
      return { count };
    },
    async getProfileById(profileId) {
      const p = profiles.get(profileId);
      return p ? { ...p } : null;
    },
    async createProfile(data) {
      const profile = { id: id('profile'), accountId: null, paidRounds: 0, points: 0, equipped: null, ...data };
      profiles.set(profile.id, profile);
      return { ...profile };
    },
    async updateProfile(profileId, data) {
      const profile = profiles.get(profileId);
      if (!profile) return null;
      Object.assign(profile, data);
      return { ...profile };
    },
    async getRatings(profileIds, ladder, season = seasonFor().key) {
      return profileIds.map((pid) => ratings.get(`${pid}|${ladder}|${season}`)).filter(Boolean).map((r) => ({ ...r }));
    },
    async upsertRating(profileId, ladder, data, season = seasonFor().key) {
      const key = `${profileId}|${ladder}|${season}`;
      const existing = ratings.get(key) || { id: id('rating'), profileId, ladder, season };
      Object.assign(existing, data);
      ratings.set(key, existing);
      return { ...existing };
    },
    async createMatchResult(data) {
      const row = { id: id('result'), ...data };
      results.set(row.id, row);
      return { ...row };
    },
    async claimRoomRating(roomId, now) {
      const room = rooms.get(roomId);
      if (!room || room.ratedAt) return false;
      room.ratedAt = new Date(now);
      return true;
    },
    async listLeaderboard(ladder, { limit = 50, minGames = 0, season = seasonFor().key } = {}) {
      return [...ratings.values()]
        .filter((r) => r.ladder === ladder && r.season === season && (r.games || 0) >= minGames)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit)
        .map((r) => ({ ...r, profile: { id: r.profileId, name: profiles.get(r.profileId)?.name || 'Player', equipped: profiles.get(r.profileId)?.equipped || null } }));
    },
    async getRecentResults(profileId, limit = 10) {
      return [...results.values()]
        .filter((r) => r.profileId === profileId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
    // The play meter (server/meter.js)
    async listUsage(subjects, day) {
      return [...usage.values()].filter((u) => u.day === day && subjects.includes(u.subject)).map((u) => ({ ...u }));
    },
    async bumpUsage(subject, day, provider, inc = {}) {
      const key = `${subject}|${day}|${provider}`;
      const row = usage.get(key) || { id: id('usage'), subject, day, provider, rounds: 0, free: 0, paid: 0, games: 0, challenge: 0, loads: 0 };
      row.rounds += inc.rounds || 0;
      row.free += inc.free || 0;
      row.paid += inc.paid || 0;
      row.games += inc.games || 0;
      row.challenge += inc.challenge || 0;
      row.loads += inc.loads || 0;
      usage.set(key, row);
      return { ...row };
    },
    async consumePaidRound(profileId) {
      const profile = profiles.get(profileId);
      if (!profile || !(profile.paidRounds > 0)) return false;
      profile.paidRounds -= 1;
      return true;
    },
    // Challenges with a board (server/challenges.js)
    async createChallengeRound(data) {
      const k = `${data.profileId}|${data.key}|${data.index}`;
      if (challengeRounds.has(k)) return null;
      const row = { id: id('cround'), ...data };
      challengeRounds.set(k, row);
      return { ...row };
    },
    async bumpChallengeEntry(profileId, key, { scoreDelta = 0, roundsDelta = 0, rounds, now }) {
      const k = `${profileId}|${key}`;
      const row = challengeEntries.get(k) || { id: id('centry'), profileId, key, total: 0, rounds: 0, finishedAt: null, createdAt: new Date(now) };
      row.total += scoreDelta;
      row.rounds += roundsDelta;
      if (rounds && row.rounds >= rounds && !row.finishedAt) row.finishedAt = new Date(now);
      challengeEntries.set(k, row);
      return { ...row };
    },
    async getChallengeEntry(profileId, key) {
      const row = challengeEntries.get(`${profileId}|${key}`);
      return row ? { ...row } : null;
    },
    async listChallengeBoard(key, { rounds, limit = 20 }) {
      return [...challengeEntries.values()]
        .filter((e) => e.key === key && e.rounds >= rounds)
        .sort((a, b) => b.total - a.total || (a.finishedAt?.getTime() || 0) - (b.finishedAt?.getTime() || 0))
        .slice(0, limit)
        .map((e) => ({ ...e, profile: { id: e.profileId, name: profiles.get(e.profileId)?.name || 'Player', equipped: profiles.get(e.profileId)?.equipped || null } }));
    },
    async countChallengeEntries(key, { rounds } = {}) {
      return [...challengeEntries.values()].filter((e) => e.key === key && (!rounds || e.rounds >= rounds)).length;
    },
    async countChallengeBetter(key, { rounds, total, finishedAt }) {
      const mine = finishedAt instanceof Date ? finishedAt.getTime() : Number(finishedAt) || 0;
      return [...challengeEntries.values()].filter(
        (e) => e.key === key && e.rounds >= rounds && (e.total > total || (e.total === total && (e.finishedAt?.getTime() || 0) < mine))
      ).length;
    },
    // The weekly cup's prizes, paid once per week (server/challenges.js)
    async claimChallengeFinal(key, now, prizes = 0) {
      if (finals.has(key)) return false;
      finals.set(key, { key, finalizedAt: new Date(now), prizes });
      return true;
    },
    async getChallengeFinal(key) {
      const row = finals.get(key);
      return row ? { ...row } : null;
    },

    // Points, unlocks and badges (server/points.js)
    async getProfilesByIds(ids) {
      return ids.map((pid) => profiles.get(pid)).filter(Boolean).map((p) => ({ ...p }));
    },
    async createLedger(data) {
      const k = `${data.profileId}|${data.ref}`;
      if (ledger.has(k)) return null;
      const row = { id: id('ledger'), ...data };
      ledger.set(k, row);
      return { ...row };
    },
    async addPoints(profileId, delta, { requireBalance = false } = {}) {
      const profile = profiles.get(profileId);
      if (!profile) return false;
      if (requireBalance && delta < 0 && (profile.points || 0) < -delta) return false;
      profile.points = (profile.points || 0) + delta;
      return true;
    },
    async listLedger(profileId, limit = 20) {
      return [...ledger.values()]
        .filter((r) => r.profileId === profileId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
    async createUnlock(profileId, itemId, now) {
      const k = `${profileId}|${itemId}`;
      if (unlocks.has(k)) return null;
      const row = { id: id('unlock'), profileId, itemId, createdAt: new Date(now) };
      unlocks.set(k, row);
      return { ...row };
    },
    async listUnlocks(profileId) {
      return [...unlocks.values()].filter((u) => u.profileId === profileId).map((u) => ({ ...u }));
    },
    async upsertBadge(profileId, countryCode, km, now) {
      const k = `${profileId}|${countryCode}`;
      const existing = badges.get(k);
      if (!existing) {
        const row = { id: id('badge'), profileId, countryCode, bestKm: km, createdAt: new Date(now), updatedAt: new Date(now) };
        badges.set(k, row);
        return { badge: { ...row }, created: true };
      }
      if (km < existing.bestKm) existing.bestKm = km;
      existing.updatedAt = new Date(now);
      return { badge: { ...existing }, created: false };
    },
    async listBadges(profileId) {
      return [...badges.values()].filter((b) => b.profileId === profileId).sort((a, b) => b.createdAt - a.createdAt).map((b) => ({ ...b }));
    },
    async countBadges(profileId) {
      return [...badges.values()].filter((b) => b.profileId === profileId).length;
    },
    /** Test helper. */
    _dump() {
      return {
        rooms: [...rooms.values()],
        players: [...players.values()],
        rounds: [...rounds.values()],
        guesses: [...guesses.values()],
        profiles: [...profiles.values()],
        ratings: [...ratings.values()],
        results: [...results.values()],
        usage: [...usage.values()],
        challengeRounds: [...challengeRounds.values()],
        challengeEntries: [...challengeEntries.values()],
        ledger: [...ledger.values()],
        unlocks: [...unlocks.values()],
        badges: [...badges.values()],
      };
    },
  };
}
