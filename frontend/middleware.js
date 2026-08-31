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
  '/api/mobile/auth/login': { windowMs: 60000, maxRequests: 10 },
  '/api/auth/forgot-password': { windowMs: 60000, maxRequests: 5 },
  '/api/contact': { windowMs: 60000, maxRequests: 5 },
  '/api/geocode': { windowMs: 60000, maxRequests: 10 },
  // Higher than the other strict routes on purpose: letter-writing events
  // put a whole room of families behind one venue IP, and each lookup is
  // one cheap, un-stored Census call (see app/api/rasuwa/district).
  '/api/rasuwa/district': { windowMs: 60000, maxRequests: 60 },
  // Cheap and server-cached; a room of phones loading the sign page
  // must not 429 the signer counter.
  '/api/rasuwa/roster-count': { windowMs: 60000, maxRequests: 120 },
  // The upstream (Represent) allows 60/min from our one egress IP, so
  // the per-visitor cap stays low enough that a busy room cannot get
  // this server blocked for every Canadian at once.
  '/api/rasuwa/mp': { windowMs: 60000, maxRequests: 20 },
  // Anonymous finish-box counter. One completed wizard is one read plus
  // up to three writes, and a letter-writing event is a room of
  // families behind one venue IP; the limit must clear the room, not
  // just one person.
  '/api/rasuwa/tally': { windowMs: 60000, maxRequests: 120 },
  // One record per finished pass; a shared device at an event finishes
  // a handful of families an hour, not dozens a minute.
  '/api/rasuwa/letters': { windowMs: 60000, maxRequests: 10 },
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.googletagmanager.com https://cdn.apple-mapkit.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* https://*.apple-mapkit.com https://*.ls.apple.com",
      // docs.google.com / script.google.com / *.googleusercontent.com:
      // the embedded family roster form on /rasuwa/form (Google Forms
      // and Apps Script web apps; script iframes serve from
      // googleusercontent)
      "frame-src 'self' https://www.google.com https://*.apple.com https://*.apple-mapkit.com https://maps.apple.com https://docs.google.com https://script.google.com https://*.googleusercontent.com",
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

  // One canonical domain. petrecovery.org serves this same app, which
  // splits SEO authority and sessions across two hosts; 301 every
  // request to the brand domain, path and query intact.
  const host = request.headers.get('host') || '';
  if (host === 'petrecovery.org' || host === 'www.petrecovery.org') {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = 'www.reunitepets.org';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // rescueourfamily.org is the families' own domain: browsers and link
  // scanners fetch /favicon.ico and /apple-touch-icon*.png directly at
  // the domain root, and those must never answer with pet-site branding.
  // The rasuwa pages set their own icon links; this covers the bare
  // requests. The matcher below deliberately does NOT exclude
  // favicon.ico so this branch can see it.
  if (host === 'rescueourfamily.org' || host === 'www.rescueourfamily.org') {
    if (pathname === '/favicon.ico') {
      return NextResponse.rewrite(new URL('/rasuwa/favicon.ico', request.url));
    }
    if (/^\/apple-touch-icon(-precomposed)?\.png$/.test(pathname)) {
      return NextResponse.rewrite(new URL('/rasuwa/apple-icon-180.png', request.url));
    }
    // The family domain shows the family pages and nothing else: any
    // pet-site route served under rescueourfamily.org would carry pet
    // chrome and the pet favicon. Assets, the rasuwa API, the tool's
    // aliases, and robots pass; every other path lands on the sign
    // page. (/ and /form are already redirected in next.config.js,
    // which runs before middleware.)
    const familyAllowed =
      pathname.startsWith('/rasuwa') ||
      pathname.startsWith('/api/rasuwa') ||
      pathname.startsWith('/_next') ||
      pathname === '/nepal' ||
      pathname === '/action' ||
      pathname === '/robots.txt';
    if (!familyAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/rasuwa/form';
      url.search = '';
      return NextResponse.redirect(url, 307);
    }
  }

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
      // A signed-in non-admin who follows an /admin link is a person, not
      // a script. Handing them a raw JSON body - which is what this did -
      // shows them {"error":"Forbidden"} as the entire page. Send API
      // callers the JSON they can parse, and send browsers somewhere with
      // a navbar on it.
      const wantsHtml = (request.headers.get('accept') || '').includes('text/html');

      if (wantsHtml && !pathname.startsWith('/api/')) {
        const deniedUrl = new URL('/dashboard', request.url);
        deniedUrl.searchParams.set('denied', 'admin');
        return NextResponse.redirect(deniedUrl);
      }

      return new NextResponse(
        JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // CAPTCHA on the routes that mint accounts and reports.
  //
  // This used to check only that an x-recaptcha-token header EXISTED. A
  // bot sending `x-recaptcha-token: x` sailed through, so the check
  // stopped nothing while reading, to anyone auditing the file, like a
  // defence. Now the token is actually verified with Google, and a bad
  // one is refused.
  //
  // Off unless REQUIRE_CAPTCHA=true, and instrumentation.js refuses to
  // boot production with that flag set but no keys - so this cannot be
  // switched on into a state where it rejects every real visitor.
  if (
    process.env.REQUIRE_CAPTCHA === 'true' &&
    request.method === 'POST' &&
    CAPTCHA_ROUTES.some(route => pathname.startsWith(route))
  ) {
    // Header only, never the body: reading the body here would consume
    // the stream the route handler needs.
    const captchaToken = request.headers.get('x-recaptcha-token');

    const captchaFailure = (message) => new NextResponse(
      JSON.stringify({
        error: 'CAPTCHA required',
        message,
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

    if (!captchaToken) {
      return captchaFailure('Please complete the security verification');
    }

    const { verifyCaptchaV3 } = await import('@/app/lib/captcha');
    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteIp = forwardedFor ? forwardedFor.split(',')[0].trim() : null;
    const verdict = await verifyCaptchaV3(captchaToken, null, remoteIp);

    if (!verdict.success) {
      return captchaFailure(verdict.error || 'Security verification failed');
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
     * - public folder
     * favicon.ico is NOT excluded: the rescueourfamily.org branch above
     * rewrites it per host, and the static-extension fast path passes
     * it through untouched everywhere else.
     */
    '/((?!_next/static|_next/image|public/).*)',
  ],
};
