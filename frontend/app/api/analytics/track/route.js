import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// POST /api/analytics/track - Track analytics events
export async function POST(request) {
  try {
    const body = await request.json();
    const { eventType, page, referrer, metadata } = body;

    if (!eventType) {
      return NextResponse.json({ error: 'Event type required' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Get session ID from cookie or generate one
    const sessionId = request.cookies.get('session_id')?.value || generateSessionId();

    // Extract IP and user agent
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    // Create analytics event
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        userId,
        sessionId,
        ipAddress,
        page,
        referrer,
        userAgent,
        metadata: JSON.stringify(metadata || {}),
      },
    });

    // Update daily stats
    await updateDailyStats(eventType, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Don't return error to client - tracking should be silent
    return NextResponse.json({ success: true });
  }
}

async function updateDailyStats(eventType, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const updates = {};

  switch (eventType) {
    case 'PAGE_VIEW':
      updates.pageViews = { increment: 1 };
      break;
    case 'SEARCH':
      updates.searches = { increment: 1 };
      break;
    case 'SHARE':
      updates.shares = { increment: 1 };
      break;
    case 'SIGHTING':
      updates.sightings = { increment: 1 };
      break;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await prisma.dailyStats.upsert({
        where: { date: today },
        update: updates,
        create: {
          date: today,
          pageViews: eventType === 'PAGE_VIEW' ? 1 : 0,
          searches: eventType === 'SEARCH' ? 1 : 0,
          shares: eventType === 'SHARE' ? 1 : 0,
          sightings: eventType === 'SIGHTING' ? 1 : 0,
        },
      });
    } catch (e) {
      // Ignore upsert race conditions
    }
  }
}

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 15);
}
