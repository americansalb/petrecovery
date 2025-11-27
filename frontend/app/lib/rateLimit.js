/**
 * In-memory rate limiting utility for API endpoints
 *
 * For MVP/single-instance deployments. For production scale,
 * consider Redis-based rate limiting (e.g., @upstash/ratelimit)
 */

// Store request counts per IP/key
const requestCounts = new Map();
const blockList = new Map();

// Clean up old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
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
  // Check various headers in order of preference
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback - in production this should always come from headers
  return 'unknown';
}

/**
 * Check if request should be rate limited
 *
 * @param {Request} request - The incoming request
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Max requests per window
 * @param {number} options.blockDurationMs - How long to block after exceeding
 * @param {string} [options.keyPrefix] - Optional prefix for the rate limit key
 * @returns {{ success: boolean, remaining: number, resetAt: number, blocked: boolean }}
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

  // Get or create request count for this key
  let data = requestCounts.get(key);

  if (!data || now - data.windowStart > windowMs) {
    // New window
    data = {
      count: 1,
      windowStart: now,
      windowMs
    };
    requestCounts.set(key, data);

    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
      blocked: false
    };
  }

  // Increment count
  data.count++;

  if (data.count > maxRequests) {
    // Block this IP
    const blockedUntil = now + blockDurationMs;
    blockList.set(key, blockedUntil);

    return {
      success: false,
      remaining: 0,
      resetAt: blockedUntil,
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
 * Convenience wrapper for rate limiting in API routes
 *
 * Usage:
 * ```
 * import { withRateLimit, RateLimitPresets } from '@/app/lib/rateLimit';
 *
 * export async function POST(request) {
 *   const rateLimitResult = withRateLimit(request, RateLimitPresets.AUTH, 'auth');
 *   if (!rateLimitResult.success) {
 *     return rateLimitResponse(rateLimitResult);
 *   }
 *   // ... rest of handler
 * }
 * ```
 */
export function withRateLimit(request, preset, keyPrefix) {
  return checkRateLimit(request, { ...preset, keyPrefix });
}
