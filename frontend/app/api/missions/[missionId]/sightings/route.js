/**
 * Mission Sightings API
 *
 * GET /api/missions/[id]/sightings - Get all sightings for a case
 * POST /api/missions/[id]/sightings - Report a new sighting
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

// Helper to detect ID format (UUID or CUID)
function isIdFormat(str) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const isCuid = /^c[a-z0-9]{24}$/i.test(str);
  return isUuid || isCuid;
}

/**
 * GET /api/missions/[id]/sightings
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    // Allow public access to sightings (for case detail page)
    // But limit information for non-authenticated users

    // Support both ID (UUID/CUID) and case number
    const isId = isIdFormat(params.id);

    const missionData = await prisma.case.findFirst({
      where: isId
        ? { id: params.id }
        : { missionNumber: params.id },
      select: { id: true, missionNumber: true }
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Use CaseSighting model (not Sighting)
    const sightings = await prisma.caseSighting.findMany({
      where: { missionId: missionData.id },
      include: {
        reportedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { sightedAt: 'desc' }
    });

    return NextResponse.json({
      sightings,
      count: sightings.length
    });

  } catch (error) {
    console.error('Error fetching sightings:', error);
    return NextResponse.json({
      error: 'Failed to fetch sightings',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/missions/[id]/sightings - Report a sighting
 */
export async function POST(request, { params }) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);

    // Require authentication for sighting reports
    if (!session?.user?.id) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please sign in to report a sighting'
      }, { status: 401 });
    }

    const reportedById = session.user.id;

    const body = await request.json();
    const {
      latitude,
      longitude,
      address,
      description,
      confidence,
      photoUrl,
      behavior,
      directionOfTravel
    } = body;

    // Validate required fields
    if (!latitude || !longitude) {
      return NextResponse.json({
        error: 'Location required',
        message: 'Please provide latitude and longitude'
      }, { status: 400 });
    }

    // Find case
    const isId = isIdFormat(params.id);

    const missionData = await prisma.case.findFirst({
      where: isId
        ? { id: params.id }
        : { missionNumber: params.id },
      select: { id: true, missionNumber: true, status: true }
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Don't allow sightings on resolved cases
    if (missionData.status === 'REUNITED' || missionData.status === 'CLOSED_OTHER') {
      return NextResponse.json({
        error: 'Mission closed',
        message: 'This case has been resolved. Thank you for your report.'
      }, { status: 400 });
    }

    // Build full description with behavior details
    const fullDescription = [
      description,
      behavior ? `Behavior: ${behavior}` : null,
      directionOfTravel ? `Direction: ${directionOfTravel}` : null
    ].filter(Boolean).join(' | ');

    // Create sighting using CaseSighting model
    const sighting = await prisma.caseSighting.create({
      data: {
        missionId: missionData.id,
        reportedById,
        sightedAt: new Date(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || 'Unknown location',
        description: fullDescription || 'No description provided',
        certaintyLevel: confidence === 'HIGH' ? 5 : confidence === 'MEDIUM' ? 3 : 1,
        photoUrls: photoUrl ? JSON.stringify([photoUrl]) : '[]',
        isVerified: false
      },
      include: {
        reportedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Optionally update case status to SIGHTING_REPORTED
    if (missionData.status === 'ACTIVE' || missionData.status === 'IN_PROGRESS') {
      await prisma.case.update({
        where: { id: missionData.id },
        data: { status: 'SIGHTING_REPORTED' }
      });

      // Create an update entry
      const behaviorLabel = behavior ? behavior.charAt(0) + behavior.slice(1).toLowerCase().replace('_', ' ') : '';
      await prisma.caseUpdate.create({
        data: {
          missionId: missionData.id,
          authorId: reportedById,
          content: `New sighting reported${address ? ` near ${address}` : ''}${behaviorLabel ? ` - pet appeared ${behaviorLabel}` : ''}${directionOfTravel ? ` (heading ${directionOfTravel})` : ''}`,
          isUpdate: true
        }
      });
    }

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.sighting_reported',
      resource_type: 'mission',
      resource_id: missionData.id,
      action: 'create',
      result: 'success',
      actor_user_id: reportedById,
      metadata: {
        missionNumber: missionData.missionNumber,
        sightingId: sighting.id,
        confidence,
        behavior,
        directionOfTravel,
        hasPhoto: !!photoUrl,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      sighting,
      message: 'Sighting reported successfully. Thank you for helping!'
    }, { status: 201 });

  } catch (error) {
    console.error('Error reporting sighting:', error);

    await logEvent({
      event_type: 'case.sighting_report_failed',
      resource_type: 'mission',
      resource_id: params.id,
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to report sighting',
      message: error.message
    }, { status: 500 });
  }
}
