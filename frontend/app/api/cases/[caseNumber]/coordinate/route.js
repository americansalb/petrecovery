import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/cases/[caseNumber]/coordinate
 *
 * Fetches case data along with assignment info for coordination.
 * Requires user to be a member of a squad assigned to this case.
 *
 * Phase 1.2: Case Coordination UI
 */
export async function GET(request, { params }) {
  const { caseNumber } = params;
  const startTime = Date.now();

  console.log('========================================');
  console.log('[COORDINATE-API] GET request received');
  console.log(`[COORDINATE-API] Case number: ${caseNumber}`);
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
    console.log(`[COORDINATE-API] Looking up case: ${caseNumber}`);
    const caseRecord = await prisma.case.findUnique({
      where: { caseNumber },
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

    if (!caseRecord) {
      console.log('[COORDINATE-API] Case not found');
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    console.log(`[COORDINATE-API] Case found: ${caseRecord.id}`);
    console.log(`[COORDINATE-API] Assignments count: ${caseRecord.assignments.length}`);

    // Find an assignment where the user is a squad member
    let userAssignment = null;
    let isLeader = false;
    let isParticipant = false;

    for (const assignment of caseRecord.assignments) {
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
        id: caseRecord.id,
        caseNumber: caseRecord.caseNumber,
        petName: caseRecord.petName,
        petSpecies: caseRecord.petSpecies,
        petBreed: caseRecord.petBreed,
        petColor: caseRecord.petColor,
        petPhotoUrl: caseRecord.petPhotoUrl,
        petDescription: caseRecord.petDescription,
        status: caseRecord.status,
        priority: caseRecord.priority,
        lastSeenAt: caseRecord.lastSeenAt,
        lastSeenLatitude: caseRecord.lastSeenLatitude,
        lastSeenLongitude: caseRecord.lastSeenLongitude,
        lastSeenAddress: caseRecord.lastSeenAddress,
        city: caseRecord.lastSeenAddress?.split(',')[1]?.trim() || 'Unknown',
        state: caseRecord.lastSeenAddress?.split(',')[2]?.trim()?.substring(0, 2) || 'XX',
        hasReward: caseRecord.hasReward,
        rewardAmount: caseRecord.rewardAmount,
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
