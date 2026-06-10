/**
 * Database Query Optimization Helpers
 *
 * Common patterns for optimizing Prisma queries.
 */

import prisma from './prisma';
import { cacheWrap, cacheKeys, cacheTTL, cacheDelete } from './cache';

/**
 * Get case with optimized includes
 * Uses select to minimize data transfer
 */
export async function getCaseOptimized(missionId, options = {}) {
  const { includeParticipants = false, includeSightings = false } = options;

  return prisma.case.findUnique({
    where: { id: missionId },
    select: {
      id: true,
      missionNumber: true,
      petName: true,
      petSpecies: true,
      petBreed: true,
      petColor: true,
      petSize: true,
      petPhotoUrl: true,
      petDescription: true,
      status: true,
      priority: true,
      lastSeenAt: true,
      lastSeenLatitude: true,
      lastSeenLongitude: true,
      lastSeenAddress: true,
      searchRadius: true,
      hasReward: true,
      rewardAmount: true,
      viewCount: true,
      shareCount: true,
      createdAt: true,
      updatedAt: true,
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      ...(includeParticipants && {
        assignments: {
          select: {
            id: true,
            rescueSquad: {
              select: { id: true, name: true },
            },
            participants: {
              take: 10,
              select: {
                user: {
                  select: { id: true, firstName: true },
                },
              },
            },
          },
        },
      }),
      ...(includeSightings && {
        sightings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            latitude: true,
            longitude: true,
            address: true,
            sightedAt: true,
            certaintyLevel: true,
            isVerified: true,
          },
        },
      }),
    },
  });
}

/**
 * Get cached case
 */
export async function getCaseCached(missionId, options = {}) {
  const key = cacheKeys.case(missionId);

  return cacheWrap(
    key,
    () => getCaseOptimized(missionId, options),
    cacheTTL.MEDIUM
  );
}

/**
 * Get cases list with cursor-based pagination
 * More efficient than offset pagination for large datasets
 */
export async function getCasesWithCursor(options = {}) {
  const {
    cursor,
    limit = 20,
    status,
    species,
    location,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const where = {};

  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status;
  }

  if (species) {
    where.petSpecies = species;
  }

  if (location) {
    // Location-based filtering using bounding box
    where.lastSeenLatitude = {
      gte: location.lat - location.radiusLat,
      lte: location.lat + location.radiusLat,
    };
    where.lastSeenLongitude = {
      gte: location.lng - location.radiusLng,
      lte: location.lng + location.radiusLng,
    };
  }

  const cases = await prisma.case.findMany({
    where,
    take: limit + 1, // Fetch one extra to determine if there's more
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor item
    }),
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      missionNumber: true,
      petName: true,
      petSpecies: true,
      petBreed: true,
      petColor: true,
      petPhotoUrl: true,
      status: true,
      lastSeenLatitude: true,
      lastSeenLongitude: true,
      lastSeenAddress: true,
      createdAt: true,
    },
  });

  const hasMore = cases.length > limit;
  const items = hasMore ? cases.slice(0, -1) : cases;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Batch fetch users by IDs
 * Prevents N+1 queries
 */
export async function batchGetUsers(userIds) {
  if (!userIds.length) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      rescueLevel: true,
      profileImage: true,
    },
  });

  return new Map(users.map((u) => [u.id, u]));
}

/**
 * Get squad with member count (optimized)
 */
export async function getSquadWithStats(squadId) {
  const [squad, memberCount, activeCaseCount] = await Promise.all([
    prisma.rescueForce.findUnique({
      where: { id: squadId },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        city: true,
        state: true,
        isActive: true,
        isAcceptingCases: true,
        rescueSquadLevel: true,
        totalCasesCompleted: true,
        successfulReunions: true,
      },
    }),
    prisma.rescueForceMember.count({
      where: { rescueSquadId: squadId, isActive: true },
    }),
    prisma.caseAssignment.count({
      where: {
        rescueSquadId: squadId,
        status: { in: ['ACCEPTED', 'ACTIVE'] },
      },
    }),
  ]);

  if (!squad) return null;

  return {
    ...squad,
    memberCount,
    activeCaseCount,
  };
}

