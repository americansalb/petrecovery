import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';
import { createUser } from '@/app/lib/userService';
import crypto from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;
const PASSWORD_MIN_LENGTH = 8;

export async function POST(request) {
  const correlationId = crypto.randomUUID();

  const rateLimitResult = withRateLimit(request, RateLimitPresets.AUTH, 'auth:register');
  if (!rateLimitResult.success) {
    logEvent({
      event_type: 'auth.register_rate_limited',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
      result: 'failure',
      error_code: 'RATE_LIMITED',
      metadata: { blocked: rateLimitResult.blocked },
    }).catch(() => {});
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { email, password, firstName, phone, acceptedTerms } = await request.json();

    if (!email || !password || !firstName) {
      return NextResponse.json(
        { error: 'Email, password, and first name are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (firstName.trim().length < 1) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    if (phone) {
      const trimmedPhone = phone.trim();
      if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        return NextResponse.json(
          { error: 'Please enter a valid phone number' },
          { status: 400 }
        );
      }
    }

    // Email-enumeration-safe duplicate check: same generic message regardless.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      logEvent({
        event_type: 'auth.register_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_EXISTS',
        metadata: { email_prefix: normalizedEmail.substring(0, 3) },
      }).catch(() => {});
      return NextResponse.json(
        { error: 'Unable to create account. Please try again or use a different email.' },
        { status: 400 }
      );
    }

    const { user } = await createUser({
      email: normalizedEmail,
      firstName,
      phone,
      password,
      acceptedTerms,
      source: 'register',
      correlationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    logEvent({
      event_type: 'auth.register_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message || 'Unknown error',
    }).catch(() => {});
    return NextResponse.json(
      { error: 'Unable to create account. Please try again.' },
      { status: 500 }
    );
  }
}
