import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// DELETE /api/admin/rescue-squads/:id - Soft delete a rescue squad (admin only)
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squad = await prisma.rescueSquad.findUnique({
      where: { id: params.id, isDeleted: false },
      include: {
        _count: {
          select: {
            members: true,
            divisions: true,
            caseAssignments: true,
          },
        },
      },
    });

    if (!squad) {
      return NextResponse.json(
        { error: 'Rescue squad not found' },
        { status: 404 }
      );
    }

    // Remove case assignments first so cases become unassigned (not deleted)
    // Cases stay in the system and can be reassigned to another squad
    const deletedAssignments = await prisma.caseAssignment.deleteMany({
      where: { rescueSquadId: params.id },
    });

    // Soft delete - set isDeleted flag instead of hard delete
    await prisma.rescueSquad.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        isAcceptingCases: false,
      },
    });

    // Also soft delete associated divisions
    await prisma.division.updateMany({
      where: { rescueSquadId: params.id, isDeleted: false },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json({
      message: 'Rescue squad deleted successfully',
      metadata: {
        membersAffected: squad._count.members,
        divisionsAffected: squad._count.divisions,
        casesUnassigned: deletedAssignments.count,
        softDelete: true,
      },
    });
  } catch (error) {
    console.error('Error deleting rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to delete rescue squad' },
      { status: 500 }
    );
  }
}
