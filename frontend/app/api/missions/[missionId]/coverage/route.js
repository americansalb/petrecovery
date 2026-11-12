/**
 * Search Coverage API
 *
 * GET /api/missions/[missionId]/coverage
 * Returns all historical search paths for map visualization
 *
 * Response includes:
 * - ALL search sessions with GPS paths (regardless of how they ended)
 * - User info for color assignment
 * - Timestamps for time decay calculation
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
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

    // Where each person walked, and where the ones out now are: for the owner, the forces looking for the pet,
    // and staff. It answered any account, with every walker's account id, full name and path (2026-11-12).
    // Nothing on the site calls it; the search screen shows streets as walked or being walked, never a person's dot.
    const who = await mayKnowThePeople(request, mission.id);
    if (!who.allowed) {
      return NextResponse.json({ error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' }, { status: who.status });
    }

    // Fetch ALL search sessions that have GPS data - not just "COMPLETED"
    // Include sessions that were force-ended, timed out, or abandoned
    // The important thing is they have location pings
    const searchSessions = await prisma.searchSession.findMany({
      where: {
        missionId,
        status: { not: 'ACTIVE' }, // Any non-active session (COMPLETED, etc.)
        isVerified: true, // Only GPS-verified sessions
        locationPings: {
          some: {}, // Must have at least one ping
        },
      },
      select: {
        id: true,
        userId: true,
        startedAt: true,
        endedAt: true,
        endReason: true,
        validatedDistanceMiles: true,
        locationPings: {
          // Include ALL pings, not just "valid" ones - let the map show where they walked
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
      },
    });

    // A person is a first name and a number that means something only in this answer (so one person's walks
    // can be drawn in one colour). Never their account's id, their last name or their picture.
    const userMap = Object.fromEntries(users.map((u, i) => [u.id, {
      name: u.firstName || 'A helper',
      walker: i + 1,
    }]));

    // Format response
    const coverage = {
      // Historical completed searches
      completed: searchSessions.map(session => ({
        walker: userMap[session.userId]?.walker || 0,
        userName: userMap[session.userId]?.name || 'A helper',
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
        walker: userMap[session.userId]?.walker || 0,
        userName: userMap[session.userId]?.name || 'A helper',
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
