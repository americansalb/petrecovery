/**
 * Squad Broadcast API
 * Send messages to all volunteers across multiple missions
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const squadId = params.id;
    const { message, type = 'INFO', missionIds } = await request.json();

    // Verify user is a squad leader/founder/coordinator
    const membership = await prisma.squadMembership.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER', 'COORDINATOR'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only squad leaders can broadcast' },
        { status: 403 }
      );
    }

    // Get missions to broadcast to
    let missions;
    if (missionIds && missionIds.length > 0) {
      // Broadcast to specific missions
      missions = await prisma.missionControl.findMany({
        where: {
          id: { in: missionIds },
          case: {
            assignments: {
              some: {
                rescueSquadId: squadId,
                status: { in: ['ACCEPTED', 'ACTIVE'] },
              }
            }
          }
        },
        select: { id: true, missionId: true }
      });
    } else {
      // Get all active missions for this squad
      const assignments = await prisma.caseAssignment.findMany({
        where: {
          rescueSquadId: squadId,
          status: { in: ['ACCEPTED', 'ACTIVE'] },
        },
        select: { missionId: true }
      });

      const missionIds = assignments.map(a => a.missionId);

      missions = await prisma.missionControl.findMany({
        where: {
          missionId: { in: missionIds },
          mode: { in: ['LIVE_SEARCH', 'CONTAINMENT', 'TRAP_OPS'] },
        },
        select: { id: true, missionId: true }
      });
    }

    if (missions.length === 0) {
      return NextResponse.json(
        { error: 'No active missions to broadcast to' },
        { status: 400 }
      );
    }

    // Create broadcast records for each mission
    const broadcasts = await Promise.all(
      missions.map(mission =>
        prisma.missionBroadcast.create({
          data: {
            missionControlId: mission.id,
            senderId: session.user.id,
            message: message.trim(),
            type,
            squadId,
          }
        })
      )
    );

    // If FREEZE type, update mission modes
    if (type === 'FREEZE') {
      await prisma.missionControl.updateMany({
        where: { id: { in: missions.map(m => m.id) } },
        data: { frozenAt: new Date() }
      });
    }

    return NextResponse.json({
      success: true,
      broadcasted: broadcasts.length,
      missionIds: missions.map(m => m.id),
    });
  } catch (error) {
    console.error('Error broadcasting:', error);
    return NextResponse.json(
      { error: 'Failed to broadcast message' },
      { status: 500 }
    );
  }
}
