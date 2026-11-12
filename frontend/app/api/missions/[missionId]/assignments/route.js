import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

// GET /api/missions/[missionId]/assignments - The forces assigned to one pet, and who in them is on it.
//
// For the owner, the forces looking for the pet, and staff: who is on a search is theirs to know
// (app/lib/searcher.js, `seesNames`). People are first names, never account ids or last names.
//
// Until 2026-11-12 this took no sign-in and read the wrong name for its own address, so it filtered by
// nothing: it answered with every assignment on the site, each with its people's ids and names.
export async function GET(request, { params }) {
  try {
    const limit = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:assignments');
    if (!limit.success) return rateLimitResponse(limit);
    const { missionId } = await params;
    const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: { id: true } });
    if (!pet) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    const who = await mayKnowThePeople(request, pet.id);
    if (!who.allowed) {
      return NextResponse.json({ error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' }, { status: who.status });
    }

    const assignments = await prisma.caseAssignment.findMany({
      where: { missionId: pet.id },
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            rescueSquadLevel: true,
            successfulReunions: true,
          },
        },
        participants: {
          where: { isActive: true },
          select: {
            optedInAt: true,
            user: {
              select: {
                firstName: true,
                rescueLevel: true,
              },
            },
          },
        },
        _count: {
          select: {
            participants: true,
            searchAreas: true,
            petSpottings: true,
          },
        },
      },
      orderBy: { acceptedAt: 'asc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

// POST /api/missions/[id]/assignments - Squad leader accepts a case
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: missionId } = params;
    const body = await request.json();
    const { rescueSquadId } = body;

    if (!rescueSquadId) {
      return NextResponse.json(
        { error: 'Rescue force ID required' },
        { status: 400 }
      );
    }

    // Check if case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    if (missionRecord.status === 'REUNITED' || missionRecord.status === 'CLOSED_OTHER') {
      return NextResponse.json(
        { error: 'This case is already closed' },
        { status: 400 }
      );
    }

    // Check if user is a leader of the squad
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId,
        userId: session.user.id,
        role: { in: ['FOUNDER', 'LEADER'] },
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only rescue force leaders can accept cases' },
        { status: 403 }
      );
    }

    // Check if squad already accepted this case
    const existingAssignment = await prisma.caseAssignment.findUnique({
      where: {
        missionId_rescueSquadId: {
          missionId,
          rescueSquadId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Your rescue force has already accepted this case' },
        { status: 400 }
      );
    }

    // Create the assignment
    const assignment = await prisma.caseAssignment.create({
      data: {
        missionId,
        rescueSquadId,
        acceptedById: session.user.id,
        status: 'ACCEPTED',
      },
      include: {
        case: {
          select: {
            caseNumber: true,
            petName: true,
            petSpecies: true,
            petPhotoUrl: true,
            lastSeenAddress: true,
          },
        },
        rescueSquad: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update case status to IN_PROGRESS
    await prisma.case.update({
      where: { id: missionId },
      data: {
        status: 'IN_PROGRESS',
        activeSearchers: { increment: 1 },
      },
    });

    // Update squad stats
    await prisma.rescueForce.update({
      where: { id: rescueSquadId },
      data: {
        totalMissionsAccepted: { increment: 1 },
      },
    });

    // TODO: Send notifications to all active squad members
    // - Push notification: "Your squad accepted a new case!"
    // - Email: Mission details with opt-in link

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error('Error accepting case:', error);
    return NextResponse.json(
      { error: 'Failed to accept case' },
      { status: 500 }
    );
  }
}
