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
};
