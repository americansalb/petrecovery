import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail } from '@/app/lib/email';
import { getEmailBaseUrl } from '@/app/lib/config';

// GET /api/assignments/[id]/sightings - Get all sightings for a case
export async function GET(request, { params }) {
  try {
    const { id: assignmentId } = params;

    const sightings = await prisma.petSpotting.findMany({
      where: { assignmentId },
      include: {
        reportedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { spottedAt: 'desc' },
    });

    return NextResponse.json({ sightings });
  } catch (error) {
    console.error('Error fetching sightings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sightings' },
      { status: 500 }
    );
  }
}

// POST /api/assignments/[id]/sightings - Report a pet sighting
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assignmentId } = params;
    const body = await request.json();
    const {
      latitude,
      longitude,
      address,
      spottedAt,
      confidenceLevel,
      photoUrls = [],
      notes,
    } = body;

    if (!latitude || !longitude || !spottedAt || !confidenceLevel) {
      return NextResponse.json(
        { error: 'Location, time, and confidence level required' },
        { status: 400 }
      );
    }

    if (confidenceLevel < 1 || confidenceLevel > 10) {
      return NextResponse.json(
        { error: 'Confidence level must be between 1-10' },
        { status: 400 }
      );
    }

    // Verify user is a participant
    const participant = await prisma.caseParticipant.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
    });

    if (!participant || !participant.isActive) {
      return NextResponse.json(
        { error: 'You must be participating in this case to report sightings' },
        { status: 403 }
      );
    }

    const sighting = await prisma.petSpotting.create({
      data: {
        assignmentId,
        reportedById: session.user.id,
        latitude,
        longitude,
        address,
        spottedAt: new Date(spottedAt),
        confidenceLevel,
        photoUrls: JSON.stringify(photoUrls),
        notes,
      },
      include: {
        reportedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update participant stats
    await prisma.caseParticipant.update({
      where: { id: participant.id },
      data: {
        sightingsReported: { increment: 1 },
      },
    });

    // Update case status if high confidence sighting + notify the owner.
    if (confidenceLevel >= 7) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { id: assignmentId },
        select: { missionId: true }, // CaseAssignment.missionId is @map("caseId") - this is the case id
      });

      const updatedCase = await prisma.case.update({
        where: { id: assignment.missionId },
        data: { status: 'SIGHTING_REPORTED' },
        select: {
          caseNumber: true,
          petName: true,
          reporterId: true,
          reporter: { select: { email: true } },
        },
      });

      // CRIT-E: a confident sighting of a missing pet must reach the owner.
      // Deliver in-app + email, isolated/best-effort so it can't fail the sighting.
      try {
        if (updatedCase?.reporterId) {
          const petName = updatedCase.petName || 'your pet';
          await createInAppNotification({
            userId: updatedCase.reporterId,
            type: 'SIGHTING',
            title: `Confident sighting of ${petName}`,
            message: `A searcher reported a confident sighting${address ? ` near ${address}` : ''}. Tap to view the details.`,
            actionUrl: updatedCase.caseNumber ? `/cases/${updatedCase.caseNumber}` : null,
            data: { sightingId: sighting.id },
          });
          if (updatedCase.reporter?.email) {
            await sendEmail({
              to: updatedCase.reporter.email,
              subject: `Confident sighting reported for ${petName} - ReunitePets.org`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #10b981;">A confident sighting was reported</h2>
                  <p>A searcher just reported a confident sighting of ${petName}${address ? ` near ${address}` : ''}.</p>
                  <p><a href="${getEmailBaseUrl()}${updatedCase.caseNumber ? `/cases/${updatedCase.caseNumber}` : '/dashboard'}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View the sighting</a></p>
                </div>
              `,
            });
          }
        }
      } catch (err) {
        console.error('Assignment-sighting owner-notify failed:', err?.message);
      }
    }

    // Create a system message in chat
    const confidenceText =
      confidenceLevel >= 8 ? 'Very confident' : confidenceLevel >= 5 ? 'Moderately confident' : 'Possible';
    await prisma.squadMessage.create({
      data: {
        assignmentId,
        authorId: session.user.id,
        type: 'SYSTEM',
        content: `🔍 ${confidenceText} sighting reported at ${address || 'marked location'}`,
        location: JSON.stringify({ lat: latitude, lng: longitude, address }),
      },
    });

    return NextResponse.json({ sighting }, { status: 201 });
  } catch (error) {
    console.error('Error reporting sighting:', error);
    return NextResponse.json(
      { error: 'Failed to report sighting' },
      { status: 500 }
    );
  }
}
