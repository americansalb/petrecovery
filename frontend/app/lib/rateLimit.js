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
    // Bounded retries + no offline queue: a bad/unreachable REDIS_URL (for
    // example a placeholder hostname) must degrade to the in-memory limiter
    // instantly, never hang auth requests or spam reconnects forever.
    redisClient = createClient({
      url: redisUrl,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => (retries >= 3 ? false : 250),
      },
    });

    let loggedError = false;
    redisClient.on('error', (err) => {
      if (!loggedError) {
        console.error('Redis rate limit error (falling back to in-memory):', err.message);
        loggedError = true;
      }
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
    });

    // connect() can stall while the client retries; cap the wait outright.
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis connect timeout')), 3000)),
    ]);
    redisAvailable = true;
    return redisClient;
  } catch (err) {
    console.warn('Redis not available for rate limiting, using in-memory fallback:', err.message);
    try { redisClient?.disconnect?.(); } catch { /* ignore */ }
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
 * Get client IP from request headers.
 *
 * SECURITY: the leftmost x-forwarded-for entry is fully client-controlled and
 * spoofable, so an attacker can mint a fresh rate-limit bucket per request.
 * In production set RATELIMIT_TRUSTED_IP_HEADER to the header your edge/proxy
 * injects with the real client IP (e.g. 'x-real-ip', 'cf-connecting-ip',
 * 'true-client-ip') — that value can't be forged past a trusted proxy.
 * The leftmost-XFF path remains only as a last-resort fallback for local/dev.
 */
function getClientIP(request) {
  const trustedHeader = process.env.RATELIMIT_TRUSTED_IP_HEADER;
  if (trustedHeader) {
    const trusted = request.headers.get(trustedHeader.toLowerCase());
    if (trusted) {
      return trusted.split(',')[0].trim();
    }
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
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
 * Global (NOT per-IP) rate limit / spend ceiling.
 *
 * Unlike checkRateLimitAsync, this keys on a fixed name shared across ALL callers,
 * so it acts as a hard per-window ceiling — a circuit breaker for expensive
 * downstream work (e.g. paid AI calls). It defends total cost even when the
 * per-IP limit is evaded via IP rotation or a spoofed x-forwarded-for header.
 * Uses Redis when available, in-memory fallback otherwise.
 *
 * Usage:
 * ```
 * const ceiling = await checkGlobalLimitAsync('ai:analyze-pet', { windowMs: 60000, maxRequests: 100, blockDurationMs: 60000 });
 * if (!ceiling.success) return new Response('at capacity', { status: 503 });
 * ```
 */
export async function checkGlobalLimitAsync(name, options) {
  const {
    windowMs = 60000,
    maxRequests = 100,
    blockDurationMs = 60000,
  } = options;

  const key = `global:${name}`;
  const redis = await getRedisClient();

  if (redis) {
    // IMPORTANT: a cost/abuse ceiling must FAIL CLOSED. Unlike checkRateLimitRedis
    // (which swallows Redis errors and returns success:true — fine for an
    // availability limiter), here a Redis blip must NOT remove the cap. On any
    // Redis error we degrade to the in-memory counter (a real per-instance cap),
    // never allow-all.
    try {
      const windowSeconds = Math.ceil(windowMs / 1000);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      if (count > maxRequests) {
        const ttl = await redis.ttl(key);
        return {
          success: false,
          remaining: 0,
          resetAt: Date.now() + (ttl > 0 ? ttl * 1000 : windowMs),
          blocked: true,
          retryAfter: ttl > 0 ? ttl : Math.ceil(windowMs / 1000),
        };
      }
      const ttl = await redis.ttl(key);
      return {
        success: true,
        remaining: maxRequests - count,
        resetAt: Date.now() + (ttl > 0 ? ttl * 1000 : windowMs),
        blocked: false,
      };
    } catch (err) {
      // FAIL CLOSED, hard: a cost ceiling must reject when it can't verify the
      // count. An in-memory fallback would silently become a PER-INSTANCE cap
      // (aggregate N×ceiling across instances) — not the global guarantee. Since
      // callers of a global cost ceiling are expected to degrade gracefully
      // (e.g. analyze-pet is best-effort), rejecting here costs no critical UX.
      console.error('Global limit Redis op error — failing closed (reject):', err.message);
      return {
        success: false,
        remaining: 0,
        resetAt: Date.now() + windowMs,
        blocked: true,
        retryAfter: Math.ceil(windowMs / 1000),
      };
    }
  }

  return checkRateLimitMemory(key, { windowMs, maxRequests, blockDurationMs });
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
