/**
 * Single Division Member API
 * DELETE: Remove member from division
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const squadId = params.id;
    const { divisionId, memberId } = params;

    // Verify user has permission (founder or leader)
    const userMembership = await prisma.squadMembership.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!userMembership) {
      return NextResponse.json(
        { error: 'Only founders and leaders can remove division members' },
        { status: 403 }
      );
    }

    // Verify the member exists and is in this division
    const member = await prisma.squadMembership.findFirst({
      where: {
        id: memberId,
        rescueSquadId: squadId,
        divisionId: divisionId,
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found in this division' },
        { status: 404 }
      );
    }

    // Don't allow removing division leaders (they need to be reassigned first)
    if (member.role === 'LEADER') {
      return NextResponse.json(
        { error: 'Cannot remove division leaders. Reassign leadership first.' },
        { status: 400 }
      );
    }

    // Remove from division (set divisionId to null)
    await prisma.squadMembership.update({
      where: { id: memberId },
      data: { divisionId: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member from division:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
