import { NextResponse } from 'next/server';
// Prisma import - uncomment after running: npx prisma generate
// import prisma from '../../../lib/prisma';
import { z } from 'zod';

// Validation schema for patrol signup
const PatrolSignupSchema = z.object({
  userId: z.string().cuid(),
  radiusMiles: z.number().min(1).max(50).default(5),
  availability: z.array(z.enum([
    'weekday_morning',
    'weekday_afternoon',
    'weekday_evening',
    'weekend_morning',
    'weekend_afternoon',
    'weekend_evening'
  ])).min(1),
  transportation: z.array(z.enum(['foot', 'bike', 'car'])).min(1),
  searchesDogs: z.boolean().default(true),
  searchesCats: z.boolean().default(true),
  searchesBirds: z.boolean().default(false),
  searchesOther: z.boolean().default(false),
  alertMethod: z.enum(['EMAIL', 'SMS', 'PUSH', 'ALL']).default('EMAIL'),
  instantAlerts: z.boolean().default(true),
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
        radiusMiles: validatedData.radiusMiles,
        petTypes: {
          dogs: validatedData.searchesDogs,
          cats: validatedData.searchesCats,
          birds: validatedData.searchesBirds,
          other: validatedData.searchesOther,
        },
        availability: validatedData.availability,
        transportation: validatedData.transportation,
        alertMethod: validatedData.alertMethod,
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
