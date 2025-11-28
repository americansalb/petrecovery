/**
 * Rate limiting utility for API endpoints
 *
 * Supports two modes:
 * 1. In-memory: For development and single-instance deployments
 * 2. Redis: For production multi-instance deployments
 *
 * Set REDIS_URL environment variable to enable Redis mode.
 */

// Redis client (lazy initialized)
let redisClient = null;
let redisAvailable = false;

// In-memory fallback stores
const requestCounts = new Map();
const blockList = new Map();

// Initialize Redis connection if REDIS_URL is set
async function getRedisClient() {
  if (redisClient !== null) {
    return redisAvailable ? redisClient : null;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    redisClient = false; // Mark as checked but unavailable
    return null;
  }

  try {
    // Dynamic import to avoid requiring redis in non-Redis environments
    const { createClient } = await import('redis');
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      console.error('Redis rate limit error:', err.message);
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
    });

    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch (err) {
    console.warn('Redis not available for rate limiting, using in-memory fallback');
    redisClient = false;
    return null;
  }
}

// Clean up old in-memory entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.windowStart > data.windowMs * 2) {
        requestCounts.delete(key);
      }
    }
    for (const [key, blockedUntil] of blockList.entries()) {
      if (now > blockedUntil) {
        blockList.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Rate limiter configuration presets
 */
export const RateLimitPresets = {
  // Strict: Auth endpoints (login, register, password reset)
  AUTH: { windowMs: 15 * 60 * 1000, maxRequests: 5, blockDurationMs: 30 * 60 * 1000 },

  // Moderate: Public form submissions
  PUBLIC_WRITE: { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 5 * 60 * 1000 },

  // Lenient: Public reads (case listing, metrics)
  PUBLIC_READ: { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 60 * 1000 },

  // File uploads
  UPLOAD: { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 5 * 60 * 1000 },

  // Standard API (authenticated)
  API: { windowMs: 60 * 1000, maxRequests: 100, blockDurationMs: 60 * 1000 },
};

/**
 * Get client IP from request headers
 */
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

/**
 * Check rate limit using Redis
 */
async function checkRateLimitRedis(redis, key, options) {
  const { windowMs, maxRequests, blockDurationMs } = options;
  const now = Date.now();
  const windowKey = `ratelimit:${key}`;
  const blockKey = `ratelimit:block:${key}`;

  try {
    // Check if blocked
    const blockedUntil = await redis.get(blockKey);
    if (blockedUntil && now < parseInt(blockedUntil)) {
      const ttl = parseInt(blockedUntil) - now;
      return {
        success: false,
        remaining: 0,
        resetAt: parseInt(blockedUntil),
        blocked: true,
        retryAfter: Math.ceil(ttl / 1000)
      };
    }

    // Use Redis MULTI for atomic operations
    const windowSeconds = Math.ceil(windowMs / 1000);

    // Increment counter
    const count = await redis.incr(windowKey);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(windowKey, windowSeconds);
    }

    // Check if over limit
    if (count > maxRequests) {
      const blockedUntilTime = now + blockDurationMs;
      await redis.set(blockKey, blockedUntilTime.toString(), {
        EX: Math.ceil(blockDurationMs / 1000)
      });

      return {
        success: false,
        remaining: 0,
        resetAt: blockedUntilTime,
        blocked: true,
        retryAfter: Math.ceil(blockDurationMs / 1000)
      };
    }

    const ttl = await redis.ttl(windowKey);
    return {
      success: true,
      remaining: maxRequests - count,
      resetAt: now + (ttl * 1000),
      blocked: false
    };
  } catch (err) {
    // Fallback to allowing request on Redis error
    console.error('Redis rate limit error:', err.message);
    return { success: true, remaining: maxRequests, resetAt: now + windowMs, blocked: false };
  }
}

/**
 * Check rate limit using in-memory store
 */
function checkRateLimitMemory(key, options) {
  const { windowMs, maxRequests, blockDurationMs } = options;
  const now = Date.now();

  // Check if IP is blocked
  const blockedUntil = blockList.get(key);
  if (blockedUntil && now < blockedUntil) {
    return {
      success: false,
      remaining: 0,
      resetAt: blockedUntil,
      blocked: true,
      retryAfter: Math.ceil((blockedUntil - now) / 1000)
    };
  }

  // Get or create request count
  let data = requestCounts.get(key);

  if (!data || now - data.windowStart > windowMs) {
    data = { count: 1, windowStart: now, windowMs };
    requestCounts.set(key, data);

    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
      blocked: false
    };
  }

  data.count++;

  if (data.count > maxRequests) {
    const blockedUntilTime = now + blockDurationMs;
    blockList.set(key, blockedUntilTime);

    return {
      success: false,
      remaining: 0,
      resetAt: blockedUntilTime,
      blocked: true,
      retryAfter: Math.ceil(blockDurationMs / 1000)
    };
  }

  return {
    success: true,
    remaining: maxRequests - data.count,
    resetAt: data.windowStart + windowMs,
    blocked: false
  };
}

/**
 * Check if request should be rate limited
 * Automatically uses Redis if available, falls back to in-memory
 */
export async function checkRateLimitAsync(request, options) {
  const {
    windowMs = 60000,
    maxRequests = 30,
    blockDurationMs = 60000,
    keyPrefix = 'default'
  } = options;

  const ip = getClientIP(request);
  const key = `${keyPrefix}:${ip}`;

  // Try Redis first
  const redis = await getRedisClient();
  if (redis) {
    return checkRateLimitRedis(redis, key, { windowMs, maxRequests, blockDurationMs });
  }

  // Fallback to in-memory
  return checkRateLimitMemory(key, { windowMs, maxRequests, blockDurationMs });
}

/**
 * Synchronous rate limit check (in-memory only)
 * Use this for backwards compatibility with existing code
 */
export function checkRateLimit(request, options) {
  const {
    windowMs = 60000,
    maxRequests = 30,
    blockDurationMs = 60000,
    keyPrefix = 'default'
  } = options;

  const ip = getClientIP(request);
  const key = `${keyPrefix}:${ip}`;

  return checkRateLimitMemory(key, { windowMs, maxRequests, blockDurationMs });
}

/**
 * Create rate limit response with proper headers
 */
export function rateLimitResponse(result) {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Please slow down and try again later',
      retryAfter: result.retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt)
      }
    }
  );
}

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(response, result) {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Convenience wrapper for rate limiting in API routes (synchronous)
 * Uses in-memory rate limiting for backwards compatibility
 */
export function withRateLimit(request, preset, keyPrefix) {
  return checkRateLimit(request, { ...preset, keyPrefix });
}

/**
 * Async convenience wrapper for rate limiting (uses Redis when available)
 *
 * Usage:
 * ```
 * import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
 *
 * export async function POST(request) {
 *   const rateLimitResult = await withRateLimitAsync(request, RateLimitPresets.AUTH, 'auth');
 *   if (!rateLimitResult.success) {
 *     return rateLimitResponse(rateLimitResult);
 *   }
 *   // ... rest of handler
 * }
 * ```
 */
export async function withRateLimitAsync(request, preset, keyPrefix) {
  return checkRateLimitAsync(request, { ...preset, keyPrefix });
}

/**
 * Check if Redis is being used for rate limiting
 */
export function isUsingRedis() {
  return redisAvailable;
}
