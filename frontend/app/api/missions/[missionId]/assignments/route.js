import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/missions/[id]/assignments - Get all force assignments for a case
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const assignments = await prisma.caseAssignment.findMany({
      where: { missionId: id },
      include: {
        rescueForce: {
          select: {
            id: true,
            name: true,
            rescueForceLevel: true,
            successfulReunions: true,
          },
        },
        participants: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
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

// POST /api/missions/[id]/assignments - Force leader accepts a case
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: missionId } = params;
    const body = await request.json();
    const { rescueForceId } = body;

    if (!rescueForceId) {
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

    // Check if user is a leader of the force
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueForceId,
        userId: session.user.id,
        role: { in: ['FOUNDER', 'LEADER'] },
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only force leaders can accept cases' },
        { status: 403 }
      );
    }

    // Check if force already accepted this case
    const existingAssignment = await prisma.caseAssignment.findUnique({
      where: {
        missionId_rescueForceId: {
          missionId,
          rescueForceId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Your force has already accepted this case' },
        { status: 400 }
      );
    }

    // Create the assignment
    const assignment = await prisma.caseAssignment.create({
      data: {
        missionId,
        rescueForceId,
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
        rescueForce: {
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

    // Update force stats
    await prisma.rescueForce.update({
      where: { id: rescueForceId },
      data: {
        totalMissionsAccepted: { increment: 1 },
      },
    });

    // Send notifications to all active force members
    try {
      // Get force and mission details with members
      const forceWithMembers = await prisma.rescueForce.findUnique({
        where: { id: rescueForceId },
        select: {
          name: true,
          members: {
            where: { status: 'ACTIVE' },
            select: {
              userId: true,
              user: {
                select: { email: true },
              },
            },
          },
        },
      });

      const mission = await prisma.case.findUnique({
        where: { id: missionId },
        select: {
          missionNumber: true,
          petName: true,
          petSpecies: true,
          city: true,
          state: true,
        },
      });

      if (forceWithMembers && mission) {
        const memberIds = forceWithMembers.members.map(m => m.userId);
        const memberEmails = forceWithMembers.members.map(m => m.user.email).filter(Boolean);
        const location = `${mission.city}, ${mission.state}`;

        // Send push notifications
        const { sendMissionAssignmentPushNotification } = await import('@/app/lib/notifications');
        await sendMissionAssignmentPushNotification({
          memberIds,
          forceName: forceWithMembers.name,
          petName: mission.petName || mission.petSpecies,
          missionNumber: mission.missionNumber,
          location,
        });

        // Send email notifications
        const { sendCaseAssignmentNotification } = await import('@/app/lib/notifications');
        await sendCaseAssignmentNotification({
          memberEmails,
          forceName: forceWithMembers.name,
          petName: mission.petName,
          petSpecies: mission.petSpecies,
          missionNumber: mission.missionNumber,
          location,
        });
      }
    } catch (notificationError) {
      console.error('Error sending mission assignment notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error('Error accepting case:', error);
    return NextResponse.json(
      { error: 'Failed to accept case' },
      { status: 500 }
    );
  }
}
