import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// DELETE /api/admin/rescue-forces/:id - Soft delete a rescue force (admin only)
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const force = await prisma.rescueForce.findUnique({
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

    if (!force) {
      return NextResponse.json(
        { error: 'Rescue force not found' },
        { status: 404 }
      );
    }

    // Remove case assignments first so cases become unassigned (not deleted)
    // Cases stay in the system and can be reassigned to another force
    const deletedAssignments = await prisma.caseAssignment.deleteMany({
      where: { rescueForceId: params.id },
    });

    // Soft delete - set isDeleted flag instead of hard delete
    await prisma.rescueForce.update({
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
      where: { rescueForceId: params.id, isDeleted: false },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json({
      message: 'Rescue force deleted successfully',
      metadata: {
        membersAffected: force._count.members,
        divisionsAffected: force._count.divisions,
        casesUnassigned: deletedAssignments.count,
        softDelete: true,
      },
    });
  } catch (error) {
    console.error('Error deleting rescue force:', error);
    return NextResponse.json(
      { error: 'Failed to delete rescue force' },
      { status: 500 }
    );
  }
}