/**
 * Get nearby cases using geographic filtering
 * Uses bounding box first, then calculates actual distance
 */
export async function getNearbyCases(lat, lng, radiusMiles = 10, limit = 50) {
  // Convert miles to approximate lat/lng degrees
  const latDelta = radiusMiles / 69; // 1 degree lat ≈ 69 miles
  const lngDelta = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));

  const cases = await prisma.case.findMany({
    where: {
      status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      lastSeenLatitude: {
        gte: lat - latDelta,
        lte: lat + latDelta,
      },
      lastSeenLongitude: {
        gte: lng - lngDelta,
        lte: lng + lngDelta,
      },
    },
    take: limit * 2, // Fetch extra for distance filtering
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      missionNumber: true,
      petName: true,
      petSpecies: true,
      petPhotoUrl: true,
      status: true,
      lastSeenLatitude: true,
      lastSeenLongitude: true,
      lastSeenAddress: true,
      createdAt: true,
    },
  });

  // Calculate actual distance and filter
  const withDistance = cases
    .map((c) => ({
      ...c,
      distance: haversineDistance(
        lat,
        lng,
        c.lastSeenLatitude,
        c.lastSeenLongitude
      ),
    }))
    .filter((c) => c.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return withDistance;
}

/**
 * Haversine formula for calculating distance between two points
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get aggregated stats (cached)
 */
export async function getAggregatedStats() {
  const key = cacheKeys.dashboardStats();

  return cacheWrap(
    key,
    async () => {
      const [
        totalCases,
        activeMissions,
        reunions,
        totalUsers,
        totalSquads,
      ] = await Promise.all([
        prisma.case.count(),
        prisma.case.count({ where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
        prisma.case.count({ where: { status: 'REUNITED' } }),
        prisma.user.count(),
        prisma.rescueForce.count({ where: { isActive: true, isDeleted: false } }),
      ]);

      return {
        totalCases,
        activeMissions,
        reunions,
        reunionRate: totalCases > 0 ? (reunions / totalCases * 100).toFixed(1) : 0,
        totalUsers,
        totalSquads,
        updatedAt: new Date().toISOString(),
      };
    },
    cacheTTL.MEDIUM
  );
}

/**
 * Invalidate case-related caches
 */
export async function invalidateCaseCache(missionId) {
  await cacheDelete(cacheKeys.case(missionId));
  await cacheDelete(cacheKeys.caseSightings(missionId));
  await cacheDelete(cacheKeys.dashboardStats());
}

/**
 * Raw query for complex aggregations
 * Use when Prisma's aggregations are insufficient
 */
export async function getMonthlyStats(year) {
  const result = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('month', "createdAt") as month,
      COUNT(*) as total_cases,
      COUNT(*) FILTER (WHERE status = 'REUNITED') as reunions
    FROM "Case"
    WHERE EXTRACT(YEAR FROM "createdAt") = ${year}
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY month ASC
  `;

  return result;
}

/**
 * Bulk insert with chunking
 * Prevents memory issues with large datasets
 */
export async function bulkInsertChunked(model, data, chunkSize = 100) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }

  let totalInserted = 0;

  for (const chunk of chunks) {
    const result = await prisma[model].createMany({
      data: chunk,
      skipDuplicates: true,
    });
    totalInserted += result.count;
  }

  return { inserted: totalInserted };
}

/**
 * Transaction wrapper with retry
 */
export async function withRetry(operation, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Retry on connection errors or deadlocks
      const retryable =
        error.code === 'P2024' || // Connection pool timeout
        error.code === 'P2034' || // Transaction conflict
        error.message.includes('deadlock');

      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
    }
  }

  throw lastError;
}
