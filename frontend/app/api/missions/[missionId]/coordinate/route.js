import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/missions/[id]/coordinate
 *
 * Fetches case data along with assignment info for coordination.
 * Requires user to be a member of a squad assigned to this case.
 *
 * Phase 1.2: Mission Coordination UI
 */
export async function GET(request, { params }) {
  const { id: missionNumber } = params;
  const startTime = Date.now();

  console.log('========================================');
  console.log('[COORDINATE-API] GET request received');
  console.log(`[COORDINATE-API] Mission number: ${missionNumber}`);
  console.log(`[COORDINATE-API] Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    console.log(`[COORDINATE-API] Session user: ${session?.user?.id || 'none'}`);

    if (!session?.user?.id) {
      console.log('[COORDINATE-API] No session, returning 401');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Find the case
    console.log(`[COORDINATE-API] Looking up case: ${missionNumber}`);
    const missionRecord = await prisma.case.findUnique({
      where: { missionNumber },
      include: {
        assignments: {
          include: {
            rescueSquad: {
              include: {
                members: {
                  where: {
                    userId,
                    isActive: true,
                  },
                },
              },
            },
            participants: {
              where: {
                userId,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!missionRecord) {
      console.log('[COORDINATE-API] Mission not found');
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    console.log(`[COORDINATE-API] Case found: ${missionRecord.id}`);
    console.log(`[COORDINATE-API] Assignments count: ${missionRecord.assignments.length}`);

    // Find an assignment where the user is a squad member
    let userAssignment = null;
    let isLeader = false;
    let isParticipant = false;

    for (const assignment of missionRecord.assignments) {
      const squadMembership = assignment.rescueSquad.members[0];
      if (squadMembership) {
        userAssignment = assignment;
        isLeader = ['FOUNDER', 'LEADER', 'COORDINATOR'].includes(squadMembership.role);
        isParticipant = assignment.participants.length > 0;
        console.log(`[COORDINATE-API] Found user's assignment: ${assignment.id}`);
        console.log(`[COORDINATE-API] User role: ${squadMembership.role}`);
        console.log(`[COORDINATE-API] Is leader: ${isLeader}`);
        console.log(`[COORDINATE-API] Is participant: ${isParticipant}`);
        break;
      }
    }

    if (!userAssignment) {
      console.log('[COORDINATE-API] User is not a member of any assigned squad');
      return NextResponse.json(
        { error: 'You are not a member of a squad assigned to this case' },
        { status: 403 }
      );
    }

    // Prepare response data
    const responseData = {
      case: {
        id: missionRecord.id,
        missionNumber: missionRecord.caseNumber,
        petName: missionRecord.petName,
        petSpecies: missionRecord.petSpecies,
        petBreed: missionRecord.petBreed,
        petColor: missionRecord.petColor,
        petPhotoUrl: missionRecord.petPhotoUrl,
        petDescription: missionRecord.petDescription,
        status: missionRecord.status,
        priority: missionRecord.priority,
        lastSeenAt: missionRecord.lastSeenAt,
        lastSeenLatitude: missionRecord.lastSeenLatitude,
        lastSeenLongitude: missionRecord.lastSeenLongitude,
        lastSeenAddress: missionRecord.lastSeenAddress,
        city: missionRecord.lastSeenAddress?.split(',')[1]?.trim() || 'Unknown',
        state: missionRecord.lastSeenAddress?.split(',')[2]?.trim()?.substring(0, 2) || 'XX',
        hasReward: missionRecord.hasReward,
        rewardAmount: missionRecord.rewardAmount,
      },
      assignment: {
        id: userAssignment.id,
        status: userAssignment.status,
        squadName: userAssignment.rescueSquad.name,
        activeMembers: userAssignment.activeMembers,
        areasSearched: userAssignment.areasSearched,
        searchHours: userAssignment.searchHours,
      },
      isParticipant,
      isLeader,
    };

    const duration = Date.now() - startTime;
    console.log(`[COORDINATE-API] Response prepared in ${duration}ms`);
    console.log('[COORDINATE-API] Returning success response');

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('========================================');
    console.error('[COORDINATE-API] ERROR occurred');
    console.error(`[COORDINATE-API] Error message: ${error.message}`);
    console.error(`[COORDINATE-API] Error stack: ${error.stack}`);
    console.error('========================================');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
