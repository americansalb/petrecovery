/**
 * Forgot Password API - Phase 0.1
 * POST /api/auth/forgot-password
 *
 * Generates a password reset token and sends it via email.
 * Token expires in 1 hour.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimum response time to prevent timing attacks (ms)
const MIN_RESPONSE_TIME = 500;

export async function POST(request) {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  // Apply strict rate limiting (prevents email enumeration via timing)
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

  console.log('========================================');
  console.log('[FORGOT-PASSWORD] Request received');
  console.log(`[FORGOT-PASSWORD] Correlation ID: ${correlationId}`);
  console.log(`[FORGOT-PASSWORD] Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // Parse request body
    const body = await request.json();
    const { email } = body;

    console.log(`[FORGOT-PASSWORD] Email provided: ${email ? email.substring(0, 3) + '***' : 'NONE'}`);

    // Validate email is provided
    if (!email || typeof email !== 'string') {
      console.log('[FORGOT-PASSWORD] ERROR: No email provided');

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

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[FORGOT-PASSWORD] Normalized email: ${normalizedEmail.substring(0, 3)}***`);

    // Look up user by email
    console.log('[FORGOT-PASSWORD] Looking up user in database...');
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
      console.log('[FORGOT-PASSWORD] User NOT found - returning success anyway (security)');

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

      // Add minimum response time to prevent timing attacks
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_RESPONSE_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
      }

      // Return success to prevent email enumeration attacks
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    console.log(`[FORGOT-PASSWORD] User found: ${user.id}`);
    console.log(`[FORGOT-PASSWORD] User has password: ${!!user.passwordHash}`);

    // Check if user has a password (might be OAuth-only user in future)
    if (!user.passwordHash) {
      console.log('[FORGOT-PASSWORD] User has no password set - returning success anyway');

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
    console.log('[FORGOT-PASSWORD] Generating reset token...');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    console.log(`[FORGOT-PASSWORD] Token generated (first 8 chars): ${resetToken.substring(0, 8)}...`);
    console.log(`[FORGOT-PASSWORD] Token expires at: ${resetTokenExpiry.toISOString()}`);

    // Save token to database
    console.log('[FORGOT-PASSWORD] Saving token to database...');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      }
    });
    console.log('[FORGOT-PASSWORD] Token saved successfully');

    // Build reset URL
    const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`;
    console.log(`[FORGOT-PASSWORD] Reset URL generated: ${resetUrl.substring(0, 50)}...`);

    // Build email HTML
    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
          </div>

          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${user.firstName || 'there'},</p>

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

    // Send email
    console.log('[FORGOT-PASSWORD] Sending reset email...');
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Reset Your PetRecovery Password',
      html: emailHtml
    });

    if (emailResult.success) {
      console.log('[FORGOT-PASSWORD] Email sent successfully');
    } else {
      console.log(`[FORGOT-PASSWORD] Email send failed: ${emailResult.error}`);
    }

    const responseTime = Date.now() - startTime;
    console.log(`[FORGOT-PASSWORD] Response time: ${responseTime}ms`);

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

    console.log('========================================');
    console.log('[FORGOT-PASSWORD] Request completed successfully');
    console.log('========================================');

    // Add minimum response time to prevent timing attacks
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('========================================');
    console.error('[FORGOT-PASSWORD] FATAL ERROR');
    console.error(`[FORGOT-PASSWORD] Error: ${error.message}`);
    console.error(`[FORGOT-PASSWORD] Stack: ${error.stack}`);
    console.error('========================================');

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
