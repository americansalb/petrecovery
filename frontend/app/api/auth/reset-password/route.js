/**
 * Reset Password API
 * POST /api/auth/reset-password
 *
 * Validates the reset token and updates the user's password.
 * Security: Tokens are hashed before comparison.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  // Apply strict rate limiting
  const rateLimitResult = await withRateLimitAsync(request, RateLimitPresets.AUTH, 'auth:reset-password');
  if (!rateLimitResult.success) {
    await logEvent({
      event_type: 'auth.reset_password_rate_limited',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'update',
      result: 'failure',
      error_code: 'RATE_LIMITED',
      metadata: { blocked: rateLimitResult.blocked }
    });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const body = await request.json();
    const { token, password } = body;

    // Validate required fields
    if (!token || typeof token !== 'string') {
      await logEvent({
        event_type: 'auth.reset_password_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'update',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Reset token is required',
        metadata: { reason: 'missing_token' }
      });

      return NextResponse.json({
        error: 'Reset token is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      await logEvent({
        event_type: 'auth.reset_password_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'update',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'New password is required',
        metadata: { reason: 'missing_password' }
      });

      return NextResponse.json({
        error: 'New password is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      await logEvent({
        event_type: 'auth.reset_password_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'update',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Password must be at least 8 characters',
        metadata: { reason: 'password_too_short', length: password.length }
      });

      return NextResponse.json({
        error: 'Password must be at least 8 characters',
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Look up user by hashed reset token
    const user = await prisma.user.findUnique({
      where: { resetToken: hashedToken },
      select: {
        id: true,
        email: true,
        firstName: true,
        resetToken: true,
        resetTokenExpiry: true,
      }
    });

    if (!user) {
      await logEvent({
        event_type: 'auth.reset_password_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'update',
        result: 'failure',
        error_code: 'INVALID_TOKEN',
        error_message: 'Invalid or expired reset token',
        metadata: { reason: 'token_not_found', token_prefix: token.substring(0, 8) }
      });

      return NextResponse.json({
        error: 'Invalid or expired reset link. Please request a new one.',
        code: 'INVALID_TOKEN'
      }, { status: 400 });
    }

    // Check if token has expired
    const now = new Date();
    if (!user.resetTokenExpiry || user.resetTokenExpiry < now) {
      // Clear the expired token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: null,
          resetTokenExpiry: null,
        }
      });

      await logEvent({
        event_type: 'auth.reset_password_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        resource_id: user.id,
        action: 'update',
        result: 'failure',
        error_code: 'TOKEN_EXPIRED',
        error_message: 'Reset token has expired',
        metadata: {
          reason: 'token_expired',
          expired_at: user.resetTokenExpiry?.toISOString(),
          current_time: now.toISOString()
        }
      });

      return NextResponse.json({
        error: 'This reset link has expired. Please request a new one.',
        code: 'TOKEN_EXPIRED'
      }, { status: 400 });
    }

    // Hash the new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update user's password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date(),
      }
    });

    const responseTime = Date.now() - startTime;

    // Log success event
    await logEvent({
      event_type: 'auth.reset_password_succeeded',
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: user.id,
      action: 'update',
      result: 'success',
      metadata: {
        email: user.email.substring(0, 3) + '***',
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'auth.reset_password_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'update',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      metadata: {
        error_stack: error.stack?.substring(0, 500),
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      error: 'An error occurred. Please try again later.',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
