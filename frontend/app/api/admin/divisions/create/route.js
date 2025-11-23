import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/admin/divisions/create - Admin directly creates a division (no approval needed)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    // Check admin auth
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      rescueSquadId,
      name,
      description,
      boundaries,
      centerLatitude,
      centerLongitude,
      zipCodes
    } = body;

    // Validate required fields
    if (!rescueSquadId || !name || !boundaries) {
      return NextResponse.json(
        { error: 'Missing required fields: rescueSquadId, name, boundaries' },
        { status: 400 }
      );
    }

    // Verify rescue squad exists
    const rescueSquad = await prisma.rescueSquad.findUnique({
      where: { id: rescueSquadId }
    });

    if (!rescueSquad) {
      return NextResponse.json(
        { error: 'Rescue squad not found' },
        { status: 404 }
      );
    }

    // Check if division name already exists in this squad
    const existingDivision = await prisma.division.findFirst({
      where: {
        rescueSquadId,
        name: name.trim()
      }
    });

    if (existingDivision) {
      return NextResponse.json(
        { error: 'A division with this name already exists in this squad' },
        { status: 400 }
      );
    }

    // Parse zipCodes if provided
    let zipCodesArray = [];
    if (zipCodes && typeof zipCodes === 'string') {
      zipCodesArray = zipCodes
        .split(',')
        .map(z => z.trim())
        .filter(z => z.length > 0);
    }

    // Create the division directly (no request/approval flow)
    const division = await prisma.division.create({
      data: {
        rescueSquadId,
        name: name.trim(),
        description: description?.trim() || null,
        boundaries: boundaries, // JSON polygon coordinates
        centerLatitude: centerLatitude ? parseFloat(centerLatitude) : null,
        centerLongitude: centerLongitude ? parseFloat(centerLongitude) : null,
        zipCodes: JSON.stringify(zipCodesArray),
        isActive: true,
        totalMembers: 0,
        activeCases: 0,
        successfulReunions: 0
      }
    });

    return NextResponse.json({
      division,
      message: 'Division created successfully'
    });

  } catch (error) {
    console.error('Error creating division:', error);
    return NextResponse.json(
      { error: 'Failed to create division' },
      { status: 500 }
    );
  }
}
