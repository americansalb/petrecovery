import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/user/email-preferences
 *
 * Get the current user's email preferences.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get or create email preferences
    let preferences = await prisma.emailPreference.findUnique({
      where: { userId: session.user.id }
    });

    if (!preferences) {
      // Create default preferences
      preferences = await prisma.emailPreference.create({
        data: {
          userId: session.user.id,
          caseUpdates: true,
          sightingAlerts: true,
          squadMessages: true,
          weeklyDigest: false,
          marketingEmails: false,
          systemAnnouncements: true,
          digestFrequency: 'IMMEDIATE',
          timezone: 'America/Chicago'
        }
      });
    }

    return NextResponse.json({ preferences });

  } catch (error) {
    console.error('Error fetching email preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/email-preferences
 *
 * Update the current user's email preferences.
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      caseUpdates,
      sightingAlerts,
      squadMessages,
      weeklyDigest,
      marketingEmails,
      systemAnnouncements,
      digestFrequency,
      quietHoursStart,
      quietHoursEnd,
      timezone
    } = body;

    // Validate digestFrequency
    if (digestFrequency && !['IMMEDIATE', 'DAILY', 'WEEKLY'].includes(digestFrequency)) {
      return NextResponse.json(
        { error: 'Invalid digest frequency' },
        { status: 400 }
      );
    }

    // Validate quiet hours
    if (quietHoursStart !== undefined && (quietHoursStart < 0 || quietHoursStart > 23)) {
      return NextResponse.json(
        { error: 'Invalid quiet hours start' },
        { status: 400 }
      );
    }

    if (quietHoursEnd !== undefined && (quietHoursEnd < 0 || quietHoursEnd > 23)) {
      return NextResponse.json(
        { error: 'Invalid quiet hours end' },
        { status: 400 }
      );
    }

    // Upsert preferences
    const preferences = await prisma.emailPreference.upsert({
      where: { userId: session.user.id },
      update: {
        ...(caseUpdates !== undefined && { caseUpdates }),
        ...(sightingAlerts !== undefined && { sightingAlerts }),
        ...(squadMessages !== undefined && { squadMessages }),
        ...(weeklyDigest !== undefined && { weeklyDigest }),
        ...(marketingEmails !== undefined && { marketingEmails }),
        ...(systemAnnouncements !== undefined && { systemAnnouncements }),
        ...(digestFrequency !== undefined && { digestFrequency }),
        ...(quietHoursStart !== undefined && { quietHoursStart }),
        ...(quietHoursEnd !== undefined && { quietHoursEnd }),
        ...(timezone !== undefined && { timezone })
      },
      create: {
        userId: session.user.id,
        caseUpdates: caseUpdates ?? true,
        sightingAlerts: sightingAlerts ?? true,
        squadMessages: squadMessages ?? true,
        weeklyDigest: weeklyDigest ?? false,
        marketingEmails: marketingEmails ?? false,
        systemAnnouncements: systemAnnouncements ?? true,
        digestFrequency: digestFrequency ?? 'IMMEDIATE',
        quietHoursStart,
        quietHoursEnd,
        timezone: timezone ?? 'America/Chicago'
      }
    });

    return NextResponse.json({
      success: true,
      preferences
    });

  } catch (error) {
    console.error('Error updating email preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
