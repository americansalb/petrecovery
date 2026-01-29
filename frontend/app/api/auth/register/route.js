import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';
import { sendVerificationEmail } from '@/app/lib/email';
import crypto from 'crypto';
import { getEmailBaseUrl } from '@/app/lib/config';

const BASE_URL = getEmailBaseUrl();

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (US format, flexible)
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;

// Password requirements
const PASSWORD_MIN_LENGTH = 8;

export async function POST(request) {
  const correlationId = crypto.randomUUID();

  // Apply rate limiting (strict for auth endpoints)
  const rateLimitResult = withRateLimit(request, RateLimitPresets.AUTH, 'auth:register');
  if (!rateLimitResult.success) {
    // Log without blocking response
    logEvent({
      event_type: 'auth.register_rate_limited',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
      result: 'failure',
      error_code: 'RATE_LIMITED',
      error_message: 'Rate limit exceeded',
      metadata: { blocked: rateLimitResult.blocked }
    }).catch(() => {});
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { email, password, firstName, phone, acceptedTerms } = await request.json();

    // Validate required fields
    if (!email || !password || !firstName) {
      return NextResponse.json(
        { error: 'Email, password, and first name are required' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Validate firstName (basic XSS prevention)
    const sanitizedFirstName = firstName.trim().substring(0, 100);
    if (sanitizedFirstName.length < 1) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    // Validate phone if provided
    let sanitizedPhone = null;
    if (phone) {
      const trimmedPhone = phone.trim();
      if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        return NextResponse.json(
          { error: 'Please enter a valid phone number' },
          { status: 400 }
        );
      }
      sanitizedPhone = trimmedPhone || null;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      // SECURITY: Return generic message to prevent email enumeration
      // Log without blocking response
      logEvent({
        event_type: 'auth.register_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_EXISTS',
        error_message: 'Email already registered',
        metadata: { email_prefix: normalizedEmail.substring(0, 3) }
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Unable to create account. Please try again or use a different email.' },
        { status: 400 }
      );
    }

    // Hash password with strong salt rounds
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate email verification token (hash before storing, send raw in email)
    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyToken = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with waiver acceptance if provided
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: sanitizedFirstName,
        phone: sanitizedPhone,
        role: 'USER',
        emailVerified: null, // Requires email verification
        emailVerifyToken,
        emailVerifyExpiry,
        // Set waiver acceptance if user accepted during registration
        ...(acceptedTerms && {
          waiverAcceptedAt: new Date(),
          waiverVersionAccepted: '1.0',
        }),
      },
    });

    // Send verification email (non-blocking)
    const verifyUrl = `${BASE_URL}/verify-email?token=${rawVerifyToken}`;
    sendVerificationEmail(normalizedEmail, sanitizedFirstName, verifyUrl).catch((err) => {
      console.error('Failed to send verification email:', err);
    });

    // Log success without blocking response
    logEvent({
      event_type: 'auth.register_succeeded',
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: user.id,
      action: 'create',
      result: 'success',
      metadata: { email_prefix: normalizedEmail.substring(0, 3) }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    // Log error without blocking response
    logEvent({
      event_type: 'auth.register_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message || 'Unknown error'
    }).catch(() => {});

    return NextResponse.json(
      { error: 'Unable to create account. Please try again.' },
      { status: 500 }
    );
  }
}
