import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/user/sms-preferences
 *
 * Get the current user's SMS notification preferences.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let preferences = await prisma.smsPreference.findUnique({
      where: { userId: session.user.id },
    });

    // Return default preferences if not set
    if (!preferences) {
      preferences = {
        phoneNumber: null,
        verified: false,
        enabled: false,
        sightingAlerts: true,
        caseUpdates: true,
        emergencyAlerts: true,
        squadAlerts: true,
        marketingMessages: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      };
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching SMS preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/sms-preferences
 *
 * Update the current user's SMS notification preferences.
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
    const {
      enabled,
      sightingAlerts,
      caseUpdates,
      emergencyAlerts,
      squadAlerts,
      marketingMessages,
      quietHoursStart,
      quietHoursEnd,
    } = body;

    // Build update data
    const updateData = {};

    if (typeof enabled === 'boolean') updateData.enabled = enabled;
    if (typeof sightingAlerts === 'boolean') updateData.sightingAlerts = sightingAlerts;
    if (typeof caseUpdates === 'boolean') updateData.caseUpdates = caseUpdates;
    if (typeof emergencyAlerts === 'boolean') updateData.emergencyAlerts = emergencyAlerts;
    if (typeof squadAlerts === 'boolean') updateData.squadAlerts = squadAlerts;
    if (typeof marketingMessages === 'boolean') updateData.marketingMessages = marketingMessages;
    if (quietHoursStart !== undefined) updateData.quietHoursStart = quietHoursStart;
    if (quietHoursEnd !== undefined) updateData.quietHoursEnd = quietHoursEnd;

    const preferences = await prisma.smsPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Error updating SMS preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/sms-preferences
 *
 * Remove phone number and disable SMS notifications.
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await prisma.smsPreference.update({
      where: { userId: session.user.id },
      data: {
        phoneNumber: null,
        verified: false,
        enabled: false,
      },
    });

    // Also delete any pending verifications
    await prisma.phoneVerification.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number removed',
    });
  } catch (error) {
    console.error('Error removing phone number:', error);
    return NextResponse.json(
      { error: 'Failed to remove phone number' },
      { status: 500 }
    );
  }
}
