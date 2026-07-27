/**
 * Mobile login bridge.
 *
 * The native app can't run the browser cookie/CSRF dance NextAuth uses, so
 * this endpoint validates email/password EXACTLY like the credentials
 * provider in app/lib/auth.js, then mints a real NextAuth session token with
 * the same secret. The app stores that token and sends it as the session
 * cookie on API calls, so every existing route that uses getServerSession
 * authenticates the app with ZERO changes. One backend, one session model.
 *
 * Rate-limited in middleware.js (/api/mobile/auth/login: 10/min).
 */
import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import prisma from '@/app/lib/prisma';

// Mirror of the SEC-18 block in app/lib/auth.js - keep in lockstep.
const SEC18_SEEDED_ADMINS = ['contact@aalb.org', 'sarama@petrecovery.app'];

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches authOptions

// Same generic message for every failure: never reveal whether an email is
// registered, unverified, or has the wrong password (no account-enumeration).
const INVALID = () =>
  NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

export async function POST(request) {
  try {
    const { email, password } = await request.json().catch(() => ({}));

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.passwordHash) return INVALID();
    if (SEC18_SEEDED_ADMINS.includes(user.email) && process.env.SEC18_ROTATED !== 'true') return INVALID();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return INVALID();

    if (!user.emailVerified) return INVALID();

    // Build the same claims authOptions' jwt callback puts on the token, so
    // getServerSession exposes the identical session.user shape to every route.
    const token = await encode({
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: SESSION_MAX_AGE,
      token: {
        id: user.id,
        sub: user.id,
        role: user.role,
        name: user.firstName,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
      },
    });

    // The cookie name getServerSession looks for depends on whether the site
    // runs on https (production). Tell the app exactly which name to send.
    const useSecure = (process.env.NEXTAUTH_URL || '').startsWith('https');
    const cookieName = useSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

    // Fire-and-forget activity stamp (must never block/fail login).
    Promise.resolve(
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastActive: new Date() },
      })
    ).catch(() => {});

    return NextResponse.json({
      token,
      cookieName,
      maxAge: SESSION_MAX_AGE,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[MOBILE AUTH] Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
