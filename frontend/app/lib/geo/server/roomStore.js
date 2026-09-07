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
};
