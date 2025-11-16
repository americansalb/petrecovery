import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../lib/prisma';

// POST /api/squads/create - Create a recovery squad for a lost pet report
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reportId, communityId } = body;

    // Validation
    if (!reportId || !communityId) {
      return NextResponse.json(
        { error: 'Report ID and Community ID are required' },
        { status: 400 }
      );
    }

    // Verify the report exists and belongs to the user
    const report = await prisma.lostReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reporterId: true,
        petName: true,
        status: true
      }
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Lost pet report not found' },
        { status: 404 }
      );
    }

    if (report.reporterId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only create squads for your own lost pet reports' },
        { status: 403 }
      );
    }

    if (report.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot create squad for inactive reports' },
        { status: 400 }
      );
    }

    // Verify the community exists
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      select: {
        id: true,
        name: true,
        isActive: true
      }
    });

    if (!community) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    if (!community.isActive) {
      return NextResponse.json(
        { error: 'Cannot create squad in inactive community' },
        { status: 400 }
      );
    }

    // Check if user is a member of the community
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: communityId,
          userId: session.user.id
        }
      }
    });

    if (!membership || membership.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'You must be a member of this community to create a squad' },
        { status: 403 }
      );
    }

    // Check if squad already exists for this report in this community
    const existingSquad = await prisma.recoverySquad.findUnique({
      where: {
        reportId_communityId: {
          reportId: reportId,
          communityId: communityId
        }
      }
    });

    if (existingSquad) {
      return NextResponse.json(
        { error: 'A recovery squad already exists for this report in this community' },
        { status: 409 }
      );
    }

    // Create the squad with the owner as first member
    const result = await prisma.$transaction(async (tx) => {
      // Create the squad
      const squad = await tx.recoverySquad.create({
        data: {
          reportId: reportId,
          communityId: communityId,
          name: `${report.petName} Recovery Squad - ${community.name}`,
          status: 'ACTIVE',
          memberCount: 1
        }
      });

      // Add the pet owner as squad leader
      await tx.squadMember.create({
        data: {
          squadId: squad.id,
          userId: session.user.id,
          role: 'OWNER'
        }
      });

      return squad;
    });

    return NextResponse.json({
      success: true,
      squad: {
        id: result.id,
        name: result.name,
        reportId: result.reportId,
        communityId: result.communityId
      }
    });

  } catch (error) {
    console.error('Error creating recovery squad:', error);
    return NextResponse.json(
      { error: 'Failed to create recovery squad' },
      { status: 500 }
    );
  }
}
