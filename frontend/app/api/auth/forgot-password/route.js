/**
 * Forgot Password API
 * POST /api/auth/forgot-password
 *
 * Generates a password reset token and sends it via email.
 * Token expires in 1 hour.
 * Security: Tokens are hashed before storage, timing attacks prevented.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import crypto from 'crypto';
import { getEmailBaseUrl } from '@/app/lib/config';

export const dynamic = 'force-dynamic';

const BASE_URL = getEmailBaseUrl();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_RESPONSE_TIME = 500; // Prevents timing attacks

export async function POST(request) {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  // Apply strict rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.AUTH, 'auth:forgot-password');
  if (!rateLimitResult.success) {
    await logEvent({
      event_type: 'auth.forgot_password_rate_limited',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
      result: 'failure',
      error_code: 'RATE_LIMITED',
      metadata: { blocked: rateLimitResult.blocked }
    });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const body = await request.json();
    const { email } = body;

    // Validate email is provided
    if (!email || typeof email !== 'string') {
      await logEvent({
        event_type: 'auth.forgot_password_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'create',
        result: 'failure',
        error_code: 'VALIDATION_ERROR',
        error_message: 'Email is required',
        metadata: { reason: 'missing_email' }
      });

      return NextResponse.json({
        error: 'Email is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email.toLowerCase().trim())) {
      return NextResponse.json({
        error: 'Please enter a valid email address',
        code: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        passwordHash: true,
      }
    });

    // SECURITY: Always return success even if user not found (prevent email enumeration)
    if (!user) {
      await logEvent({
        event_type: 'auth.forgot_password_attempted',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'read',
        result: 'success',
        metadata: {
          user_found: false,
          response_time_ms: Date.now() - startTime
        }
      });

      // Ensure consistent response time
      await ensureMinResponseTime(startTime, MIN_RESPONSE_TIME);

      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    // Check if user has a password (might be OAuth-only user in future)
    if (!user.passwordHash) {
      await logEvent({
        event_type: 'auth.forgot_password_attempted',
        correlation_id: correlationId,
        resource_type: 'user',
        resource_id: user.id,
        action: 'read',
        result: 'success',
        metadata: {
          user_found: true,
          has_password: false,
          response_time_ms: Date.now() - startTime
        }
      });

      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    // Generate secure reset token
    // Store HASH in database, send RAW to user
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save hashed token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      }
    });

    // Build reset URL with raw token
    const resetUrl = `${BASE_URL}/reset-password?token=${rawToken}`;

    // Send email
    const emailHtml = buildResetEmailHtml(user.firstName, resetUrl);
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Reset Your PetRecovery Password',
      html: emailHtml
    });

    const responseTime = Date.now() - startTime;

    // Log success event
    await logEvent({
      event_type: 'auth.forgot_password_requested',
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: user.id,
      action: 'create',
      result: 'success',
      metadata: {
        email_sent: emailResult.success,
        email_error: emailResult.error || null,
        token_expiry: resetTokenExpiry.toISOString(),
        response_time_ms: responseTime
      }
    });

    // Ensure consistent response time
    await ensureMinResponseTime(startTime, MIN_RESPONSE_TIME);

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'auth.forgot_password_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
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

// Helper to ensure minimum response time (prevents timing attacks)
async function ensureMinResponseTime(startTime, minTime) {
  const elapsed = Date.now() - startTime;
  if (elapsed < minTime) {
    await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
  }
}

// Helper to build reset email HTML
function buildResetEmailHtml(firstName, resetUrl) {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${firstName || 'there'},</p>

          <p>We received a request to reset your password for your PetRecovery.org account.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Reset My Password
            </a>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Important:</strong> This link will expire in <strong>1 hour</strong>.</p>
          </div>

          <p>If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
          </p>
        </div>
      </body>
    </html>
  `;
}
