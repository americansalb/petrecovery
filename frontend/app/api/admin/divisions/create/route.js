import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/admin/divisions/create - Admin directly creates a division (no approval needed)
export async function POST(request) {
  try {
    console.log('🔷 [API] Division creation request received');

    const session = await getServerSession(authOptions);
    console.log('👤 [API] Session user:', session?.user?.email, 'Role:', session?.user?.role);

    // Check admin auth
    if (!session || session.user.role !== 'ADMIN') {
      console.error('❌ [API] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log('📦 [API] Request body:', JSON.stringify(body, null, 2));

    const {
      rescueSquadId,
      name,
      description,
      boundaries,
      centerLatitude,
      centerLongitude
    } = body;

    // Validate required fields
    console.log('🔍 [API] Validating fields...');
    if (!rescueSquadId || !name || !boundaries) {
      console.error('❌ [API] Missing required fields:', {
        hasSquadId: !!rescueSquadId,
        hasName: !!name,
        hasBoundaries: !!boundaries
      });
      return NextResponse.json(
        { error: 'Missing required fields: rescueSquadId, name, boundaries' },
        { status: 400 }
      );
    }
    console.log('✅ [API] All required fields present');

    // Verify rescue squad exists
    console.log('🔍 [API] Checking if rescue squad exists:', rescueSquadId);
    const rescueSquad = await prisma.rescueSquad.findUnique({
      where: { id: rescueSquadId }
    });

    if (!rescueSquad) {
      console.error('❌ [API] Rescue squad not found');
      return NextResponse.json(
        { error: 'Rescue squad not found' },
        { status: 404 }
      );
    }
    console.log('✅ [API] Rescue squad found:', rescueSquad.name);

    // Check if division name already exists in this squad
    console.log('🔍 [API] Checking for duplicate division name...');
    const existingDivision = await prisma.division.findFirst({
      where: {
        rescueSquadId,
        name: name.trim()
      }
    });

    if (existingDivision) {
      console.error('❌ [API] Division name already exists:', name);
      return NextResponse.json(
        { error: 'A division with this name already exists in this squad' },
        { status: 400 }
      );
    }
    console.log('✅ [API] Division name is unique');

    // Create the division directly (no request/approval flow)
    console.log('💾 [API] Creating division in database...');
    const divisionData = {
      rescueSquadId,
      name: name.trim(),
      description: description?.trim() || null,
      boundaries: boundaries, // JSON polygon coordinates
      centerLatitude: centerLatitude ? parseFloat(centerLatitude) : null,
      centerLongitude: centerLongitude ? parseFloat(centerLongitude) : null,
      zipCodes: JSON.stringify([]),
      isActive: true,
      totalMembers: 0,
      activeCases: 0,
      successfulReunions: 0
    };
    console.log('📊 [API] Division data:', JSON.stringify(divisionData, null, 2));

    const division = await prisma.division.create({
      data: divisionData
    });

    console.log('✅ [API] Division created successfully!', division.id);

    return NextResponse.json({
      division,
      message: 'Division created successfully'
    });

  } catch (error) {
    console.error('❌ [API] Error creating division:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Failed to create division: ' + error.message },
      { status: 500 }
    );
  }
}
