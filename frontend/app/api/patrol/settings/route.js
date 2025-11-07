import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

// Validation schema for patrol settings update
const PatrolSettingsSchema = z.object({
  radiusMiles: z.number().min(1).max(50).optional(),
  alertMethod: z.enum(['EMAIL', 'SMS', 'PUSH', 'ALL']).optional(),
  instantAlerts: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  searchesDogs: z.boolean().optional(),
  searchesCats: z.boolean().optional(),
  searchesBirds: z.boolean().optional(),
  searchesOther: z.boolean().optional(),
});

// PATCH endpoint to update patrol settings
export async function PATCH(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = PatrolSettingsSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        patrolProfile: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.patrolProfile) {
      return NextResponse.json(
        { error: 'You are not a patrol member' },
        { status: 400 }
      );
    }

    // Update patrol profile
    const updatedProfile = await prisma.patrolProfile.update({
      where: { userId: user.id },
      data: validatedData,
    });

    return NextResponse.json({
      success: true,
      message: 'Patrol settings updated successfully',
      patrolProfile: {
        isActive: updatedProfile.isActive,
        isPaused: updatedProfile.isPaused,
        radiusMiles: updatedProfile.radiusMiles,
        alertMethod: updatedProfile.alertMethod,
        instantAlerts: updatedProfile.instantAlerts,
        searchesDogs: updatedProfile.searchesDogs,
        searchesCats: updatedProfile.searchesCats,
        searchesBirds: updatedProfile.searchesBirds,
        searchesOther: updatedProfile.searchesOther,
      }
    }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating patrol settings:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
