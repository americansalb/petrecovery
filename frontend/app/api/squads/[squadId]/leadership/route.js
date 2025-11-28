/**
 * Leadership Dashboard API
 * Squad commander and division lead controls
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  getLeadershipDashboard,
  approveJoinRequest,
  rejectJoinRequest,
  changeMemberRole,
  assignToDivision,
  removeMember,
  createDivision,
  broadcastMessage,
  reassignSearchArea,
} from '@/app/lib/volunteer/leadership';

export async function GET(request, { params }) {
  try {
    const { squadId } = params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await getLeadershipDashboard(session.user.id, squadId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Leadership dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to get leadership data' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { squadId } = params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    let result;

    switch (action) {
      case 'approveJoin':
        result = await approveJoinRequest(
          body.requestId,
          session.user.id,
          { role: body.role, divisionId: body.divisionId }
        );
        break;

      case 'rejectJoin':
        result = await rejectJoinRequest(
          body.requestId,
          session.user.id,
          body.reason
        );
        break;

      case 'changeRole':
        result = await changeMemberRole(
          body.membershipId,
          body.newRole,
          session.user.id
        );
        break;

      case 'assignDivision':
        result = await assignToDivision(
          body.membershipId,
          body.divisionId,
          session.user.id
        );
        break;

      case 'removeMember':
        result = await removeMember(
          body.membershipId,
          session.user.id,
          body.reason
        );
        break;

      case 'createDivision':
        result = await createDivision(
          squadId,
          body.division,
          session.user.id
        );
        break;

      case 'broadcast':
        result = await broadcastMessage({
          senderId: session.user.id,
          squadId,
          divisionId: body.divisionId,
          message: body.message,
          type: body.type,
        });
        break;

      case 'reassignArea':
        result = await reassignSearchArea({
          cellId: body.cellId,
          fromUserId: body.fromUserId,
          toUserId: body.toUserId,
          leaderId: session.user.id,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Leadership action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
