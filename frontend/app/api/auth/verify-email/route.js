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
 * Signing up from a Rescue Force's join form (POST /api/auth/register with
 * joinForceId) leaves a pending membership: inactive, with no leftAt
 * (leaving and removal always stamp leftAt). Confirming the email makes
 * it real. Best effort: the email is already verified, so a failure here
 * is logged and the person can still press Join after signing in.
 */
async function activatePendingMemberships(userId, correlationId) {
  try {
    const pending = await prisma.rescueForceMember.findMany({
      where: { userId, isActive: false, leftAt: null },
      select: {
        id: true,
        rescueSquadId: true,
        rescueSquad: { select: { id: true, name: true, isDeleted: true } },
      },
    });
    const forces = [];
    for (const membership of pending) {
      if (!membership.rescueSquad || membership.rescueSquad.isDeleted) continue;
      await prisma.rescueForceMember.update({
        where: { id: membership.id },
        data: { isActive: true, joinedAt: new Date() },
      });
      // The same row POST /api/rescue-forces/[id]/join writes.
      await prisma.squadActivity.create({
        data: {
          rescueSquadId: membership.rescueSquadId,
          type: 'MEMBER_JOINED',
          message: 'joined the rescue force',
          actorId: userId,
          details: JSON.stringify({}),
        },
      });
      forces.push({ id: membership.rescueSquad.id, name: membership.rescueSquad.name });
    }
    return forces;
  } catch (error) {
    logEvent({
      event_type: 'auth.pending_join_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: userId,
      action: 'update',
      result: 'failure',
      error_message: error.message,
    }).catch(() => {});
    return [];
  }
}

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

    const forces = await activatePendingMemberships(user.id, correlationId);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
      // The Rescue Forces this person asked to join when they signed up,
      // so the page can send them back to one after they sign in.
      forces,
      // To prefill sign-in. The link carrying the token went to this
      // address, so it tells the holder nothing new.
      email: user.email,
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

    // Someone who signed up from a force's join form asks for the link again
    // from the same form: the new email says which force it finishes joining.
    const pendingJoin = await prisma.rescueForceMember
      .findFirst({
        where: { userId: user.id, isActive: false, leftAt: null, rescueSquad: { isDeleted: false } },
        select: { rescueSquad: { select: { name: true } } },
      })
      .catch(() => null);

    // Send verification email with raw token in URL
    const verifyUrl = `${BASE_URL}/verify-email?token=${rawToken}`;
    const emailResult = await sendVerificationEmail(user.email, user.firstName, verifyUrl, {
      joiningForce: pendingJoin?.rescueSquad?.name,
    });

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

