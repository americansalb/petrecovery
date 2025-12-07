import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/admin/divisions - List all divisions
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rescueSquadId = searchParams.get('rescueSquadId');

    const where = rescueSquadId ? { rescueSquadId } : {};

    const divisions = await prisma.division.findMany({
      where,
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true
          }
        },
        _count: {
          select: {
            members: true
          }
        }
      },
      orderBy: [
        { rescueSquad: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ divisions });
  } catch (error) {
    console.error('Error fetching divisions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/divisions - Create a new division
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { rescueSquadId, name, description, boundaries, centerLatitude, centerLongitude } = body;

    // Validate required fields
    if (!rescueSquadId || !name) {
      return NextResponse.json({ error: 'Rescue Squad and name are required' }, { status: 400 });
    }

    // Check if rescue squad exists
    const rescueSquad = await prisma.rescueSquad.findUnique({
      where: { id: rescueSquadId }
    });

    if (!rescueSquad) {
      return NextResponse.json({ error: 'Rescue Squad not found' }, { status: 404 });
    }

    // Check for duplicate division name within this squad
    const existing = await prisma.division.findFirst({
      where: {
        rescueSquadId,
        name
      }
    });

    if (existing) {
      return NextResponse.json({
        error: `Division "${name}" already exists in ${rescueSquad.name}`
      }, { status: 400 });
    }

    // Create the division
    const division = await prisma.division.create({
      data: {
        rescueSquadId,
        name,
        description: description || null,
        boundaries: boundaries || null,
        centerLatitude: centerLatitude ? parseFloat(centerLatitude) : null,
        centerLongitude: centerLongitude ? parseFloat(centerLongitude) : null,
        isActive: true
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

    return NextResponse.json({ division }, { status: 201 });
  } catch (error) {
    console.error('Error creating division:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
