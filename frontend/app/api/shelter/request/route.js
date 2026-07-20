/**
 * Shelter Request API
 *
 * POST /api/shelter/request - Submit a shelter account request
 * GET /api/shelter/request - Get current user's request status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/shelter/request
 * Submit a request for shelter account
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
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
      role, // Their role at the shelter
      howHeard, // How they heard about us
      existingShelterId, // wizard picked an unclaimed directory shelter
      latitude,
      longitude,
    } = body;

    // Validate required fields (contact email is optional; the wizard
    // collects it later on the public-page editor)
    if (!existingShelterId && (!shelterName || !city || !state)) {
      return NextResponse.json(
        { error: 'Shelter name, city, and state are required' },
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

    // Resolve the shelter: an explicit unclaimed directory pick, an
    // exact name+city+state match, or a brand new record.
    let shelter = null;
    if (existingShelterId) {
      shelter = await prisma.shelter.findUnique({ where: { id: existingShelterId } });
      if (!shelter) {
        return NextResponse.json({ error: 'That shelter no longer exists' }, { status: 400 });
      }
      const profile = await prisma.shelterProfile.findUnique({
        where: { shelterId: shelter.id },
        select: { claimedById: true },
      });
      if (profile?.claimedById) {
        return NextResponse.json(
          { error: 'That shelter is already managed on ReunitePets. Contact support@reunitepets.org if that seems wrong.' },
          { status: 409 }
        );
      }
    } else {
      shelter = await prisma.shelter.findFirst({
        where: {
          name: { equals: shelterName, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
          state: { equals: state, mode: 'insensitive' },
        }
      });
    }

    if (!shelter) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
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
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
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
    const session = await getServerSession(authOptions);
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
