/**
 * The game's rate limiter.
 *
 * The game owns this so that nothing under app/api/geo or app/lib/geo
 * imports the pet site's limiter (docs/WANDERGUESSER_SPLIT.md, phase
 * 1.2). Same fixed-window shape and the same result object, so callers
 * did not change: { success, remaining, resetAt, blocked, retryAfter }.
 *
 * Two backends. Redis when REDIS_URL is set, which holds across
 * instances and restarts. Otherwise per-process memory, which forgets on
 * deploy. The pet limiter has a third tier that writes to a database
 * table; the game does not, deliberately. What these limits protect is
 * pace, not spend: the thing that stops the game costing money is the
 * play meter (docs/GEO.md, "The play meter"), which counts every round
 * in Postgres and survives anything. Losing a burst cap on restart is
 * an inconvenience; losing the meter would be a bill.
 *
 * Server only.
 */

const windows = new Map(); // key -> { count, windowStart }
const blocks = new Map(); // key -> blocked-until ms

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let sweepTimer = null;

/** Drop windows and blocks that have expired, so the maps cannot grow without bound. */
function startSweep() {
  if (sweepTimer || typeof setInterval !== 'function') return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of windows) {
      if (now - data.windowStart > data.windowMs) windows.delete(key);
    }
    for (const [key, until] of blocks) {
      if (now >= until) blocks.delete(key);
    }
  }, SWEEP_INTERVAL_MS);
  // Never hold the process open for a cleanup pass.
  sweepTimer.unref?.();
}

/** Presets, matching the pet site's so the numbers in review stay comparable. */
export const RateLimitPresets = {
  /** Public form submissions: opening a room, joining one. */
  PUBLIC_WRITE: { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 5 * 60 * 1000 },
  /** Public reads. */
  PUBLIC_READ: { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 60 * 1000 },
};

/**
 * The address behind a request.
 *
 * The leftmost x-forwarded-for entry is client-controlled and spoofable:
 * an attacker sending a fresh value per request mints a fresh bucket
 * every time. In production set RATELIMIT_TRUSTED_IP_HEADER to the
 * header the edge injects with the real address. Without it every limit
 * here is advisory, which is why the play meter, not this file, is what
 * caps spend.
 */
export function getClientIP(request) {
  const trusted = process.env.RATELIMIT_TRUSTED_IP_HEADER;
  if (trusted) {
    const value = request.headers.get(trusted.toLowerCase());
    if (value) return value.split(',')[0].trim();
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

function allow(remaining, resetAt) {
  return { success: true, remaining, resetAt, blocked: false };
}

function deny(until, now) {
  return {
    success: false,
    remaining: 0,
    resetAt: until,
    blocked: true,
    retryAfter: Math.max(1, Math.ceil((until - now) / 1000)),
  };
}

function checkMemory(key, { windowMs, maxRequests, blockDurationMs }) {
  startSweep();
  const now = Date.now();

  const blockedUntil = blocks.get(key);
  if (blockedUntil && now < blockedUntil) return deny(blockedUntil, now);

  const data = windows.get(key);
  if (!data || now - data.windowStart > windowMs) {
    windows.set(key, { count: 1, windowStart: now, windowMs });
    return allow(maxRequests - 1, now + windowMs);
  }

  data.count += 1;
  if (data.count > maxRequests) {
    const until = now + blockDurationMs;
    blocks.set(key, until);
    return deny(until, now);
  }
  return allow(maxRequests - data.count, data.windowStart + windowMs);
}

// Redis, connected once and lazily. `false` means "checked, unavailable",
// which is different from "not checked yet".
let redisClient = null;

async function getRedis() {
  if (redisClient !== null) return redisClient || null;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = false;
    return null;
  }
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url });
    client.on('error', () => {});
    await client.connect();
    redisClient = client;
    return client;
  } catch (error) {
    console.error('[geo/limiter] Redis unavailable, using memory:', error?.message || error);
    redisClient = false;
    return null;
  }
}

async function checkRedis(redis, key, { windowMs, maxRequests, blockDurationMs }) {
  const now = Date.now();
  const windowKey = `geolimit:${key}`;
  const blockKey = `geolimit:block:${key}`;
  try {
    const blockedUntil = await redis.get(blockKey);
    if (blockedUntil && now < Number(blockedUntil)) return deny(Number(blockedUntil), now);

    const count = await redis.incr(windowKey);
    if (count === 1) await redis.expire(windowKey, Math.ceil(windowMs / 1000));

    if (count > maxRequests) {
      const until = now + blockDurationMs;
      await redis.set(blockKey, String(until), { EX: Math.ceil(blockDurationMs / 1000) });
      return deny(until, now);
    }

    const ttl = await redis.ttl(windowKey);
    return allow(maxRequests - count, now + Math.max(0, ttl) * 1000);
  } catch (error) {
    // A limiter that is down must not take the game down with it.
    console.error('[geo/limiter] Redis check failed, allowing:', error?.message || error);
    return allow(maxRequests, now + windowMs);
  }
}

/**
 * Check a key the caller built: the per-player speed limit is keyed by
 * profile id rather than by address, so one household is not one player.
 */
export async function checkRateLimitForKeyAsync(key, options = {}) {
  const settings = {
    windowMs: options.windowMs ?? 60000,
    maxRequests: options.maxRequests ?? 30,
    blockDurationMs: options.blockDurationMs ?? 60000,
  };
  const redis = await getRedis();
  if (redis) return checkRedis(redis, key, settings);
  return checkMemory(key, settings);
}

/** The same check keyed by the requester's address. */
export async function withRateLimitAsync(request, preset, keyPrefix = 'geo') {
  return checkRateLimitForKeyAsync(`${keyPrefix}:${getClientIP(request)}`, preset);
}

/** The refusal, with the headers a well-behaved client reads. */
export function rateLimitResponse(result) {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Please slow down and try again later',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}

/** Test helper: forget every window and block. */
export function _resetLimiter() {
  windows.clear();
  blocks.clear();
}
