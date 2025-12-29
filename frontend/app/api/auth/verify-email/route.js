/**
 * Email Verification API
 * POST /api/auth/verify-email - Verify email with token
 * GET /api/auth/verify-email - Resend verification email
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail, sendVerificationEmail } from '@/app/lib/email';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
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
  const rateLimitResult = withRateLimit(request, RateLimitPresets.AUTH, 'auth:verify-email');
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

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
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
 * GET - Resend verification email (requires auth)
 */
export async function GET(request) {
  const correlationId = crypto.randomUUID();

  // Apply rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.AUTH, 'auth:resend-verify');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Please log in to resend verification email' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified.'
      });
    }

    // Generate new verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpiry: verifyExpiry
      }
    });

    // Send verification email
    const verifyUrl = `${BASE_URL}/verify-email?token=${verifyToken}`;
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

    return NextResponse.json({
      success: true,
      message: 'Verification email sent! Check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email. Please try again.' },
      { status: 500 }
    );
  }
}

