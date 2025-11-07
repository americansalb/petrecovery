import { NextResponse } from 'next/server';
// Prisma import - uncomment after running: npx prisma generate
// import prisma from '../../../lib/prisma';
import { z } from 'zod';

// Validation schema for patrol signup
const PatrolSignupSchema = z.object({
  userId: z.string().min(1),
  zipCode: z.string().length(5),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMiles: z.number().min(1).max(25).default(5),
  notifications: z.object({
    text: z.boolean().default(true),
    email: z.boolean().default(true),
    push: z.boolean().default(true),
  }),
});

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = PatrolSignupSchema.parse(body);

    // TODO: After setting up Prisma (see SETUP.md):
    // 1. Check if user exists
    // 2. Check if already in patrol
    // 3. Create patrol profile
    // 4. Update user role
    // 5. Count nearby active reports

    // For now, return success with validation
    return NextResponse.json({
      success: true,
      message: 'Patrol signup validated successfully',
      note: 'Database not yet configured - see SETUP.md',
      validatedData: {
        zipCode: validatedData.zipCode,
        center: {
          lat: validatedData.centerLat,
          lng: validatedData.centerLng,
        },
        radiusMiles: validatedData.radiusMiles,
        notifications: validatedData.notifications,
      },
      nextSteps: [
        'Run: npx prisma generate',
        'Run: npx prisma migrate dev --name init',
        'Uncomment prisma import in this file',
        'Remove this placeholder response'
      ]
    }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in patrol signup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user is in patrol
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // TODO: After setting up Prisma, query the database
    return NextResponse.json({
      isPatrol: false,
      message: 'Database not yet configured - see SETUP.md'
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching patrol profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
