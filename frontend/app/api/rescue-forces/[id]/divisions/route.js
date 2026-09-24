/**
 * Divisions API for Rescue Forces
 * GET: List all divisions in a squad
 * POST: Create a new division (founders/leaders only)
 *
 * Create, edit and delete used to answer 500 every time: they checked the
 * caller against prisma.squadMembership, a model that does not exist (the
 * members table is RescueForceMember), and wrote coverageArea and
 * createdById, which are not Division columns.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { zipCenter, divisionRadius } from '@/app/lib/zipCenter';

/** The ZIP a division's area was set from (zipCodes is a JSON array). */
function divisionZip(div) {
  try {
    return JSON.parse(div.zipCodes || '[]')[0] || null;
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  try {
    const squadId = params.id;

    const divisions = await prisma.division.findMany({
      where: {
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
          where: {
            isActive: true,
            role: { in: ['LEADER', 'COORDINATOR'] },
          },
          // First names only: this list is public, the same rule as the
          // force page's member list.
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Format response
    const formattedDivisions = divisions.map(div => ({
      id: div.id,
      name: div.name,
      description: div.description,
      zipCode: divisionZip(div),
      radiusMiles: div.radiusMiles,
      hasArea: div.centerLatitude != null && div.centerLongitude != null,
      memberCount: div._count.members,
      leaders: div.members.map(m => ({
        id: m.id,
        role: m.role,
        user: m.user,
      })),
      createdAt: div.createdAt,
    }));

    return NextResponse.json({ divisions: formattedDivisions });
  } catch (error) {
    console.error('Error fetching divisions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch divisions' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const squadId = params.id;
    const { name, description, zipCode, radiusMiles } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Division name is required' },
        { status: 400 }
      );
    }

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
        { error: 'Only rescue force founders and leaders can create divisions' },
        { status: 403 }
      );
    }

    // Check for duplicate name. A deleted division keeps its row (and the
    // name, which is unique within the force), so the same name comes back
    // by reactivating that row instead of failing on the unique constraint.
    const existing = await prisma.division.findFirst({
      where: {
        rescueSquadId: squadId,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    });

    if (existing && existing.isActive && !existing.isDeleted) {
      return NextResponse.json(
        { error: 'A division with this name already exists' },
        { status: 400 }
      );
    }

    const data = { name: name.trim(), description: description?.trim() || null, radiusMiles: divisionRadius(radiusMiles) };

    // The division's area: the centre of a ZIP code and a radius. Without
    // one it cannot be drawn on the map or matched to pets.
    if (zipCode) {
      const center = await zipCenter(String(zipCode).trim());
      if (!center) {
        return NextResponse.json({ error: `We could not find the ZIP code ${String(zipCode).trim()}.` }, { status: 400 });
      }
      Object.assign(data, { centerLatitude: center.lat, centerLongitude: center.lng, zipCodes: JSON.stringify([String(zipCode).trim()]) });
    }
    const division = existing
      ? await prisma.division.update({
          where: { id: existing.id },
          data: { ...data, isActive: true, isDeleted: false, deletedAt: null },
        })
      : await prisma.division.create({ data: { ...data, rescueSquadId: squadId } });

    return NextResponse.json({
      division: {
        id: division.id,
        name: division.name,
        description: division.description,
        zipCode: divisionZip(division),
        radiusMiles: division.radiusMiles,
        hasArea: division.centerLatitude != null && division.centerLongitude != null,
        memberCount: 0,
        leaders: [],
        createdAt: division.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating division:', error);
    return NextResponse.json(
      { error: 'Failed to create division' },
      { status: 500 }
    );
  }
}
