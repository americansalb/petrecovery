/**
 * Email Verification API
 * POST /api/auth/verify-email - Verify email with token
 * GET /api/auth/verify-email - Resend verification email
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { sendEmail, sendVerificationEmail } from '@/app/lib/email';
import { logEvent } from '@/lib/logging';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import crypto from 'crypto';
import { getEmailBaseUrl } from '@/app/lib/config';

export const dynamic = 'force-dynamic';

const BASE_URL = getEmailBaseUrl();

/**
 * POST - Verify email with token
 */
export async function POST(request) {
  const correlationId = crypto.randomUUID();

  // Apply rate limiting
  const rateLimitResult = await withRateLimitAsync(request, RateLimitPresets.AUTH,'auth:verify-email');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: hashedToken,
        emailVerifyExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      await logEvent({
        event_type: 'auth.email_verify_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'update',
        result: 'failure',
        error_code: 'INVALID_TOKEN',
        error_message: 'Token invalid or expired'
      });

      return NextResponse.json(
        { error: 'Invalid or expired verification link. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerifyToken: null,
        emailVerifyExpiry: null
      }
    });

    await logEvent({
      event_type: 'auth.email_verified',
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: user.id,
      action: 'update',
      result: 'success'
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });

  } catch (error) {
    console.error('Email verification error:', error);

    await logEvent({
      event_type: 'auth.email_verify_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'update',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message
    });

    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET - Resend verification email (unauthenticated, accepts email param)
 */
export async function GET(request) {
  const correlationId = crypto.randomUUID();

  // Apply rate limiting
  const rateLimitResult = await withRateLimitAsync(request, RateLimitPresets.AUTH,'auth:resend-verify');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    // Accept email from query param (no session required)
    const email = request.nextUrl.searchParams.get('email')?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Generic success response to prevent email enumeration
    const genericSuccess = NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a verification link has been sent.'
    });

    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Return generic success if user not found or already verified (prevent enumeration)
    if (!user || user.emailVerified) {
      return genericSuccess;
    }

    // Generate new hashed verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hashedToken,
        emailVerifyExpiry: verifyExpiry
      }
    });

    // Send verification email with raw token in URL
    const verifyUrl = `${BASE_URL}/verify-email?token=${rawToken}`;
    const emailResult = await sendVerificationEmail(user.email, user.firstName, verifyUrl);

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    await logEvent({
      event_type: 'auth.verification_email_sent',
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: user.id,
      action: 'create',
      result: 'success'
    });

    return genericSuccess;

  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email. Please try again.' },
      { status: 500 }
    );
  }
}

