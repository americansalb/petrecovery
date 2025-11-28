import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/db';
import {
  activateDisasterMode,
  deactivateDisasterMode,
  getEmergencyDashboard,
  EMERGENCY_LEVELS,
  EMERGENCY_TYPES,
} from '@/app/lib/emergency/disasterMode';

/**
 * GET /api/emergency
 * Get active emergencies or specific emergency details
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const emergencyId = searchParams.get('id');
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));

    if (emergencyId) {
      // Get specific emergency dashboard
      const dashboard = await getEmergencyDashboard(prisma, emergencyId);

      if (!dashboard) {
        return NextResponse.json(
          { error: 'Emergency not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(dashboard);
    }

    // Get active emergencies
    const where = { isActive: true };

    // If location provided, filter by affected area
    if (!isNaN(lat) && !isNaN(lng)) {
      // In production, use proper geospatial queries
      // For now, return all active emergencies
    }

    const emergencies = await prisma.emergencyEvent.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      emergencies: emergencies.map(e => ({
        ...e,
        typeInfo: EMERGENCY_TYPES[e.type],
        affectedArea: e.affectedArea ? JSON.parse(e.affectedArea) : null,
        shelterLocations: e.shelterLocations ? JSON.parse(e.shelterLocations) : [],
        evacuationRoutes: e.evacuationRoutes ? JSON.parse(e.evacuationRoutes) : [],
      })),
      levels: EMERGENCY_LEVELS,
      types: EMERGENCY_TYPES,
    });
  } catch (error) {
    console.error('Emergency fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emergencies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/emergency
 * Activate or deactivate disaster mode
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin/emergency permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!['ADMIN', 'MODERATOR', 'EMERGENCY_COORDINATOR'].includes(user?.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to manage emergencies' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'activate') {
      const {
        type,
        level,
        name,
        description,
        affectedArea,
        estimatedEndTime,
        evacuationRoutes,
        shelterLocations,
      } = body;

      if (!type || !level || !name || !affectedArea) {
        return NextResponse.json(
          { error: 'Type, level, name, and affected area are required' },
          { status: 400 }
        );
      }

      const result = await activateDisasterMode(prisma, {
        type,
        level,
        name,
        description,
        affectedArea,
        estimatedEndTime: estimatedEndTime ? new Date(estimatedEndTime) : null,
        evacuationRoutes,
        shelterLocations,
        activatedById: session.user.id,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    if (action === 'deactivate') {
      const { emergencyId, closureNotes } = body;

      if (!emergencyId) {
        return NextResponse.json(
          { error: 'Emergency ID is required' },
          { status: 400 }
        );
      }

      const emergency = await deactivateDisasterMode(prisma, emergencyId, closureNotes);

      return NextResponse.json({
        success: true,
        emergency,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "activate" or "deactivate"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Emergency action error:', error);
    return NextResponse.json(
      { error: 'Failed to process emergency action' },
      { status: 500 }
    );
  }
}
