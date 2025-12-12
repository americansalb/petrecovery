/**
 * Cases API
 *
 * GET /api/missions - List cases (with filters)
 * POST /api/missions - Deprecated, use /api/reports/create instead
 *
 * Uses the Case model (not the old mission model)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { normalizePhotoUrl } from '@/app/lib/utils';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/missions - List cases with filters
 * Requires authentication
 */
export async function GET(request) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const reportType = searchParams.get('reportType'); // LOST or FOUND
    const species = searchParams.get('species');
    const search = searchParams.get('search');
    const myOnly = searchParams.get('myOnly') === 'true';
    const unassigned = searchParams.get('unassigned') === 'true';
    const squadId = searchParams.get('squadId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where = {};

    if (status) {
      where.status = status;
    }

    if (reportType && (reportType === 'LOST' || reportType === 'FOUND')) {
      where.reportType = reportType;
    }

    if (species) {
      where.petSpecies = species;
    }

    if (myOnly) {
      where.reporterId = session.user.id;
    }

    // Filter by unassigned cases (no squad assignments)
    if (unassigned) {
      where.assignments = { none: {} };
    }

    // Filter by specific squad
    if (squadId) {
      where.assignments = { some: { rescueSquadId: squadId } };
    }

    // Text search
    if (search) {
      where.OR = [
        { petName: { contains: search, mode: 'insensitive' } },
        { petBreed: { contains: search, mode: 'insensitive' } },
        { petColor: { contains: search, mode: 'insensitive' } },
        { lastSeenAddress: { contains: search, mode: 'insensitive' } },
        { missionNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch cases
    const [cases, totalCount] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          assignments: {
            include: {
              rescueSquad: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  state: true,
                }
              }
            },
            take: 1,
          },
          _count: {
            select: {
              updates: true,
              sightings: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.case.count({ where }),
    ]);

    // Format response
    const formattedCases = cases.map(c => ({
      id: c.id,
      missionNumber: c.caseNumber,
      reportType: c.reportType,
      status: c.status,
      priority: c.priority,
      // Pet info
      petName: c.petName,
      petSpecies: c.petSpecies,
      petBreed: c.petBreed,
      petColor: c.petColor,
      petSize: c.petSize,
      petPhotoUrl: normalizePhotoUrl(c.petPhotoUrl),
      // Location
      lastSeenAt: c.lastSeenAt,
      lastSeenAddress: c.lastSeenAddress,
      lastSeenLatitude: c.lastSeenLatitude,
      lastSeenLongitude: c.lastSeenLongitude,
      // Reporter
      reporter: c.reporter,
      ownerName: c.ownerName,
      // Timestamps
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      resolvedAt: c.resolvedAt,
      resolution: c.resolution,
      // Counts
      updatesCount: c._count.updates,
      sightingsCount: c._count.sightings,
      // Assigned squad (first one)
      assignedSquad: c.assignments[0]?.rescueSquad || null,
    }));

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.list_viewed',
      resource_type: 'mission',
      action: 'read',
      result: 'success',
      actor_user_id: session.user.id,
      metadata: {
        filters: { status, reportType, species, search, myOnly, unassigned, squadId },
        results_count: cases.length,
        total_count: totalCount,
        limit,
        offset,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      cases: formattedCases,
      count: cases.length,
      total: totalCount,
      hasMore: offset + cases.length < totalCount,
      filters: { status, reportType, species, search, myOnly, unassigned, squadId, limit, offset }
    });

  } catch (error) {
    console.error('Error listing cases:', error);

    await logEvent({
      event_type: 'case.list_failed',
      resource_type: 'mission',
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to list cases',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/missions - Create case
 *
 * DEPRECATED: Use /api/reports/create for the full case creation flow
 * which includes squad assignment, patrol notifications, etc.
 */
export async function POST(request) {
  return NextResponse.json({
    error: 'Endpoint deprecated',
    message: 'Please use /api/reports/create for case creation. This endpoint provided a legacy admin flow that is no longer supported.',
    redirectTo: '/report/new'
  }, { status: 410 }); // 410 Gone
}
