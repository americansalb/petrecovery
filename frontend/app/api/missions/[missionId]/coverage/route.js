/**
 * Search Coverage API
 *
 * GET /api/missions/[missionId]/coverage
 * Returns all historical search paths for map visualization
 *
 * Response includes:
 * - All completed search sessions with GPS paths
 * - User info for color assignment
 * - Timestamps for time decay calculation
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId } = params;

    // Verify mission exists
    const mission = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Fetch all completed search sessions with their paths
    // Only include sessions with actual GPS data
    const searchSessions = await prisma.searchSession.findMany({
      where: {
        missionId,
        status: 'COMPLETED',
        isVerified: true, // Only GPS-verified sessions
      },
      select: {
        id: true,
        userId: true,
        startedAt: true,
        endedAt: true,
        validatedDistanceMiles: true,
        locationPings: {
          where: {
            isValid: true, // Only valid pings
          },
          select: {
            latitude: true,
            longitude: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    // Also fetch active search sessions (for real-time display)
    const activeSessions = await prisma.searchSession.findMany({
      where: {
        missionId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        userId: true,
        startedAt: true,
        locationPings: {
          select: {
            latitude: true,
            longitude: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 100, // Limit for performance
        },
      },
    });

    // Get user info for color assignment
    const userIds = [
      ...new Set([
        ...searchSessions.map(s => s.userId).filter(Boolean),
        ...activeSessions.map(s => s.userId).filter(Boolean),
      ]),
    ];

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      },
    });

    const userMap = Object.fromEntries(users.map(u => [u.id, {
      ...u,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Anonymous',
      image: u.profileImage, // Alias for backwards compatibility
    }]));

    // Format response
    const coverage = {
      // Historical completed searches
      completed: searchSessions.map(session => ({
        id: session.id,
        userId: session.userId,
        userName: userMap[session.userId]?.name || 'Anonymous',
        userImage: userMap[session.userId]?.image || null,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        distanceMiles: session.validatedDistanceMiles || 0,
        path: session.locationPings.map(ping => ({
          lat: ping.latitude,
          lng: ping.longitude,
          timestamp: ping.createdAt.getTime(),
        })),
      })),

      // Active searches (for real-time overlay)
      active: activeSessions.map(session => ({
        id: session.id,
        userId: session.userId,
        userName: userMap[session.userId]?.name || 'Searcher',
        userImage: userMap[session.userId]?.image || null,
        startedAt: session.startedAt,
        path: session.locationPings.map(ping => ({
          lat: ping.latitude,
          lng: ping.longitude,
          timestamp: ping.createdAt.getTime(),
        })),
      })),

      // Summary stats
      stats: {
        totalSessions: searchSessions.length,
        totalSearchers: userIds.length,
        activeSearchers: activeSessions.length,
      },
    };

    return NextResponse.json(coverage);
  } catch (error) {
    console.error('Coverage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
