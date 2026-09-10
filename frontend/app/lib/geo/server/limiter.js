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
 * deploy.
 *
 * Redis being unreachable, or failing mid-command, falls back to memory
 * rather than to no limit. Connection attempts are bounded and shared,
 * so an unreachable host degrades in seconds instead of hanging every
 * request behind an endless retry, and one cold burst opens one client
 * rather than one per request. A failed command marks Redis unwell, so
 * the calls after it go straight to the window in memory.
 *
 * The pet limiter has a third tier that writes to a database table; the
 * game does not, deliberately. What these limits protect is pace, not
 * spend: the thing that stops the game costing money is the play meter
 * (docs/GEO.md, "The play meter"), which counts every round in Postgres
 * and survives anything. Losing a burst cap on restart is an
 * inconvenience; losing the meter would be a bill.
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

// One connection attempt, shared. A promise rather than a client,
// because a burst on a cold process would otherwise have every request
// see "not connected yet" and open a client of its own, and only the
// last would be kept while the rest stayed open.
let redisPromise = null;
// Whether commands are currently getting through. Separate from the
// connection: a client can be connected and then lose the server.
let redisReady = false;

async function connectRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  let client = null;
  try {
    // webpackIgnore keeps the bundler from following this. Without it,
    // anything importing this module drags redis into the Edge bundle
    // built for middleware, where its dependency on node:net cannot
    // resolve and the whole site fails. The import still works at
    // runtime under Node, which is the only place it is reached.
    const specifier = 'redis';
    const { createClient } = await import(/* webpackIgnore: true */ specifier);
    client = createClient({
      url,
      // An unreachable host has to fall through to memory at once. Left
      // to the defaults, node-redis queues commands and retries forever,
      // so a placeholder REDIS_URL would hang the first request to every
      // endpoint that limits rather than degrade to the fallback.
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => (retries >= 3 ? false : 250),
      },
    });
    let logged = false;
    client.on('error', (error) => {
      redisReady = false;
      if (!logged) {
        console.error('[geo/limiter] Redis error, using memory:', error?.message || error);
        logged = true;
      }
    });
    client.on('ready', () => {
      redisReady = true;
    });
    // connect() can still stall while the client retries, so cap the wait.
    const connecting = client.connect();
    // The race below can reject first, and this promise settles later.
    // Without a handler of its own that rejection is unhandled, which
    // can take the whole process down long after the fallback took over.
    connecting.catch(() => {});
    await Promise.race([
      connecting,
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('redis connect timeout')), 3000);
        timer.unref?.();
      }),
    ]);
    redisReady = true;
    return client;
  } catch (error) {
    console.warn('[geo/limiter] Redis unavailable, using memory:', error?.message || error);
    // Teardown of a client that never opened throws, and node-redis
    // reports some of that asynchronously, so swallow both shapes.
    try {
      await Promise.resolve(client?.disconnect?.()).catch(() => {});
    } catch {
      /* already gone */
    }
    return null;
  }
}

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (redisPromise === null) redisPromise = connectRedis();
  const client = await redisPromise;
  return client && redisReady ? client : null;
}

async function checkRedis(redis, key, settings) {
  const { windowMs, maxRequests, blockDurationMs } = settings;
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
    // A limiter that is down must not take the game down with it, and it
    // must not wave everything through either. Redis is marked unwell so
    // the calls after this one skip it, and this one falls back to the
    // memory window this module documents rather than to no limit at all.
    redisReady = false;
    console.error('[geo/limiter] Redis command failed, using memory:', error?.message || error);
    return checkMemory(key, settings);
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

/** Test helper: forget every window, block and connection attempt. */
export function _resetLimiter() {
  windows.clear();
  blocks.clear();
  redisPromise = null;
  redisReady = false;
}
