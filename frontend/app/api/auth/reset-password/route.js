/**
 * Reset Password API - Phase 0.1
 * POST /api/auth/reset-password
 *
 * Validates the reset token and updates the user's password.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  // Apply strict rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.AUTH, 'auth:reset-password');
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

  console.log('========================================');
  console.log('[RESET-PASSWORD] Request received');
  console.log(`[RESET-PASSWORD] Correlation ID: ${correlationId}`);
  console.log(`[RESET-PASSWORD] Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // Parse request body
    const body = await request.json();
    const { token, password } = body;

    console.log(`[RESET-PASSWORD] Token provided: ${token ? token.substring(0, 8) + '...' : 'NONE'}`);
    console.log(`[RESET-PASSWORD] Password provided: ${password ? 'YES' : 'NO'}`);

    // Validate required fields
    if (!token || typeof token !== 'string') {
      console.log('[RESET-PASSWORD] ERROR: No token provided');

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
      console.log('[RESET-PASSWORD] ERROR: No password provided');

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
    console.log('[RESET-PASSWORD] Validating password strength...');
    if (password.length < 8) {
      console.log('[RESET-PASSWORD] ERROR: Password too short');

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

    console.log('[RESET-PASSWORD] Password strength OK');

    // Look up user by reset token
    console.log('[RESET-PASSWORD] Looking up user by reset token...');
    const user = await prisma.user.findUnique({
      where: { resetToken: token },
      select: {
        id: true,
        email: true,
        firstName: true,
        resetToken: true,
        resetTokenExpiry: true,
      }
    });

    if (!user) {
      console.log('[RESET-PASSWORD] ERROR: Invalid token - no user found');

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

    console.log(`[RESET-PASSWORD] User found: ${user.id}`);
    console.log(`[RESET-PASSWORD] Token expiry: ${user.resetTokenExpiry?.toISOString()}`);

    // Check if token has expired
    const now = new Date();
    if (!user.resetTokenExpiry || user.resetTokenExpiry < now) {
      console.log('[RESET-PASSWORD] ERROR: Token has expired');
      console.log(`[RESET-PASSWORD] Now: ${now.toISOString()}`);
      console.log(`[RESET-PASSWORD] Expiry: ${user.resetTokenExpiry?.toISOString()}`);

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

    console.log('[RESET-PASSWORD] Token is valid and not expired');

    // Hash the new password
    console.log('[RESET-PASSWORD] Hashing new password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log('[RESET-PASSWORD] Password hashed successfully');

    // Update user's password and clear reset token
    console.log('[RESET-PASSWORD] Updating user password in database...');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date(),
      }
    });
    console.log('[RESET-PASSWORD] Password updated successfully');

    const responseTime = Date.now() - startTime;
    console.log(`[RESET-PASSWORD] Response time: ${responseTime}ms`);

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

    console.log('========================================');
    console.log('[RESET-PASSWORD] Request completed successfully');
    console.log(`[RESET-PASSWORD] User ${user.email.substring(0, 3)}*** password has been reset`);
    console.log('========================================');

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('========================================');
    console.error('[RESET-PASSWORD] FATAL ERROR');
    console.error(`[RESET-PASSWORD] Error: ${error.message}`);
    console.error(`[RESET-PASSWORD] Stack: ${error.stack}`);
    console.error('========================================');

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
