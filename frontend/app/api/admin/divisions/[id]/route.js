import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// DELETE /api/admin/divisions/[id] - Delete a division
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = params;

    // Check if division exists
    const division = await prisma.division.findUnique({
      where: { id },
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

    // Delete the division (cascading will handle members)
    await prisma.division.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: `Division deleted successfully (${division._count.members} members will be moved to squad-level)`
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
