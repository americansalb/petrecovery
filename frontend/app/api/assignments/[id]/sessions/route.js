/**
 * Search Sessions API
 *
 * POST /api/assignments/[id]/sessions - Start a new search session (check-in)
 * GET /api/assignments/[id]/sessions - Get all sessions for assignment
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// GET all sessions for this assignment
export async function GET(request, { params }) {
  try {
    const { id: assignmentId } = params;

    const sessions = await prisma.searchSession.findMany({
      where: {
        participant: {
          assignmentId,
        },
      },
      include: {
        participant: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST - Start a new search session
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assignmentId } = params;
    const body = await request.json();
    const { action } = body;

    // Find user's participation
    const participation = await prisma.caseParticipant.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
      include: {
        assignment: {
          include: {
            case: true,
          },
        },
      },
    });

    if (!participation) {
      return NextResponse.json(
        { error: 'You must join this case first' },
        { status: 403 }
      );
    }

    if (!participation.isActive) {
      return NextResponse.json(
        { error: 'Your participation is no longer active' },
        { status: 400 }
      );
    }

    // Check for existing active session
    const existingSession = await prisma.searchSession.findFirst({
      where: {
        participantId: participation.id,
        status: { in: ['READY', 'ACTIVE', 'PAUSED'] },
      },
    });

    if (existingSession) {
      return NextResponse.json(
        { error: 'You already have an active session', session: existingSession },
        { status: 400 }
      );
    }

    // Create new session
    const searchSession = await prisma.searchSession.create({
      data: {
        participantId: participation.id,
        missionId: participation.assignment.case.id,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // Create activity log
    await prisma.caseUpdate.create({
      data: {
        caseId: participation.assignment.case.id, // CaseUpdate's field is caseId (no missionId)
        authorId: session.user.id,
        content: `${session.user.firstName || 'A volunteer'} started searching`,
        isUpdate: true,
      },
    });

    return NextResponse.json({ session: searchSession }, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
