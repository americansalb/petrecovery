import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// DELETE /api/admin/rescue-squads/:id - Delete a rescue squad (admin only)
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squad = await prisma.rescueSquad.findUnique({
      where: { id: params.id },
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

    // Warning if squad has active members or cases
    if (squad._count.members > 0 || squad._count.caseAssignments > 0) {
      console.warn(`Deleting squad ${squad.name} with ${squad._count.members} members and ${squad._count.caseAssignments} cases`);
    }

    // Delete squad (cascading will handle related records)
    await prisma.rescueSquad.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'Rescue squad deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to delete rescue squad' },
      { status: 500 }
    );
  }
}
