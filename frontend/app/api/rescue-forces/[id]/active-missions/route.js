import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { firstWord } from '@/app/lib/searchText';
import { PUBLIC_CASE_FIELDS } from '@/app/lib/casePublicFields';

// GET /api/rescue-forces/[id]/active-missions - Get squad's accepted/active cases
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId } = await params;
    if (typeof squadId !== 'string' || !squadId) {
      return NextResponse.json({ error: 'Rescue force not found' }, { status: 404 });
    }

    // Check if user is a member of this squad
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only rescue force members can view active cases' },
        { status: 403 }
      );
    }

    // Get all assignments for this squad (exclude completed/withdrawn).
    //
    // A member is told what the pet's own page tells anyone, and who else is on it by first name. This used
    // to send each pet's whole report (the owner's email, phone, full name and account id, and the answers
    // to the questionnaire with the microchip number) and every helper's account id and last name; and
    // joining a force is one tap.
    const assignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: squadId,
        status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] },
      },
      select: {
        id: true,
        missionId: true,
        rescueSquadId: true,
        status: true,
        acceptedAt: true,
        activeMembers: true,
        searchHours: true,
        areasSearched: true,
        case: { select: PUBLIC_CASE_FIELDS },
        participants: {
          where: { isActive: true },
          select: {
            id: true,
            userId: true,
            optedInAt: true,
            user: { select: { firstName: true, rescueLevel: true } },
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
      orderBy: {
        acceptedAt: 'desc',
      },
    });

    // Check which cases the current user is participating in. An account id is read to say that and is not sent.
    const assignmentsWithUserStatus = assignments.map(({ participants, ...assignment }) => {
      const userParticipation = participants.find((p) => p.userId === session.user.id);
      return {
        ...assignment,
        participants: participants.map((p) => ({
          optedInAt: p.optedInAt,
          mine: p.userId === session.user.id,
          user: { firstName: firstWord(p.user?.firstName) || 'A helper', rescueLevel: p.user?.rescueLevel || null },
        })),
        isUserParticipating: !!userParticipation,
        userParticipationId: userParticipation?.id || null,
      };
    });

    return NextResponse.json({
      assignments: assignmentsWithUserStatus,
    });
  } catch (error) {
    console.error('Error fetching active cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active cases' },
      { status: 500 }
    );
  }
}
