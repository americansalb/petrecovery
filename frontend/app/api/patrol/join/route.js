import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { z } from 'zod';

// Validation schema for patrol signup
const PatrolSignupSchema = z.object({
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
    // Get session to identify the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = PatrolSignupSchema.parse(body);

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        patrolProfile: true,
        profile: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already in patrol
    if (user.patrolProfile) {
      return NextResponse.json(
        { error: 'You are already a patrol member' },
        { status: 400 }
      );
    }

    // Determine alert method based on preferences
    let alertMethod = 'EMAIL';
    if (validatedData.notifications.text && validatedData.notifications.email && validatedData.notifications.push) {
      alertMethod = 'ALL';
    } else if (validatedData.notifications.text) {
      alertMethod = 'SMS';
    } else if (validatedData.notifications.push) {
      alertMethod = 'PUSH';
    }

    // Create or update user profile with location
    if (user.profile) {
      await prisma.userProfile.update({
        where: { userId: user.id },
        data: {
          latitude: validatedData.centerLat,
          longitude: validatedData.centerLng,
          zip: validatedData.zipCode,
        }
      });
    } else {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          latitude: validatedData.centerLat,
          longitude: validatedData.centerLng,
          zip: validatedData.zipCode,
        }
      });
    }

    // Create patrol profile
    await prisma.patrolProfile.create({
      data: {
        userId: user.id,
        radiusMiles: validatedData.radiusMiles,
        alertMethod,
        isActive: true,
      }
    });

    // Count nearby active reports. The model is Case (Case = Mission =
    // lost-pet report); prisma.lostReport never existed, so this line 500ed
    // every signup after the profile writes had already committed.
    const activeReports = await prisma.case.findMany({
      where: {
        status: 'ACTIVE',
        reportType: 'LOST',
      },
      select: {
        lastSeenLatitude: true,
        lastSeenLongitude: true,
      }
    });

    // Filter by distance
    const nearbyReports = activeReports.filter(report => {
      const distance = calculateDistance(
        validatedData.centerLat,
        validatedData.centerLng,
        report.lastSeenLatitude,
        report.lastSeenLongitude
      );
      return distance <= validatedData.radiusMiles;
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully joined patrol',
      nearbyReports: nearbyReports.length,
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
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user is in patrol
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    return NextResponse.json({
      isPatrol: !!user.patrolProfile,
      isActive: user.patrolProfile?.isActive || false,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching patrol profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
