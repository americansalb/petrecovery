import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET - Get email preferences
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prefs = await prisma.emailPreference.findUnique({
      where: { userId: session.user.id },
    });

    // Return defaults if no preferences exist
    const preferences = prefs || {
      caseUpdates: true,
      sightingAlerts: true,
      squadMessages: true,
      weeklyDigest: false,
      marketingEmails: false,
      systemAnnouncements: true,
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Get email preferences error:', error);
    return NextResponse.json({ error: 'Failed to get preferences' }, { status: 500 });
  }
}

// PATCH - Update email preferences
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    const allowedFields = [
      'caseUpdates',
      'sightingAlerts',
      'squadMessages',
      'weeklyDigest',
      'marketingEmails',
      'systemAnnouncements',
      'digestFrequency',
      'quietHoursStart',
      'quietHoursEnd',
      'timezone',
    ];

    const data = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        data[field] = updates[field];
      }
    }

    const prefs = await prisma.emailPreference.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...data,
      },
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('Update email preferences error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
