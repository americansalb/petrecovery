/**
 * Case Sightings API
 *
 * GET /api/cases/[id]/sightings - Get all sightings for a case
 * POST /api/cases/[id]/sightings - Report a new sighting
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cases/[id]/sightings
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    // Allow public access to sightings (for case detail page)
    // But limit information for non-authenticated users

    // Support both UUID and case number
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

    const caseData = await prisma.case.findFirst({
      where: isUuid
        ? { id: params.id }
        : { caseNumber: params.id },
      select: { id: true, caseNumber: true }
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const sightings = await prisma.sighting.findMany({
      where: { caseId: caseData.id },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
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
 * POST /api/cases/[id]/sightings - Report a sighting
 */
export async function POST(request, { params }) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);

    // Allow anonymous sighting reports, but track if authenticated
    const reporterId = session?.user?.id || null;

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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

    const caseData = await prisma.case.findFirst({
      where: isUuid
        ? { id: params.id }
        : { caseNumber: params.id },
      select: { id: true, caseNumber: true, status: true }
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Don't allow sightings on resolved cases
    if (caseData.status === 'REUNITED' || caseData.status === 'CLOSED_OTHER') {
      return NextResponse.json({
        error: 'Case closed',
        message: 'This case has been resolved. Thank you for your report.'
      }, { status: 400 });
    }

    // Build full description with behavior details
    const fullDescription = [
      description,
      behavior ? `Behavior: ${behavior}` : null,
      directionOfTravel ? `Direction: ${directionOfTravel}` : null
    ].filter(Boolean).join(' | ');

    // Create sighting
    const sighting = await prisma.sighting.create({
      data: {
        caseId: caseData.id,
        reporterId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || null,
        description: fullDescription || null,
        confidence: confidence || 'MEDIUM',
        photoUrl: photoUrl || null,
        status: 'PENDING'
      },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Optionally update case status to SIGHTING_REPORTED
    if (caseData.status === 'ACTIVE' || caseData.status === 'IN_PROGRESS') {
      await prisma.case.update({
        where: { id: caseData.id },
        data: { status: 'SIGHTING_REPORTED' }
      });

      // Create an update entry
      const behaviorLabel = behavior ? behavior.charAt(0) + behavior.slice(1).toLowerCase().replace('_', ' ') : '';
      await prisma.caseUpdate.create({
        data: {
          caseId: caseData.id,
          authorId: reporterId,
          content: `New sighting reported${address ? ` near ${address}` : ''}${behaviorLabel ? ` - pet appeared ${behaviorLabel}` : ''}${directionOfTravel ? ` (heading ${directionOfTravel})` : ''}`,
          isUpdate: true
        }
      });
    }

    const responseTime = Date.now() - startTime;

    await logEvent({
      event_type: 'case.sighting_reported',
      resource_type: 'case',
      resource_id: caseData.id,
      action: 'create',
      result: 'success',
      actor_user_id: reporterId,
      metadata: {
        caseNumber: caseData.caseNumber,
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
      resource_type: 'case',
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
