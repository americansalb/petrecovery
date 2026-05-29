/**
 * Sightings API - Public pet sighting reports
 * POST /api/sightings - Report a pet sighting
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail } from '@/app/lib/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sightings - Report a pet sighting
 */
export async function POST(request) {
  const correlationId = crypto.randomUUID();

  // Apply rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_WRITE, 'sightings:report');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Please log in to report a sighting' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      alertId,
      missionId,
      location,
      details,
      timeOfSighting,
      behavior,
      direction,
      contactForFollowUp,
      latitude,
      longitude
    } = body;

    // Validate required fields
    if (!location || !details || !timeOfSighting) {
      return NextResponse.json({
        error: 'Location, details, and time of sighting are required'
      }, { status: 400 });
    }

    // Need either alertId or missionId
    const targetCaseId = missionId || alertId;
    if (!targetCaseId) {
      return NextResponse.json({
        error: 'Please specify which pet this sighting is for'
      }, { status: 400 });
    }

    // Map timeOfSighting to actual datetime
    const sightedAt = mapTimeToDate(timeOfSighting);

    // Create the sighting record
    const sighting = await prisma.sighting.create({
      data: {
        missionId: targetCaseId,
        userId: session.user.id,
        latitude: latitude || 0,
        longitude: longitude || 0,
        description: `${details}${behavior ? `\n\nBehavior: ${behavior}` : ''}${direction ? `\n\nDirection: ${direction}` : ''}${location ? `\n\nLocation: ${location}` : ''}`,
        photoUrls: '[]',
        verified: false
      }
    });

    // Also try to create a CaseSighting if the case exists in Case model
    try {
      const caseExists = await prisma.case.findUnique({
        where: { id: targetCaseId }
      });

      if (caseExists) {
        await prisma.caseSighting.create({
          data: {
            missionId: targetCaseId,
            reportedById: session.user.id,
            sightedAt,
            latitude: latitude || caseExists.lastSeenLatitude,
            longitude: longitude || caseExists.lastSeenLongitude,
            address: location,
            description: details,
            certaintyLevel: mapBehaviorToCertainty(behavior),
            photoUrls: '[]'
          }
        });
      }
    } catch (err) {
      // CaseSighting creation is optional, don't fail the whole request
      console.error('Optional CaseSighting creation failed:', err.message);
    }

    await logEvent({
      event_type: 'sighting.reported',
      correlation_id: correlationId,
      resource_type: 'sighting',
      resource_id: sighting.id,
      actor_user_id: session.user.id,
      action: 'create',
      result: 'success',
      metadata: {
        missionId: targetCaseId,
        timeOfSighting,
        behavior,
        contactForFollowUp
      }
    });

    // Notify the pet owner about the sighting (in-app + email). Best-effort and
    // isolated so it can't fail the sighting submission — but the response copy
    // below only claims "notified" when we actually delivered (no false hope).
    let ownerNotified = false;
    try {
      const sightedCase = await prisma.case.findUnique({
        where: { id: targetCaseId },
        select: {
          caseNumber: true,
          petName: true,
          reporterId: true,
          reporter: { select: { email: true } },
        },
      });
      if (sightedCase?.reporterId) {
        await createInAppNotification({
          userId: sightedCase.reporterId,
          type: 'SIGHTING',
          title: `New sighting of ${sightedCase.petName || 'your pet'}`,
          message: `Someone reported a possible sighting${location ? ` near ${location}` : ''}. Tap to view the details.`,
          actionUrl: sightedCase.caseNumber ? `/cases/${sightedCase.caseNumber}` : null,
          data: { sightingId: sighting.id },
        });
        if (sightedCase.reporter?.email) {
          await sendEmail({
            to: sightedCase.reporter.email,
            subject: `New sighting reported for ${sightedCase.petName || 'your lost pet'} — ReunitePets.org`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10b981;">A new sighting was reported</h2>
                <p>Someone just reported a possible sighting of ${sightedCase.petName || 'your lost pet'}${location ? ` near ${location}` : ''}.</p>
                <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || ''}${sightedCase.caseNumber ? `/cases/${sightedCase.caseNumber}` : '/dashboard'}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View the sighting</a></p>
              </div>
            `,
          });
        }
        ownerNotified = true;
      }
    } catch (err) {
      console.error('Sighting owner-notify failed:', err?.message);
    }

    return NextResponse.json({
      success: true,
      message: ownerNotified
        ? 'Sighting reported — the owner has been notified.'
        : 'Sighting reported successfully.',
      sighting: {
        id: sighting.id,
        missionId: targetCaseId
      }
    });

  } catch (error) {
    console.error('Sighting report error:', error);

    await logEvent({
      event_type: 'sighting.report_failed',
      correlation_id: correlationId,
      resource_type: 'sighting',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message
    });

    return NextResponse.json(
      { error: 'Failed to report sighting. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Map time selection to actual Date
 */
function mapTimeToDate(timeOfSighting) {
  const now = new Date();
  switch (timeOfSighting) {
    case 'just_now':
      return new Date(now - 15 * 60 * 1000); // 15 min ago
    case '30min':
      return new Date(now - 30 * 60 * 1000);
    case '1hour':
      return new Date(now - 60 * 60 * 1000);
    case '2hours':
      return new Date(now - 2 * 60 * 60 * 1000);
    case 'today':
      return new Date(now - 6 * 60 * 60 * 1000); // Assume 6 hours ago
    case 'yesterday':
      return new Date(now - 24 * 60 * 60 * 1000);
    default:
      return now;
  }
}

/**
 * Map behavior to certainty level
 */
function mapBehaviorToCertainty(behavior) {
  switch (behavior) {
    case 'friendly':
      return 4;
    case 'stationary':
      return 4;
    case 'scared':
      return 3;
    case 'running':
      return 2;
    case 'hiding':
      return 3;
    case 'injured':
      return 5;
    default:
      return 3;
  }
}
