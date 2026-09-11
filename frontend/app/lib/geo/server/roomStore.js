/**
 * The room store on Prisma. Same contract as memoryRoomStore.js.
 * updateRoom with expectVersion is an updateMany on (id, version), so
 * exactly one of two racing requests wins a phase transition.
 */

import prisma from '@/app/lib/geo/server/db';
import { seasonFor } from '@/app/lib/geo/season';

const include = {
  players: { orderBy: { joinedAt: 'asc' } },
  rounds: { include: { guesses: true }, orderBy: { index: 'asc' } },
};

export const prismaRoomStore = {
  getRoomByCode(code) {
    return prisma.geoRoom.findUnique({ where: { code }, include });
  },
  getRoomById(id) {
    return prisma.geoRoom.findUnique({ where: { id }, include });
  },
  listPublicRooms({ since }) {
    return prisma.geoRoom.findMany({
      where: { visibility: 'public', status: { in: ['lobby', 'playing'] }, lastActiveAt: { gte: new Date(since) } },
      include: { players: true, rounds: { select: { index: true } } },
      orderBy: { lastActiveAt: 'desc' },
      take: 30,
    });
  },
  createRoom(data) {
    return prisma.geoRoom.create({ data, include });
  },
  async updateRoom(id, data, { expectVersion } = {}) {
    const where = expectVersion === undefined ? { id } : { id, version: expectVersion };
    const result = await prisma.geoRoom.updateMany({ where, data });
    return result.count === 1;
  },
  createPlayer(data) {
    return prisma.geoRoomPlayer.create({ data });
  },
  updatePlayer(id, data) {
    return prisma.geoRoomPlayer.update({ where: { id }, data });
  },
  createRound(data) {
    return prisma.geoRoomRound.create({ data });
  },
  updateRound(id, data) {
    return prisma.geoRoomRound.update({ where: { id }, data });
  },
  upsertGuess({ roundId, playerId, ...data }) {
    return prisma.geoRoomGuess.upsert({
      where: { roundId_playerId: { roundId, playerId } },
      create: { roundId, playerId, ...data },
      update: data,
    });
  },

  // Profiles and ratings
  getProfileByTokenHash(tokenHash) {
    return prisma.geoProfile.findUnique({ where: { tokenHash } });
  },
  getProfileByAccountId(accountId) {
    return prisma.geoProfile.findUnique({ where: { accountId } });
  },

  // The game's own accounts (server/accounts.js). Not ReunitePets
  // users: a WanderGuesser player is not a pet-site user and does not
  // become one (docs/WANDERGUESSER_SPLIT.md, D1).
  getAccountByEmail(email) {
    return prisma.geoAccount.findUnique({ where: { email } });
  },
  getAccountById(id) {
    return prisma.geoAccount.findUnique({ where: { id } });
  },
  createAccount(data) {
    return prisma.geoAccount.create({ data });
  },
  updateAccount(id, data) {
    return prisma.geoAccount.update({ where: { id }, data });
  },
  createLoginToken(data) {
    return prisma.geoLoginToken.create({ data });
  },
  getLoginTokenByHash(tokenHash) {
    return prisma.geoLoginToken.findUnique({ where: { tokenHash } });
  },
  /** Burn a link. The usedAt guard makes a double click a no-op, not a second sign-in. */
  async useLoginToken(id, at) {
    const done = await prisma.geoLoginToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } });
    return done.count === 1;
  },
  /** Housekeeping: drop links nobody followed. */
  deleteExpiredLoginTokens(before) {
    return prisma.geoLoginToken.deleteMany({ where: { expiresAt: { lt: before } } });
  },
  getProfileById(id) {
    return prisma.geoProfile.findUnique({ where: { id } });
  },
  createProfile(data) {
    return prisma.geoProfile.create({ data });
  },
  updateProfile(id, data) {
    return prisma.geoProfile.update({ where: { id }, data });
  },
  // Ratings live per season (server/profiles.js); the current one by
  // default. Season "s0", everything before the first season, is the
  // original GeoRating table; the seasons are GeoSeasonRating.
  getRatings(profileIds, ladder, season = seasonFor().key) {
    if (!profileIds.length) return Promise.resolve([]);
    if (season === 's0') return prisma.geoRating.findMany({ where: { profileId: { in: profileIds }, ladder } }).then((rows) => rows.map((r) => ({ ...r, season: 's0' })));
    return prisma.geoSeasonRating.findMany({ where: { profileId: { in: profileIds }, ladder, season } });
  },
  upsertRating(profileId, ladder, data, season = seasonFor().key) {
    if (season === 's0') {
      return prisma.geoRating.upsert({
        where: { profileId_ladder: { profileId, ladder } },
        create: { profileId, ladder, ...data },
        update: data,
      });
    }
    return prisma.geoSeasonRating.upsert({
      where: { profileId_ladder_season: { profileId, ladder, season } },
      create: { profileId, ladder, season, ...data },
      update: data,
    });
  },
  createMatchResult(data) {
    return prisma.geoMatchResult.create({ data });
  },
  async claimRoomRating(roomId, now) {
    const result = await prisma.geoRoom.updateMany({ where: { id: roomId, ratedAt: null }, data: { ratedAt: new Date(now) } });
    return result.count === 1;
  },
  listLeaderboard(ladder, { limit = 50, minGames = 0, season = seasonFor().key } = {}) {
    const table = season === 's0' ? prisma.geoRating : prisma.geoSeasonRating;
    return table.findMany({
      where: season === 's0' ? { ladder, games: { gte: minGames } } : { ladder, season, games: { gte: minGames } },
      orderBy: [{ rating: 'desc' }, { games: 'desc' }],
      take: limit,
      include: { profile: { select: { id: true, name: true, equipped: true } } },
    });
  },
  getRecentResults(profileId, limit = 10) {
    return prisma.geoMatchResult.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' }, take: limit });
  },

  // The play meter (server/meter.js)
  listUsage(subjects, day) {
    if (!subjects.length) return Promise.resolve([]);
    return prisma.geoUsage.findMany({ where: { subject: { in: subjects }, day } });
  },
  async bumpUsage(subject, day, provider, inc = {}) {
    const data = { rounds: inc.rounds || 0, free: inc.free || 0, paid: inc.paid || 0, games: inc.games || 0 };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await prisma.geoUsage.upsert({
          where: { subject_day_provider: { subject, day, provider } },
          create: { subject, day, provider, ...data },
          update: { rounds: { increment: data.rounds }, free: { increment: data.free }, paid: { increment: data.paid }, games: { increment: data.games } },
        });
      } catch (error) {
        // Two first rounds of the day racing to create the row: retry once.
        if (error?.code !== 'P2002' || attempt) throw error;
      }
    }
    return null;
  },
  async consumePaidRound(profileId) {
    const result = await prisma.geoProfile.updateMany({ where: { id: profileId, paidRounds: { gt: 0 } }, data: { paidRounds: { decrement: 1 } } });
    return result.count === 1;
  },

  // Challenges with a board (server/challenges.js)
  async createChallengeRound(data) {
    try {
      return await prisma.geoChallengeRound.create({ data });
    } catch (error) {
      if (error?.code === 'P2002') return null; // the round was already counted
      throw error;
    }
  },
  async bumpChallengeEntry(profileId, key, { scoreDelta = 0, roundsDelta = 0, rounds, now }) {
    let row;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        row = await prisma.geoChallengeEntry.upsert({
          where: { profileId_key: { profileId, key } },
          create: { profileId, key, total: scoreDelta, rounds: roundsDelta, createdAt: new Date(now) },
          update: { total: { increment: scoreDelta }, rounds: { increment: roundsDelta } },
        });
        break;
      } catch (error) {
        if (error?.code !== 'P2002' || attempt) throw error;
      }
    }
    if (row && rounds && row.rounds >= rounds && !row.finishedAt) {
      row = await prisma.geoChallengeEntry.update({ where: { id: row.id }, data: { finishedAt: new Date(now) } });
    }
    return row;
  },
  getChallengeEntry(profileId, key) {
    return prisma.geoChallengeEntry.findUnique({ where: { profileId_key: { profileId, key } } });
  },
  listChallengeBoard(key, { rounds, limit = 20 }) {
    return prisma.geoChallengeEntry.findMany({
      where: { key, rounds: { gte: rounds } },
      orderBy: [{ total: 'desc' }, { finishedAt: 'asc' }],
      take: limit,
      include: { profile: { select: { id: true, name: true, equipped: true } } },
    });
  },
  countChallengeEntries(key, { rounds } = {}) {
    return prisma.geoChallengeEntry.count({ where: rounds ? { key, rounds: { gte: rounds } } : { key } });
  },
  countChallengeBetter(key, { rounds, total, finishedAt }) {
    return prisma.geoChallengeEntry.count({
      where: {
        key,
        rounds: { gte: rounds },
        OR: [{ total: { gt: total } }, { total, finishedAt: { lt: finishedAt } }],
      },
    });
  },

  // The weekly cup's prizes, paid once per week (server/challenges.js)
  async claimChallengeFinal(key, now, prizes = 0) {
    try {
      await prisma.geoChallengeFinal.create({ data: { key, finalizedAt: new Date(now), prizes } });
      return true;
    } catch (error) {
      if (error?.code === 'P2002') return false;
      throw error;
    }
  },
  getChallengeFinal(key) {
    return prisma.geoChallengeFinal.findUnique({ where: { key } });
  },

  // Points, unlocks and badges (server/points.js)
  getProfilesByIds(ids) {
    if (!ids.length) return Promise.resolve([]);
    return prisma.geoProfile.findMany({ where: { id: { in: ids } } });
  },
  async createLedger(data) {
    try {
      return await prisma.geoLedger.create({ data });
    } catch (error) {
      if (error?.code === 'P2002') return null; // this event was already paid
      throw error;
    }
  },
  async addPoints(profileId, delta, { requireBalance = false } = {}) {
    const where = requireBalance && delta < 0 ? { id: profileId, points: { gte: -delta } } : { id: profileId };
    const result = await prisma.geoProfile.updateMany({ where, data: { points: { increment: delta } } });
    return result.count === 1;
  },
  listLedger(profileId, limit = 20) {
    return prisma.geoLedger.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' }, take: limit });
  },
  async createUnlock(profileId, itemId, now) {
    try {
      return await prisma.geoUnlock.create({ data: { profileId, itemId, createdAt: new Date(now) } });
    } catch (error) {
      if (error?.code === 'P2002') return null;
      throw error;
    }
  },
  listUnlocks(profileId) {
    return prisma.geoUnlock.findMany({ where: { profileId }, orderBy: { createdAt: 'asc' } });
  },
  async upsertBadge(profileId, countryCode, km, now) {
    const existing = await prisma.geoBadge.findUnique({ where: { profileId_countryCode: { profileId, countryCode } } });
    if (!existing) {
      try {
        const row = await prisma.geoBadge.create({ data: { profileId, countryCode, bestKm: km, createdAt: new Date(now) } });
        return { badge: row, created: true };
      } catch (error) {
        if (error?.code !== 'P2002') throw error;
      }
    }
    const row = await prisma.geoBadge.update({
      where: { profileId_countryCode: { profileId, countryCode } },
      data: km < (existing?.bestKm ?? Infinity) ? { bestKm: km } : {},
    });
    return { badge: row, created: false };
  },
  listBadges(profileId) {
    return prisma.geoBadge.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' } });
  },
  countBadges(profileId) {
    return prisma.geoBadge.count({ where: { profileId } });
  },
};
