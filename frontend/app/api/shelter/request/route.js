/**
 * Shelter Request API
 *
 * POST /api/shelter/request - Submit a shelter account request
 * GET /api/shelter/request - Get current user's request status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/shelter/request
 * Submit a request for shelter account
 */
export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      shelterName,
      shelterType, // SHELTER, RESCUE, FOSTER_NETWORK
      address,
      city,
      state,
      zipCode,
      phone,
      email,
      website,
      about,
      role, // Their role at the shelter: OWNER, MANAGER, STAFF, VOLUNTEER
      howHeard, // How they heard about us
    } = body;

    // Validate required fields
    if (!shelterName || !city || !state || !email) {
      return NextResponse.json(
        { error: 'Shelter name, city, state, and email are required' },
        { status: 400 }
      );
    }

    // Check if user already has a pending request
    const existingRequest = await prisma.shelterClaim.findFirst({
      where: {
        claimantId: user.id,
        status: { in: ['PENDING', 'VERIFICATION_SENT', 'UNDER_REVIEW'] }
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending shelter request' },
        { status: 400 }
      );
    }

    // Check if user already manages a shelter
    const existingShelter = await prisma.shelterProfile.findFirst({
      where: { claimedById: user.id }
    });

    if (existingShelter) {
      return NextResponse.json(
        { error: 'You already manage a shelter' },
        { status: 400 }
      );
    }

    // Create or find the shelter
    let shelter = await prisma.shelter.findFirst({
      where: {
        name: { equals: shelterName, mode: 'insensitive' },
        city: { equals: city, mode: 'insensitive' },
        state: { equals: state, mode: 'insensitive' },
      }
    });

    if (!shelter) {
      // Create new shelter record
      shelter = await prisma.shelter.create({
        data: {
          name: shelterName,
          type: shelterType || 'SHELTER',
          address: address || '',
          city,
          state,
          zipCode: zipCode || '',
          phone,
          email,
          website,
          source: 'SHELTER_REQUEST',
          isActive: false, // Will be activated on approval
          isVerified: false,
        }
      });
    }

    // Create the claim request
    const claim = await prisma.shelterClaim.create({
      data: {
        shelterId: shelter.id,
        claimantId: user.id,
        verificationMethod: 'ADMIN_REVIEW',
        verificationData: JSON.stringify({
          role,
          howHeard,
          about,
          requestedAt: new Date().toISOString(),
        }),
        status: 'PENDING',
      }
    });

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        status: claim.status,
        shelterName: shelter.name,
      },
      message: 'Your request has been submitted. We will review it shortly.',
    });
  } catch (error) {
    console.error('Error submitting shelter request:', error);
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shelter/request
 * Get current user's shelter request status
 */
export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user manages a shelter
    const managedShelter = await prisma.shelterProfile.findFirst({
      where: { claimedById: user.id },
      include: {
        // We need to join with Shelter - but ShelterProfile uses shelterId as primary key
      }
    });

    if (managedShelter) {
      const shelter = await prisma.shelter.findUnique({
        where: { id: managedShelter.shelterId }
      });

      return NextResponse.json({
        success: true,
        status: 'APPROVED',
        shelter: {
          id: shelter?.id,
          name: shelter?.name,
        },
      });
    }

    // Check for pending request
    const pendingRequest = await prisma.shelterClaim.findFirst({
      where: {
        claimantId: user.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingRequest) {
      const shelter = await prisma.shelter.findUnique({
        where: { id: pendingRequest.shelterId }
      });

      return NextResponse.json({
        success: true,
        status: pendingRequest.status,
        claim: {
          id: pendingRequest.id,
          shelterName: shelter?.name,
          createdAt: pendingRequest.createdAt,
          reviewNotes: pendingRequest.reviewNotes,
        },
      });
    }

    return NextResponse.json({
      success: true,
      status: 'NONE',
    });
  } catch (error) {
    console.error('Error fetching shelter request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch request status' },
      { status: 500 }
    );
  }
}
