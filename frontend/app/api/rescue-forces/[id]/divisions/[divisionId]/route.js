/**
 * Single Division API
 * GET: Get division details
 * PATCH: Update division
 * DELETE: Delete/deactivate division
 *
 * GET asked for a createdBy relation Division does not have (so it always
 * failed) and would have listed members' email addresses to anyone. PATCH
 * and DELETE checked the caller against prisma.squadMembership, which does
 * not exist, so they always answered 500.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { zipCenter, divisionRadius } from '@/app/lib/zipCenter';

export async function GET(request, { params }) {
  try {
    const squadId = params.id;
    const { divisionId } = params;

    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueSquadId: squadId,
        isActive: true,
        isDeleted: false,
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
          // First names only: this is public, like the force page's list.
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' },
          ],
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
        memberCount: division._count.members,
        members: division.members.map(m => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
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

    const squadId = params.id;
    const { divisionId } = params;
    const { name, description, zipCode, radiusMiles } = await request.json();

    // Check if user is a squad founder/leader
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only rescue force founders and leaders can update divisions' },
        { status: 403 }
      );
    }

    // Check if division exists
    const existing = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueSquadId: squadId,
        isActive: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being changed. A deleted division
    // keeps its name (names are unique within a force), so it counts too.
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.division.findFirst({
        where: {
          rescueSquadId: squadId,
          name: { equals: name.trim(), mode: 'insensitive' },
          id: { not: divisionId },
        },
      });

      if (duplicate) {
        const deleted = !duplicate.isActive || duplicate.isDeleted;
        return NextResponse.json(
          {
            error: deleted
              ? 'A deleted division had this name. Pick another name, or add that division again to bring it back.'
              : 'A division with this name already exists',
          },
          { status: 400 }
        );
      }
    }

    // The area: a ZIP code's centre and a radius. An empty ZIP clears it.
    const area = {};
    if (radiusMiles !== undefined) area.radiusMiles = divisionRadius(radiusMiles);
    if (zipCode !== undefined) {
      const zip = String(zipCode || '').trim();
      if (!zip) {
        Object.assign(area, { centerLatitude: null, centerLongitude: null, zipCodes: '[]' });
      } else {
        const center = await zipCenter(zip);
        if (!center) {
          return NextResponse.json({ error: `We could not find the ZIP code ${zip}.` }, { status: 400 });
        }
        Object.assign(area, { centerLatitude: center.lat, centerLongitude: center.lng, zipCodes: JSON.stringify([zip]) });
      }
    }

    // Update the division
    const division = await prisma.division.update({
      where: { id: divisionId },
      data: {
        name: name?.trim() || existing.name,
        description: description?.trim() ?? existing.description,
        ...area,
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

    const squadId = params.id;
    const { divisionId } = params;

    // Check if user is a squad founder/leader
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only rescue force founders and leaders can delete divisions' },
        { status: 403 }
      );
    }

    // Check if division exists
    const existing = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueSquadId: squadId,
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
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Remove division assignment from all members
    await prisma.rescueForceMember.updateMany({
      where: {
        divisionId: divisionId,
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
