/**
 * Next.js Middleware
 *
 * Handles request-level security including:
 * - Rate limiting
 * - CAPTCHA enforcement
 * - Security headers
 * - Request validation
 */

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map();

/**
 * Rate limiter configuration
 * Routes not listed here use the default config
 */
const RATE_LIMIT_CONFIG = {
  // Strict: Auth endpoints
  '/api/auth/register': { windowMs: 60000, maxRequests: 5 },
  '/api/auth/login': { windowMs: 60000, maxRequests: 10 },
  '/api/auth/forgot-password': { windowMs: 60000, maxRequests: 5 },
  '/api/contact': { windowMs: 60000, maxRequests: 5 },
  '/api/geocode': { windowMs: 60000, maxRequests: 10 },
  '/api/admin/bulk': { windowMs: 60000, maxRequests: 5 },
  // Lenient: Frequently accessed endpoints
  '/api/dashboard': { windowMs: 60000, maxRequests: 30 },
  '/api/public/homepage': { windowMs: 60000, maxRequests: 60 },
  '/api/public/missions': { windowMs: 60000, maxRequests: 60 },
  '/api/missions': { windowMs: 60000, maxRequests: 120 },
  '/api/mission': { windowMs: 60000, maxRequests: 120 },
  // Default for other API routes
  default: { windowMs: 60000, maxRequests: 60 },
};

/**
 * Protected routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/settings',
  '/missions/new',
  '/missions/edit',
  '/rescue-forces/create',
  '/admin',
];

/**
 * Admin-only routes
 */
const ADMIN_ROUTES = [
  '/admin',
  '/api/admin',
];

/**
 * Routes that require CAPTCHA
 */
const CAPTCHA_ROUTES = [
  '/api/auth/register',
  '/api/missions',
  '/api/contact',
  '/api/reports',
];

/**
 * Get client IP from request
 */
function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Check rate limit
 */
function checkRateLimit(key, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get existing entries for this key
  const entries = rateLimitMap.get(key) || [];

  // Filter to only entries within the window
  const recentEntries = entries.filter(time => time > windowStart);

  // Check if limit exceeded
  if (recentEntries.length >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.ceil((recentEntries[0] + config.windowMs - now) / 1000),
    };
  }

  // Add current request
  recentEntries.push(now);
  rateLimitMap.set(key, recentEntries);

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitMap();
  }

  return {
    allowed: true,
    remaining: config.maxRequests - recentEntries.length,
    resetTime: Math.ceil(config.windowMs / 1000),
  };
}

/**
 * Cleanup old rate limit entries
 */
function cleanupRateLimitMap() {
  const now = Date.now();
  const maxWindow = 300000; // 5 minutes

  for (const [key, entries] of rateLimitMap.entries()) {
    const recent = entries.filter(time => now - time < maxWindow);
    if (recent.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, recent);
    }
  }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response) {
  // Content Security Policy - relaxed for development
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.googletagmanager.com https://unpkg.com https://cdn.apple-mapkit.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* https://*.apple-mapkit.com https://*.ls.apple.com",
      "frame-src 'self' https://www.google.com https://*.apple.com https://*.apple-mapkit.com https://maps.apple.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'self' blob:",
    ].join('; ')
  );

  // Other security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

  return response;
}

/**
 * Main middleware function
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const clientIp = getClientIp(request);

  // FAST PATH: Immediately reject obvious bot probes and invalid paths
  // This prevents wasting resources on WordPress scanners, PHP probes, etc.
  if (
    pathname.endsWith('.php') ||
    pathname.includes('wp-admin') ||
    pathname.includes('wp-content') ||
    pathname.includes('wp-includes') ||
    pathname.includes('.well-known/') ||
    pathname.includes('xmlrpc') ||
    pathname.includes('phpmyadmin') ||
    pathname.includes('mysql') ||
    pathname.includes('.env') ||
    pathname.includes('.git')
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // Health check endpoint for deployment - respond immediately
  if (pathname === '/api/health' || pathname === '/_health') {
    return new NextResponse(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Skip middleware for static assets and files with common extensions
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api/auth') || // Let NextAuth handle its own routes
    /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot|map|json)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check rate limits for API routes
  if (pathname.startsWith('/api')) {
    // Find matching rate limit config
    const configKey = Object.keys(RATE_LIMIT_CONFIG)
      .filter(key => key !== 'default')
      .find(key => pathname.startsWith(key));

    const config = RATE_LIMIT_CONFIG[configKey || 'default'];
    // Use specific route path for rate limit bucket, not shared "default"
    const rateLimitKey = `${clientIp}:${configKey || pathname}`;

    const rateLimit = checkRateLimit(rateLimitKey, config);

    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please try again later',
          retryAfter: rateLimit.resetTime,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': rateLimit.resetTime.toString(),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // Check authentication for protected routes
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));

  if (isProtectedRoute || isAdminRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // Redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check admin access
    if (isAdminRoute && token.role !== 'ADMIN') {
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Check CAPTCHA requirement for specific routes
  if (request.method === 'POST' && CAPTCHA_ROUTES.some(route => pathname.startsWith(route))) {
    const captchaToken = request.headers.get('x-recaptcha-token');

    // If no CAPTCHA token and route requires it, return challenge
    if (!captchaToken && process.env.REQUIRE_CAPTCHA === 'true') {
      return new NextResponse(
        JSON.stringify({
          error: 'CAPTCHA required',
          message: 'Please complete the security verification',
          captchaRequired: true,
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Captcha-Required': 'true',
          },
        }
      );
    }
  }

  // Continue with request and add security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

/**
 * Matcher configuration
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
