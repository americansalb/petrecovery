/**
 * Mission Sightings API (the older one)
 *
 * GET /api/missions/[id]/sightings - Get all sightings for a case
 * POST /api/missions/[id]/sightings - Report a new sighting (switched off)
 *
 * A sighting is sent through /api/public/missions/[id]/sighting
 * (app/lib/witness.js) and read through /api/mission/[id]/picture, which
 * gives each person what is theirs. Nothing on the site calls this route.
 *
 * - GET returned every sighting whole, to anyone, with no sign-in: where,
 *   what the witness wrote, the name they gave, and the account that sent
 *   it with its last name. It is for the owner, the forces looking for the
 *   pet and staff, and names an account by first name only.
 * - POST is switched off (2026-11-12). It wrote whatever it was sent, at any
 *   length, into a letter to the owner without making it safe to print,
 *   and into a notice to the forces. The route above is the one way in.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { sendEmail } from '@/app/lib/email';
import { sendPushToUser, isPushConfigured } from '@/app/lib/push';
import { getEmailBaseUrl } from '@/app/lib/config';
import { placeName } from '@/app/lib/needOptions';
import { feedPost, forcesOf, postToForces } from '@/app/lib/forceFeed';
import { wakeForces, WAKE_KINDS } from '@/app/lib/wake';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

/** Reporting through this older route. See the note at the top before turning it back on. */
const OLD_REPORT_OPEN = false;

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
    const limit = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:sightings');
    if (!limit.success) return rateLimitResponse(limit);

    // Support both ID (UUID/CUID) and case number
    const isId = isIdFormat(params.missionId);

    const missionData = await prisma.case.findFirst({
      where: isId
        ? { id: params.missionId }
        : { caseNumber: params.missionId },
      select: { id: true, caseNumber: true }
    });

    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Who reported a sighting and what they wrote: for the owner, the forces looking, and staff.
    const who = await mayKnowThePeople(request, missionData.id);
    if (!who.allowed) {
      return NextResponse.json({ error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' }, { status: who.status });
    }

    // Use CaseSighting model (not Sighting)
    const sightings = await prisma.caseSighting.findMany({
      where: { missionId: missionData.id },
      include: {
        reportedBy: {
          select: {
            firstName: true
          }
        }
      },
      orderBy: { sightedAt: 'desc' },
      take: 200
    });

    // The witness's hold on a sighting is theirs alone: not even its hash leaves with the row.
    // And no account's id: a person is named, never handed out by their id.
    const rows = sightings.map(({ witnessKeyHash, reportedById, ...sighting }) => sighting);

    return NextResponse.json({
      sightings: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Error fetching sightings:', error);
    return NextResponse.json({
      error: 'Failed to fetch sightings'
    }, { status: 500 });
  }
}

/**
 * POST /api/missions/[id]/sightings - Report a sighting
 */
export async function POST(request, { params }) {
  const startTime = Date.now();

  if (!OLD_REPORT_OPEN) {
    return NextResponse.json({ error: 'Send a sighting from the pet\'s own page.', code: 'NOT_AVAILABLE' }, { status: 410 });
  }

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

    // Find case with owner info for notifications
    const isId = isIdFormat(params.missionId);

    const missionData = await prisma.case.findFirst({
      where: isId
        ? { id: params.missionId }
        : { caseNumber: params.missionId },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        petName: true,
        petSpecies: true,
        reportType: true,
        // The Case relation is named `reporter`; `reportedBy` only exists
        // on CaseSighting. The old name 500'd every sighting report.
        reporter: {
          select: {
            id: true,
            email: true,
            firstName: true
          }
        },
        assignments: {
          where: { status: 'ACTIVE' },
          select: {
            rescueSquadId: true,
            participants: {
              select: {
                user: {
                  select: { id: true, email: true, firstName: true }
                }
              }
            }
          }
        }
      }
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
          caseId: missionData.id, // CaseUpdate's field is caseId (no @map)
          authorId: reportedById,
          content: `New sighting reported${address ? ` near ${address}` : ''}${behaviorLabel ? ` - pet appeared ${behaviorLabel}` : ''}${directionOfTravel ? ` (heading ${directionOfTravel})` : ''}`,
          isUpdate: true
        }
      });
    }

    // The sighting in the Discussion of each force looking for the pet, as
    // the person who saw it (app/lib/forceFeed.js). Never fails the report.
    try {
      const forceIds = await forcesOf(missionData.id);
      if (forceIds.length) {
        const seen = feedPost('SIGHTING', missionData, {
          place: placeName(address),
          note: [description, directionOfTravel ? `Heading ${String(directionOfTravel).toLowerCase()}.` : ''].filter(Boolean).join(' '),
        });
        await postToForces({ forceIds, authorId: reportedById, caseId: missionData.id, kind: 'SIGHTING', ...seen });
        // The members on duty are woken: a sighting is the moment a search
        // party forms. The tap lands on the pet's page, where the one job is.
        const where = placeName(address);
        wakeForces({
          forceIds,
          exceptUserId: reportedById,
          kind: WAKE_KINDS.SIGHTING,
          title: `${missionData.petName || 'The pet'} was just seen`,
          body: [where ? `Near ${where}.` : null, directionOfTravel ? `Heading ${String(directionOfTravel).toLowerCase()}.` : null, "Don't chase. Say where it goes."].filter(Boolean).join(' '),
          url: `/cases/${encodeURIComponent(missionData.caseNumber)}`,
          data: { caseId: missionData.id },
        });
      }
    } catch (feedError) {
      console.error('[Sighting] force post failed:', feedError?.message);
    }

    // Send notifications (non-blocking)
    const baseUrl = getEmailBaseUrl();
    const missionUrl = `${baseUrl}/mission-control?mission=${missionData.id}`;
    const confidenceLabel = confidence === 'HIGH' ? 'high confidence' : confidence === 'MEDIUM' ? 'medium confidence' : 'possible';

    // Notify case owner
    if (missionData.reporter?.email && missionData.reporter.id !== reportedById) {
      const ownerEmail = missionData.reporter.email;
      const ownerName = missionData.reporter.firstName || 'there';
      const petName = missionData.petName || 'your pet';

      // Email notification (non-blocking)
      sendEmail({
        to: ownerEmail,
        subject: `🚨 New Sighting of ${petName}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">🚨 New Sighting Reported!</h1>
            </div>

            <div style="padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626;">
              <p>Hi ${ownerName},</p>
              <p>Someone just reported a <strong>${confidenceLabel}</strong> sighting of <strong>${petName}</strong>!</p>

              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${address || 'See map for details'}</p>
                ${description ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${description}</p>` : ''}
                ${behavior ? `<p style="margin: 5px 0;"><strong>🐾 Behavior:</strong> ${behavior.toLowerCase().replace('_', ' ')}</p>` : ''}
                ${directionOfTravel ? `<p style="margin: 5px 0;"><strong>➡️ Direction:</strong> Heading ${directionOfTravel.toLowerCase()}</p>` : ''}
              </div>

              <p>
                <a href="${missionUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  View on Map
                </a>
              </p>
            </div>

            <p style="color: #6b7280; font-size: 12px; padding: 20px;">
              Case #${missionData.caseNumber} • ReunitePets
            </p>
          </div>
        `
      }).catch(err => console.error('[Sighting] Owner email failed:', err));

      // Push notification (non-blocking)
      if (isPushConfigured()) {
        sendPushToUser(prisma, missionData.reporter.id, {
          title: `🚨 New Sighting of ${petName}!`,
          body: `${confidenceLabel.charAt(0).toUpperCase() + confidenceLabel.slice(1)} sighting reported ${address ? `near ${address}` : 'nearby'}`,
          url: missionUrl
        }).catch(err => console.error('[Sighting] Owner push failed:', err));
      }
    }

    // Notify team members (all active participants except the reporter)
    const teamMembers = missionData.assignments
      ?.flatMap(a => a.participants?.map(p => p.user) || [])
      .filter(u => u && u.id !== reportedById && u.email) || [];

    if (teamMembers.length > 0) {
      const petName = missionData.petName || 'the pet';

      // Send to each team member
      for (const member of teamMembers) {
        // Email (non-blocking)
        sendEmail({
          to: member.email,
          subject: `📍 New Sighting - ${petName} (Case #${missionData.caseNumber})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">New Sighting Reported</h2>
              <p>Hi ${member.firstName || 'Team Member'},</p>
              <p>A <strong>${confidenceLabel}</strong> sighting of <strong>${petName}</strong> was just reported!</p>

              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${address || 'See map'}</p>
                ${description ? `<p style="margin: 5px 0;"><strong>📝 Notes:</strong> ${description}</p>` : ''}
              </div>

              <p>Check the mission control to coordinate with your team.</p>

              <p>
                <a href="${missionUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  View Mission
                </a>
              </p>
            </div>
          `
        }).catch(err => console.error('[Sighting] Team email failed:', err));

        // Push (non-blocking)
        if (isPushConfigured()) {
          sendPushToUser(prisma, member.id, {
            title: `📍 New Sighting - ${petName}`,
            body: `${confidenceLabel.charAt(0).toUpperCase() + confidenceLabel.slice(1)} sighting ${address ? `near ${address}` : 'reported'}`,
            url: missionUrl
          }).catch(err => console.error('[Sighting] Team push failed:', err));
        }
      }
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
        missionNumber: missionData.caseNumber,
        sightingId: sighting.id,
        confidence,
        behavior,
        directionOfTravel,
        hasPhoto: !!photoUrl,
        response_time_ms: responseTime
      }
    });

    // Tell everyone with the board open, live. The SSE stream existed with
    // zero broadcasters; a sighting is the single most important thing it
    // can carry - it is the event that redirects a search in progress.
    try {
      const { broadcast } = await import('@/app/lib/sse/missionStream');
      // Connections are keyed by caseId - the stream route registers them
      // under its raw [missionId] param.
      broadcast(missionData.id, {
        type: 'SIGHTING_REPORTED',
        sighting: {
          id: sighting.id,
          latitude: sighting.latitude,
          longitude: sighting.longitude,
          address: sighting.address,
          description: sighting.description,
          sightedAt: sighting.sightedAt,
          reportedByName: sighting.reportedBy?.firstName || null,
        },
      });
    } catch (err) {
      console.warn('Sighting broadcast failed:', err.message);
    }

    return NextResponse.json({
      sighting,
      message: 'Sighting reported successfully. Thank you for helping!'
    }, { status: 201 });

  } catch (error) {
    console.error('Error reporting sighting:', error);

    await logEvent({
      event_type: 'case.sighting_report_failed',
      resource_type: 'mission',
      resource_id: params.missionId,
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
