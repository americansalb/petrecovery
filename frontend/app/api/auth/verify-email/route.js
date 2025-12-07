/**
 * Email Verification API
 * POST /api/auth/verify-email - Verify email with token
 * GET /api/auth/verify-email - Resend verification email
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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

/**
 * Send verification email helper
 */
export async function sendVerificationEmail(email, firstName, verifyUrl) {
  const emailHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Verify Your Email</h1>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${firstName || 'there'},</p>

          <p>Welcome to PetRecovery.org! Please verify your email address to activate your account.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Verify My Email
            </a>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Note:</strong> This link will expire in <strong>24 hours</strong>.</p>
          </div>

          <p>If you didn't create an account with PetRecovery.org, you can safely ignore this email.</p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color: #10b981; word-break: break-all;">${verifyUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your PetRecovery Email',
    html: emailHtml
  });
}
