/**
 * Caching Layer for ReunitePets
 *
 * Provides in-memory caching with optional Redis support.
 * Used for frequently accessed data like case lists, user profiles, etc.
 */

// In-memory cache for non-Redis environments
const memoryCache = new Map();
const cacheTimestamps = new Map();

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

// Redis client (optional)
let redisClient = null;

/**
 * Initialize Redis connection (call once at startup)
 */
export async function initializeRedis() {
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis');
      redisClient = createClient({
        url: process.env.REDIS_URL,
      });

      redisClient.on('error', (err) => console.error('Redis error:', err));
      await redisClient.connect();
      console.log('Redis cache connected');
      return true;
    } catch (error) {
      console.warn('Redis not available, using in-memory cache:', error.message);
      redisClient = null;
      return false;
    }
  }
  return false;
}

/**
 * Get a value from cache
 */
export async function cacheGet(key) {
  try {
    // Try Redis first
    if (redisClient?.isOpen) {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    }

    // Fall back to memory cache
    const timestamp = cacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp < DEFAULT_TTL) {
      return memoryCache.get(key);
    }

    // Expired or not found
    memoryCache.delete(key);
    cacheTimestamps.delete(key);
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set a value in cache
 */
export async function cacheSet(key, value, ttlSeconds = DEFAULT_TTL / 1000) {
  try {
    // Try Redis first
    if (redisClient?.isOpen) {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    }

    // Fall back to memory cache
    memoryCache.set(key, value);
    cacheTimestamps.set(key, Date.now());
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key) {
  try {
    if (redisClient?.isOpen) {
      await redisClient.del(key);
    }
    memoryCache.delete(key);
    cacheTimestamps.delete(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function cacheDeletePattern(pattern) {
  try {
    if (redisClient?.isOpen) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

    // For memory cache, iterate and match
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }
    return true;
  } catch (error) {
    console.error('Cache delete pattern error:', error);
    return false;
  }
}

/**
 * Clear all cache
 */
export async function cacheClear() {
  try {
    if (redisClient?.isOpen) {
      await redisClient.flushDb();
    }
    memoryCache.clear();
    cacheTimestamps.clear();
    return true;
  } catch (error) {
    console.error('Cache clear error:', error);
    return false;
  }
}

/**
 * Cache wrapper - get from cache or fetch and cache
 */
export async function cacheWrap(key, fetchFn, ttlSeconds = DEFAULT_TTL / 1000) {
  // Try to get from cache first
  const cached = await cacheGet(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const value = await fetchFn();

  // Cache the result
  await cacheSet(key, value, ttlSeconds);

  return value;
}

// Cache key generators
export const cacheKeys = {
  // Case-related keys
  case: (id) => `case:${id}`,
  missionList: (filters) => `cases:list:${JSON.stringify(filters)}`,
  caseCount: (status) => `cases:count:${status || 'all'}`,
  caseSightings: (missionId) => `case:${missionId}:sightings`,

  // User-related keys
  user: (id) => `user:${id}`,
  userProfile: (id) => `user:${id}:profile`,
  userStats: (id) => `user:${id}:stats`,
  userCases: (id) => `user:${id}:cases`,

  // Force-related keys
  force: (id) => `force:${id}`,
  squadMembers: (id) => `force:${id}:members`,
  squadList: (filters) => `forces:list:${JSON.stringify(filters)}`,

  // Analytics
  dailyStats: (date) => `analytics:daily:${date}`,
  dashboardStats: () => 'analytics:dashboard',

  // Search results
  searchResults: (query) => `search:${query}`,
  nearbyPets: (lat, lng, radius) => `nearby:${lat}:${lng}:${radius}`,

  // Public pages (longer TTL)
  sitemap: () => 'public:sitemap',
  homeStats: () => 'public:homeStats',
};

// TTL constants (in seconds)
export const cacheTTL = {
  SHORT: 60,          // 1 minute - for rapidly changing data
  MEDIUM: 300,        // 5 minutes - default
  LONG: 900,          // 15 minutes - for stable data
  HOUR: 3600,         // 1 hour - for static content
  DAY: 86400,         // 24 hours - for rarely changing data
};

/**
 * Cached data fetcher with stale-while-revalidate pattern
 */
export async function cacheWithSWR(key, fetchFn, ttlSeconds = cacheTTL.MEDIUM) {
  const cached = await cacheGet(key);

  // If we have cached data, return it immediately
  if (cached !== null) {
    // Revalidate in background if older than half TTL
    const timestamp = cacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp > (ttlSeconds * 1000) / 2) {
      // Background revalidation - don't await
      fetchFn().then((value) => {
        cacheSet(key, value, ttlSeconds);
      }).catch(console.error);
    }
    return cached;
  }

  // No cache, fetch fresh
  const value = await fetchFn();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

/**
 * Invalidate cache for a specific entity
 */
export async function invalidateCache(entityType, entityId) {
  const patterns = {
    case: [
      cacheKeys.case(entityId),
      `case:${entityId}:*`,
      'cases:list:*',
      'cases:count:*',
      'public:homeStats',
    ],
    user: [
      cacheKeys.user(entityId),
      cacheKeys.userProfile(entityId),
      cacheKeys.userStats(entityId),
      cacheKeys.userCases(entityId),
    ],
    force: [
      cacheKeys.force(entityId),
      cacheKeys.squadMembers(entityId),
      'forces:list:*',
    ],
  };

  const keysToDelete = patterns[entityType] || [];
  for (const key of keysToDelete) {
    if (key.includes('*')) {
      await cacheDeletePattern(key);
    } else {
      await cacheDelete(key);
    }
  }
}

// Periodic cleanup of expired memory cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > DEFAULT_TTL) {
      memoryCache.delete(key);
      cacheTimestamps.delete(key);
    }
  }
}, 60000); // Run every minute
