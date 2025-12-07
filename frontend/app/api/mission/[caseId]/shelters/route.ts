/**
 * Shelter Contacts API Routes
 *
 * GET /api/mission/[caseId]/shelters - List shelters with contact status
 * POST /api/mission/[caseId]/shelters - Add a shelter to track
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[caseId]/shelters
 *
 * List all tracked shelters for this case with their contact status
 *
 * Query params:
 * - status: Filter by status (NOT_CONTACTED, CONTACTED, etc.)
 * - type: Filter by type (SHELTER, VET, ANIMAL_CONTROL)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const typeFilter = searchParams.get('type');

    // Verify case exists
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Build query
    const where: any = { caseId };
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (typeFilter) {
      where.shelterType = typeFilter.toUpperCase();
    }

    // Get shelters with latest attempt
    const shelters = await prisma.shelterContact.findMany({
      where,
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // NOT_CONTACTED first
        { updatedAt: 'desc' },
      ],
    });

    // Format response
    const formattedShelters = shelters.map((shelter) => ({
      id: shelter.id,
      placeId: shelter.placeId,
      name: shelter.shelterName,
      address: shelter.shelterAddress,
      phone: shelter.shelterPhone,
      email: shelter.shelterEmail,
      type: shelter.shelterType,
      location: {
        lat: shelter.latitude,
        lng: shelter.longitude,
      },
      status: shelter.status,
      lastContactedAt: shelter.lastContactedAt,
      lastContactMethod: shelter.lastContactMethod,
      attemptCount: shelter._count.attempts,
      latestAttempt: shelter.attempts[0]
        ? {
            id: shelter.attempts[0].id,
            method: shelter.attempts[0].method,
            createdAt: shelter.attempts[0].createdAt,
            contactedBy: shelter.attempts[0].user,
            callOutcome: shelter.attempts[0].callOutcome,
            staffResponse: shelter.attempts[0].staffResponse,
          }
        : null,
      notes: shelter.notes,
    }));

    // Count by status
    const statusCounts = await prisma.shelterContact.groupBy({
      by: ['status'],
      where: { caseId },
      _count: true,
    });

    return NextResponse.json({
      shelters: formattedShelters,
      total: shelters.length,
      statusCounts: Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count])
      ),
    });
  } catch (error) {
    console.error('Shelters GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mission/[caseId]/shelters
 *
 * Add a shelter to track for this case
 *
 * Body: {
 *   placeId: string,
 *   name: string,
 *   address: string,
 *   phone?: string,
 *   email?: string,
 *   type: 'SHELTER' | 'VET' | 'ANIMAL_CONTROL',
 *   latitude: number,
 *   longitude: number,
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await params;
    const body = await request.json();

    const { placeId, name, address, phone, email, type, latitude, longitude } = body;

    // Validate required fields
    if (!placeId || !name || !address || !type || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: placeId, name, address, type, latitude, longitude' },
        { status: 400 }
      );
    }

    // Verify case exists
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check if shelter already exists for this case
    const existing = await prisma.shelterContact.findUnique({
      where: { caseId_placeId: { caseId, placeId } },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        shelter: existing,
        alreadyExists: true,
      });
    }

    // Create shelter contact
    const shelter = await prisma.shelterContact.create({
      data: {
        caseId,
        placeId,
        shelterName: name,
        shelterAddress: address,
        shelterPhone: phone,
        shelterEmail: email,
        shelterType: type,
        latitude,
        longitude,
        status: 'NOT_CONTACTED',
      },
    });

    return NextResponse.json({
      success: true,
      shelter,
      alreadyExists: false,
    });
  } catch (error) {
    console.error('Shelters POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
