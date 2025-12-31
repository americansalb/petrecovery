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
import { sendEmail } from '@/app/lib/email';
import { sendPushToUser, isPushConfigured } from '@/app/lib/push';
import { getEmailBaseUrl } from '@/app/lib/config';

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
        reportedBy: {
          select: {
            id: true,
            email: true,
            firstName: true
          }
        },
        assignments: {
          where: { status: 'ACTIVE' },
          select: {
            squadId: true,
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
          missionId: missionData.id,
          authorId: reportedById,
          content: `New sighting reported${address ? ` near ${address}` : ''}${behaviorLabel ? ` - pet appeared ${behaviorLabel}` : ''}${directionOfTravel ? ` (heading ${directionOfTravel})` : ''}`,
          isUpdate: true
        }
      });
    }

    // Send notifications (non-blocking)
    const baseUrl = getEmailBaseUrl();
    const missionUrl = `${baseUrl}/mission-control?mission=${missionData.id}`;
    const confidenceLabel = confidence === 'HIGH' ? 'high confidence' : confidence === 'MEDIUM' ? 'medium confidence' : 'possible';

    // Notify case owner
    if (missionData.reportedBy?.email && missionData.reportedBy.id !== reportedById) {
      const ownerEmail = missionData.reportedBy.email;
      const ownerName = missionData.reportedBy.firstName || 'there';
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
              Case #${missionData.caseNumber} • PetRecovery.org
            </p>
          </div>
        `
      }).catch(err => console.error('[Sighting] Owner email failed:', err));

      // Push notification (non-blocking)
      if (isPushConfigured()) {
        sendPushToUser(missionData.reportedBy.id, {
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
          sendPushToUser(member.id, {
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
