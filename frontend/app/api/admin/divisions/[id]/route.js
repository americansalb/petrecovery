import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// DELETE /api/admin/divisions/[id] - Soft delete a division
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;

    // Check if division exists
    const division = await prisma.division.findUnique({
      where: { id, isDeleted: false },
      include: {
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }

    // Soft delete - set isDeleted flag instead of hard delete
    await prisma.division.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      }
    });

    // Remove division assignment from members (move to squad-level)
    await prisma.rescueSquadMember.updateMany({
      where: { divisionId: id },
      data: { divisionId: null }
    });

    return NextResponse.json({
      success: true,
      message: `Division deleted successfully (${division._count.members} members moved to squad-level)`,
      metadata: {
        membersAffected: division._count.members,
        softDelete: true,
      }
    });
  } catch (error) {
    console.error('Error deleting division:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/divisions/[id] - Update a division
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, boundaries, centerLatitude, centerLongitude, isActive } = body;

    // Check if division exists
    const existingDivision = await prisma.division.findUnique({
      where: { id }
    });

    if (!existingDivision) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }

    // Update the division
    const division = await prisma.division.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(boundaries !== undefined && { boundaries }),
        ...(centerLatitude !== undefined && { centerLatitude: parseFloat(centerLatitude) }),
        ...(centerLongitude !== undefined && { centerLongitude: parseFloat(centerLongitude) }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        rescueSquad: {
          select: {
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    return NextResponse.json({ division });
  } catch (error) {
    console.error('Error updating division:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
