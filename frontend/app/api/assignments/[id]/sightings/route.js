import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

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

    // Update case status if high confidence sighting
    if (confidenceLevel >= 7) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { id: assignmentId },
        select: { caseId: true },
      });

      await prisma.case.update({
        where: { id: assignment.caseId },
        data: { status: 'SIGHTING_REPORTED' },
      });
    }

    // TODO: Send urgent notifications to:
    // - Pet owner (immediate push notification + SMS)
    // - All case participants (push notification)
    // - Squad leaders (push notification)

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
