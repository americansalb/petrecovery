import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { sendVerificationCode, formatPhoneNumber, isValidPhoneNumber } from '@/app/lib/twilio';
import crypto from 'crypto';

/**
 * POST /api/sms/verify
 *
 * Send a verification code to a phone number.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Store verification code (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.phoneVerification.upsert({
      where: {
        userId_phoneNumber: {
          userId: session.user.id,
          phoneNumber: formattedPhone,
        },
      },
      create: {
        userId: session.user.id,
        phoneNumber: formattedPhone,
        code,
        expiresAt,
        attempts: 0,
      },
      update: {
        code,
        expiresAt,
        attempts: 0,
        verified: false,
      },
    });

    // Send SMS
    const result = await sendVerificationCode(formattedPhone, code);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Verification code sent',
      });
    }

    return NextResponse.json(
      { error: result.error || 'Failed to send verification code' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Phone verification error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sms/verify
 *
 * Verify the code sent to a phone number.
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phoneNumber, code } = body;

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: 'Phone number and code are required' },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Find verification record
    const verification = await prisma.phoneVerification.findUnique({
      where: {
        userId_phoneNumber: {
          userId: session.user.id,
          phoneNumber: formattedPhone,
        },
      },
    });

    if (!verification) {
      return NextResponse.json(
        { error: 'No verification pending for this number' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      return NextResponse.json(
        { error: 'Verification code expired' },
        { status: 400 }
      );
    }

    // Check attempts
    if (verification.attempts >= 5) {
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 400 }
      );
    }

    // Increment attempts
    await prisma.phoneVerification.update({
      where: {
        userId_phoneNumber: {
          userId: session.user.id,
          phoneNumber: formattedPhone,
        },
      },
      data: {
        attempts: { increment: 1 },
      },
    });

    // Verify code
    if (verification.code !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Mark as verified
    await prisma.phoneVerification.update({
      where: {
        userId_phoneNumber: {
          userId: session.user.id,
          phoneNumber: formattedPhone,
        },
      },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    // Update user's SMS preferences
    await prisma.smsPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        phoneNumber: formattedPhone,
        verified: true,
        enabled: true,
        sightingAlerts: true,
        caseUpdates: true,
        emergencyAlerts: true,
      },
      update: {
        phoneNumber: formattedPhone,
        verified: true,
        enabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
