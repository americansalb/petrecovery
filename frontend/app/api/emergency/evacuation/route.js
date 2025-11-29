import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/db';
import {
  registerEvacuation,
  updateEvacuationStatus,
  findReunificationOpportunities,
} from '@/app/lib/emergency/disasterMode';

/**
 * GET /api/emergency/evacuation
 * Get evacuation records for an emergency or pet
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const emergencyId = searchParams.get('emergencyId');
    const petId = searchParams.get('petId');
    const status = searchParams.get('status');

    const where = {};

    if (emergencyId) {
      where.emergencyEventId = emergencyId;
    }

    if (petId) {
      where.petId = petId;
    }

    if (status) {
      where.status = status;
    }

    const evacuations = await prisma.petEvacuation.findMany({
      where,
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            primaryPhotoUrl: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        emergencyEvent: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      evacuations: evacuations.map(e => ({
        ...e,
        evacuationLocation: e.evacuationLocation ? JSON.parse(e.evacuationLocation) : null,
        currentLocation: e.currentLocation ? JSON.parse(e.currentLocation) : null,
      })),
      count: evacuations.length,
    });
  } catch (error) {
    console.error('Evacuation fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evacuations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/emergency/evacuation
 * Register or update pet evacuation
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'register') {
      const {
        emergencyEventId,
        petId,
        evacuationLocation,
        currentLocation,
        status,
        notes,
        transportMethod,
        contactInfo,
      } = body;

      if (!emergencyEventId || !petId) {
        return NextResponse.json(
          { error: 'Emergency event ID and pet ID are required' },
          { status: 400 }
        );
      }

      const evacuation = await registerEvacuation(prisma, {
        emergencyEventId,
        petId,
        ownerId: session.user.id,
        evacuationLocation,
        currentLocation,
        status: status || 'WITH_OWNER',
        notes,
        transportMethod,
        contactInfo,
      });

      return NextResponse.json({
        success: true,
        evacuation,
      });
    }

    if (action === 'update') {
      const { evacuationId, status, currentLocation, notes } = body;

      if (!evacuationId) {
        return NextResponse.json(
          { error: 'Evacuation ID is required' },
          { status: 400 }
        );
      }

      const evacuation = await updateEvacuationStatus(prisma, evacuationId, {
        status,
        currentLocation,
        notes,
      });

      return NextResponse.json({
        success: true,
        evacuation,
      });
    }

    if (action === 'find-matches') {
      const { emergencyEventId } = body;

      if (!emergencyEventId) {
        return NextResponse.json(
          { error: 'Emergency event ID is required' },
          { status: 400 }
        );
      }

      const matches = await findReunificationOpportunities(prisma, emergencyEventId);

      return NextResponse.json({
        success: true,
        matches,
        count: matches.length,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "register", "update", or "find-matches"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Evacuation action error:', error);
    return NextResponse.json(
      { error: 'Failed to process evacuation action' },
      { status: 500 }
    );
  }
}
