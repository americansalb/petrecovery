/**
 * The room store on Prisma. Same contract as memoryRoomStore.js.
 * updateRoom with expectVersion is an updateMany on (id, version), so
 * exactly one of two racing requests wins a phase transition.
 */

import prisma from '@/app/lib/prisma';

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
  getProfileByUserId(userId) {
    return prisma.geoProfile.findUnique({ where: { userId } });
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
  getRatings(profileIds, ladder) {
    if (!profileIds.length) return Promise.resolve([]);
    return prisma.geoRating.findMany({ where: { profileId: { in: profileIds }, ladder } });
  },
  upsertRating(profileId, ladder, data) {
    return prisma.geoRating.upsert({
      where: { profileId_ladder: { profileId, ladder } },
      create: { profileId, ladder, ...data },
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
  listLeaderboard(ladder, { limit = 50, minGames = 0 } = {}) {
    return prisma.geoRating.findMany({
      where: { ladder, games: { gte: minGames } },
      orderBy: [{ rating: 'desc' }, { games: 'desc' }],
      take: limit,
      include: { profile: { select: { id: true, name: true } } },
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
    const data = { rounds: inc.rounds || 0, free: inc.free || 0, paid: inc.paid || 0 };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await prisma.geoUsage.upsert({
          where: { subject_day_provider: { subject, day, provider } },
          create: { subject, day, provider, ...data },
          update: { rounds: { increment: data.rounds }, free: { increment: data.free }, paid: { increment: data.paid } },
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
      include: { profile: { select: { id: true, name: true } } },
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
};
