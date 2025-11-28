import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET - Get SMS preferences
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prefs = await prisma.smsPreference.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('Get SMS preferences error:', error);
    return NextResponse.json({ error: 'Failed to get preferences' }, { status: 500 });
  }
}

// PATCH - Update SMS preferences
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    const allowedFields = ['urgentAlerts', 'sightingAlerts', 'caseUpdates', 'dailyLimit'];

    const data = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        data[field] = updates[field];
      }
    }

    const prefs = await prisma.smsPreference.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        phoneNumber: updates.phoneNumber || '',
        ...data,
      },
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('Update SMS preferences error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
