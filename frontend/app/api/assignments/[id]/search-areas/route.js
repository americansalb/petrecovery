import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { assignmentDoor } from '@/app/lib/missionControl/guard';
import { onlyText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 60 * 1000 };
const NOTE_MAX = 600;
/** One marked area: more than this is not a walk. */
const ACRES_MAX = 500;
const GEOMETRY_MAX = 20000;

// GET /api/assignments/[id]/search-areas - Get all search areas for a case
export async function GET(request, { params }) {
  try {
    // Where a force has looked for one pet: for the owner, the forces looking for the pet and staff. It took no
    // sign-in, and sent each marker's account id and last name. Whoever marked an area is a first name here.
    const { id: assignmentId } = await params;
    const door = await assignmentDoor(request, assignmentId);
    if (door.status !== 200) {
      return NextResponse.json({ error: door.status === 404 ? 'Assignment not found' : 'Only the owner and the forces looking for this pet can see this.', code: door.status === 404 ? 'NOT_FOUND' : 'NOT_ALLOWED' }, { status: door.status });
    }
    const viewerId = door.who.searcher?.userId || null;

    const rows = await prisma.searchArea.findMany({
      where: { assignmentId: door.assignment.id },
      include: {
        markedBy: {
          select: {
            firstName: true,
          },
        },
      },
      orderBy: { markedAt: 'desc' },
      take: 500,
    });

    const searchAreas = rows.map(({ markedById, markedBy, ...area }) => ({
      ...area,
      mine: Boolean(viewerId && markedById === viewerId),
      markedBy: { firstName: firstWord(markedBy?.firstName) || 'A helper' },
    }));

    return NextResponse.json({ searchAreas });
  } catch (error) {
    console.error('Error fetching search areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search areas' },
      { status: 500 }
    );
  }
}

// POST /api/assignments/[id]/search-areas - Mark a new search area
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'assignment:area');
    if (!limited.success) return rateLimitResponse(limited);

    const { id: assignmentId } = await params;
    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};

    // A shape of a sensible size, and an area a person could have walked. The acreage is added to the
    // walker's and the force's totals, and used to be whatever the request said.
    const geometry = body.geometry && typeof body.geometry === 'object' ? body.geometry : null;
    const drawn = geometry ? JSON.stringify(geometry) : '';
    const acreage = typeof body.acreage === 'number' ? body.acreage : NaN;
    const notes = typeof body.notes === 'string' ? cut(onlyText(body.notes).trim(), NOTE_MAX) || null : null;
    const startAddress = typeof body.startAddress === 'string' ? cut(onlyText(body.startAddress).replace(/\s+/g, ' ').trim(), 200) || null : null;
    const potentialSpotting = body.potentialSpotting === true;

    if (!geometry || !drawn || drawn.length > GEOMETRY_MAX || !Number.isFinite(acreage) || acreage <= 0 || acreage > ACRES_MAX) {
      return NextResponse.json(
        { error: 'Geometry and acreage required' },
        { status: 400 }
      );
    }
    if (typeof assignmentId !== 'string' || !assignmentId) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
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
        { error: 'You must be participating in this case to mark search areas' },
        { status: 403 }
      );
    }

    const created = await prisma.searchArea.create({
      data: {
        assignmentId,
        markedById: session.user.id,
        geometry: drawn,
        acreage,
        notes,
        potentialSpotting,
        startAddress,
      },
      include: {
        markedBy: {
          select: {
            firstName: true,
          },
        },
      },
    });
    // The marker's own area, back to them: a first name, no account id.
    const { markedById, markedBy, ...rest } = created;
    const searchArea = { ...rest, mine: true, markedBy: { firstName: firstWord(markedBy?.firstName) || 'A helper' } };

    // Update participant stats
    await prisma.caseParticipant.update({
      where: { id: participant.id },
      data: {
        areasMarked: { increment: 1 },
      },
    });

    // Update assignment stats
    await prisma.caseAssignment.update({
      where: { id: assignmentId },
      data: {
        areasSearched: { increment: 1 },
      },
    });

    // Update user and squad member stats
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        areasMarkedCount: { increment: 1 },
        totalAcreageSearched: { increment: acreage },
      },
    });

    const squadMember = await prisma.rescueForceMember.findFirst({
      where: {
        userId: session.user.id,
        rescueSquad: {
          caseAssignments: {
            some: { id: assignmentId },
          },
        },
        isActive: true,
      },
    });

    if (squadMember) {
      await prisma.rescueForceMember.update({
        where: { id: squadMember.id },
        data: {
          areasMarked: { increment: 1 },
          searchHours: { increment: acreage * 0.25 }, // Estimate: ~15min per acre
        },
      });
    }

    // Update squad stats
    const assignment = await prisma.caseAssignment.findUnique({
      where: { id: assignmentId },
      select: { rescueSquadId: true },
    });

    await prisma.rescueForce.update({
      where: { id: assignment.rescueSquadId },
      data: {
        totalAcreageSearched: { increment: acreage },
      },
    });

    // Check if user should level up (SENTRY → SHEPHERD: 5+ areas, 15+ acres)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (
      user.rescueLevel === 'SENTRY' &&
      user.areasMarkedCount >= 5 &&
      user.totalAcreageSearched >= 15
    ) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { rescueLevel: 'SHEPHERD' },
      });
    }

    return NextResponse.json({ searchArea }, { status: 201 });
  } catch (error) {
    console.error('Error marking search area:', error);
    return NextResponse.json(
      { error: 'Failed to mark search area' },
      { status: 500 }
    );
  }
}
