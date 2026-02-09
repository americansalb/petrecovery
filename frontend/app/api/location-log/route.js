import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/location-log
 *
 * Log a GPS detection from the report wizard.
 * Called every time the wizard successfully detects a location,
 * even if the user never submits a report.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { latitude, longitude, accuracy, address, city, sessionId } = body;

    if (!latitude || !longitude || !sessionId) {
      return NextResponse.json(
        { error: 'latitude, longitude, and sessionId are required' },
        { status: 400 }
      );
    }

    // Get user if logged in (optional)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Get device info from headers
    const userAgent = request.headers.get('user-agent') || null;
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : null;

    const log = await prisma.locationDetectionLog.create({
      data: {
        userId,
        sessionId,
        latitude,
        longitude,
        accuracy: accuracy || null,
        address: address || null,
        city: city || null,
        userAgent,
        ipAddress,
      },
    });

    return NextResponse.json({ id: log.id });
  } catch (error) {
    console.error('[LocationLog] Error:', error);
    return NextResponse.json(
      { error: 'Failed to log location' },
      { status: 500 }
    );
  }
}
