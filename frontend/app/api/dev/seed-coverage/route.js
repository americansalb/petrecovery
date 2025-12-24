/**
 * DEV ONLY: Seed test coverage data
 *
 * GET /api/dev/seed-coverage?missionId=xxx
 *
 * Creates fake search sessions from fake users to test:
 * - Multiple colored paths
 * - Fade decay over time
 * - Team member differentiation
 *
 * DELETE THIS IN PRODUCTION!
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// Generate a path around a center point
function generatePath(centerLat, centerLng, numPoints = 20, radiusMiles = 0.3) {
  const points = [];
  const startAngle = Math.random() * 360;

  for (let i = 0; i < numPoints; i++) {
    // Walk in a rough circle/spiral
    const angle = startAngle + (i * 15) + (Math.random() * 10 - 5);
    const distance = radiusMiles * (0.3 + Math.random() * 0.7) * (i / numPoints);

    // Convert to lat/lng offset (rough approximation)
    const latOffset = distance * Math.cos(angle * Math.PI / 180) / 69;
    const lngOffset = distance * Math.sin(angle * Math.PI / 180) / 54;

    points.push({
      latitude: centerLat + latOffset,
      longitude: centerLng + lngOffset,
    });
  }

  return points;
}

export async function GET(request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const missionId = searchParams.get('missionId');

  if (!missionId) {
    return NextResponse.json({ error: 'missionId required' }, { status: 400 });
  }

  try {
    // Get mission for center point
    const mission = await prisma.case.findUnique({
      where: { id: missionId },
      select: {
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        ownerId: true,
      },
    });

    if (!mission || !mission.lastSeenLatitude) {
      return NextResponse.json({ error: 'Mission not found or no location' }, { status: 404 });
    }

    const centerLat = mission.lastSeenLatitude;
    const centerLng = mission.lastSeenLongitude;

    // Create 4 fake test users (or use existing)
    const testUsers = [];
    for (let i = 1; i <= 4; i++) {
      const email = `test-searcher-${i}@example.com`;
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            firstName: `Test`,
            lastName: `Searcher ${i}`,
          },
        });
      }
      testUsers.push(user);
    }

    // Create search sessions at different times (to test fade)
    const sessions = [];
    const now = Date.now();

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const hoursAgo = i * 12; // 0, 12, 24, 36 hours ago
      const startTime = new Date(now - hoursAgo * 3600000);
      const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 min session

      // Generate a unique path for each user (different directions)
      const pathPoints = generatePath(
        centerLat + (i * 0.002 - 0.003), // Offset each user slightly
        centerLng + (i * 0.002 - 0.003),
        15 + Math.floor(Math.random() * 10),
        0.2 + Math.random() * 0.2
      );

      // Create session
      const session = await prisma.searchSession.create({
        data: {
          missionId,
          userId: user.id,
          status: 'COMPLETED',
          startedAt: startTime,
          endedAt: endTime,
          isVerified: true,
          totalDistanceMiles: 0.3 + Math.random() * 0.5,
          validatedDistanceMiles: 0.25 + Math.random() * 0.4,
          gridCellsCovered: 5 + Math.floor(Math.random() * 10),
          startLocation: JSON.stringify({ lat: pathPoints[0].latitude, lng: pathPoints[0].longitude }),
          endReason: 'USER_ENDED',
          pointsEarned: 50 + Math.floor(Math.random() * 100),
        },
      });

      // Create location pings
      for (let j = 0; j < pathPoints.length; j++) {
        const pingTime = new Date(startTime.getTime() + (j * 2 * 60000)); // 2 min apart
        await prisma.locationPing.create({
          data: {
            sessionId: session.id,
            latitude: pathPoints[j].latitude,
            longitude: pathPoints[j].longitude,
            accuracy: 5 + Math.random() * 10,
            isValid: true,
            createdAt: pingTime,
          },
        });
      }

      sessions.push({
        id: session.id,
        user: `${user.firstName} ${user.lastName}`,
        hoursAgo,
        points: pathPoints.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${sessions.length} test search sessions`,
      sessions,
      note: 'Refresh the map to see the colored paths with different fade levels',
    });

  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Clean up test data
export async function DELETE(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const missionId = searchParams.get('missionId');

  try {
    // Find test users
    const testUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'test-searcher-' } },
      select: { id: true },
    });

    const userIds = testUsers.map(u => u.id);

    // Delete their sessions and pings
    if (missionId) {
      await prisma.locationPing.deleteMany({
        where: {
          session: {
            missionId,
            userId: { in: userIds },
          },
        },
      });

      await prisma.searchSession.deleteMany({
        where: {
          missionId,
          userId: { in: userIds },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Test data cleaned up',
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
