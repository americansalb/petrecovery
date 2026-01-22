/**
 * Single Division API
 * GET: Get division details
 * PATCH: Update division
 * DELETE: Delete/deactivate division
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const forceId = params.id;
    const { divisionId } = params;

    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueForceId: forceId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            members: {
              where: { isActive: true },
            },
          },
        },
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' },
          ],
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      division: {
        id: division.id,
        name: division.name,
        description: division.description,
        coverageArea: division.coverageArea,
        memberCount: division._count.members,
        members: division.members.map(m => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
        createdBy: division.createdBy,
        createdAt: division.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching division:', error);
    return NextResponse.json(
      { error: 'Failed to fetch division' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const forceId = params.id;
    const { divisionId } = params;
    const { name, description, coverageArea } = await request.json();

    // Check if user is a force founder/leader
    const membership = await prisma.squadMembership.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only force founders and leaders can update divisions' },
        { status: 403 }
      );
    }

    // Check if division exists
    const existing = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueForceId: forceId,
        isActive: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.division.findFirst({
        where: {
          rescueForceId: forceId,
          name: { equals: name.trim(), mode: 'insensitive' },
          isActive: true,
          id: { not: divisionId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'A division with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Update the division
    const division = await prisma.division.update({
      where: { id: divisionId },
      data: {
        name: name?.trim() || existing.name,
        description: description?.trim() ?? existing.description,
        coverageArea: coverageArea?.trim() ?? existing.coverageArea,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            members: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      division: {
        id: division.id,
        name: division.name,
        description: division.description,
        coverageArea: division.coverageArea,
        memberCount: division._count.members,
      },
    });
  } catch (error) {
    console.error('Error updating division:', error);
    return NextResponse.json(
      { error: 'Failed to update division' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const forceId = params.id;
    const { divisionId } = params;

    // Check if user is a force founder/leader
    const membership = await prisma.squadMembership.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only force founders and leaders can delete divisions' },
        { status: 403 }
      );
    }

    // Check if division exists
    const existing = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueForceId: forceId,
        isActive: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    // Soft delete - deactivate the division
    await prisma.division.update({
      where: { id: divisionId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Remove division assignment from all members
    await prisma.squadMembership.updateMany({
      where: {
        divisionId: divisionId,
        isActive: true,
      },
      data: {
        divisionId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting division:', error);
    return NextResponse.json(
      { error: 'Failed to delete division' },
      { status: 500 }
    );
  }
}
