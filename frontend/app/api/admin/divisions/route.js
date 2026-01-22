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
    const rescueForceId = searchParams.get('rescueForceId');

    const where = rescueForceId ? { rescueForceId } : {};

    const divisions = await prisma.division.findMany({
      where,
      include: {
        rescueForce: {
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
        { rescueForce: { name: 'asc' } },
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
    const { rescueForceId, name, description, boundaries, centerLatitude, centerLongitude } = body;

    // Validate required fields
    if (!rescueForceId || !name) {
      return NextResponse.json({ error: 'Rescue Force and name are required' }, { status: 400 });
    }

    // Check if rescue force exists
    const rescueForce = await prisma.rescueForce.findUnique({
      where: { id: rescueForceId }
    });

    if (!rescueForce) {
      return NextResponse.json({ error: 'Rescue Force not found' }, { status: 404 });
    }

    // Check for duplicate division name within this force
    const existing = await prisma.division.findFirst({
      where: {
        rescueForceId,
        name
      }
    });

    if (existing) {
      return NextResponse.json({
        error: `Division "${name}" already exists in ${rescueForce.name}`
      }, { status: 400 });
    }

    // Create the division
    const division = await prisma.division.create({
      data: {
        rescueForceId,
        name,
        description: description || null,
        boundaries: boundaries || null,
        centerLatitude: centerLatitude ? parseFloat(centerLatitude) : null,
        centerLongitude: centerLongitude ? parseFloat(centerLongitude) : null,
        isActive: true
      },
      include: {
        rescueForce: {
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
