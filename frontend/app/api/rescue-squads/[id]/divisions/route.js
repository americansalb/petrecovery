/**
 * Divisions API for Rescue Squads
 * GET: List all divisions in a squad
 * POST: Create a new division (founders/leaders only)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const squadId = params.id;

    const divisions = await prisma.division.findMany({
      where: {
        rescueSquadId: squadId,
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
          where: {
            isActive: true,
            role: { in: ['LEADER', 'COORDINATOR'] },
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
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
      coverageArea: div.coverageArea,
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
    const { name, description, coverageArea } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Division name is required' },
        { status: 400 }
      );
    }

    // Check if user is a squad founder/leader
    const membership = await prisma.squadMembership.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only squad founders and leaders can create divisions' },
        { status: 403 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.division.findFirst({
      where: {
        rescueSquadId: squadId,
        name: { equals: name.trim(), mode: 'insensitive' },
        isActive: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A division with this name already exists' },
        { status: 400 }
      );
    }

    // Create the division
    const division = await prisma.division.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        coverageArea: coverageArea?.trim() || null,
        rescueSquadId: squadId,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({
      division: {
        id: division.id,
        name: division.name,
        description: division.description,
        coverageArea: division.coverageArea,
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
