import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../lib/prisma';
import { isValidLocation } from '../../../lib/us-locations';

// POST /api/communities/request - Submit community creation request
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, geographicScope, parentCommunityId, notes } = body;

    // Validation
    if (!type || !geographicScope) {
      return NextResponse.json(
        { error: 'Type and geographic scope are required' },
        { status: 400 }
      );
    }

    // Validate location for metros and counties (not subcommunities)
    if (type !== 'SUBCOMMUNITY' && !isValidLocation(geographicScope)) {
      return NextResponse.json(
        { error: 'Invalid location. Please select a valid US metro area or county from the dropdown.' },
        { status: 400 }
      );
    }

    // Check if user's email or phone is verified
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true, phoneVerified: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.emailVerified && !user.phoneVerified) {
      return NextResponse.json(
        { error: 'Email or phone verification required to submit community requests' },
        { status: 403 }
      );
    }

    // Check rate limit: max 10 requests per rolling 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRequestsCount = await prisma.communityRequest.count({
      where: {
        requesterId: session.user.id,
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    if (recentRequestsCount >= 10) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 requests per 30 days.' },
        { status: 429 }
      );
    }

    // For subcommunities, verify parent exists
    if (type === 'SUBCOMMUNITY') {
      if (!parentCommunityId) {
        return NextResponse.json(
          { error: 'Parent community ID required for subcommunity requests' },
          { status: 400 }
        );
      }

      const parentExists = await prisma.community.findUnique({
        where: { id: parentCommunityId }
      });

      if (!parentExists) {
        return NextResponse.json(
          { error: 'Parent community not found' },
          { status: 404 }
        );
      }
    }

    // Check for duplicate communities with same geographic scope
    const existingCommunity = await prisma.community.findFirst({
      where: {
        geographicScope,
        isActive: true
      }
    });

    if (existingCommunity) {
      return NextResponse.json(
        {
          error: `A community already exists for ${geographicScope}. Please join "${existingCommunity.name}" instead of creating a duplicate.`,
          existingCommunityId: existingCommunity.id
        },
        { status: 409 }
      );
    }

    // Check for pending requests for the same location
    const existingRequest = await prisma.communityRequest.findFirst({
      where: {
        geographicScope,
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: `A request for ${geographicScope} is already pending approval. Please check back later.` },
        { status: 409 }
      );
    }

    // Create the request
    const communityRequest = await prisma.communityRequest.create({
      data: {
        requesterId: session.user.id,
        type,
        geographicScope,
        parentCommunityId,
        notes,
        status: 'PENDING'
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    console.log('✅ Community request created:', {
      id: communityRequest.id,
      type: communityRequest.type,
      geographicScope: communityRequest.geographicScope,
      status: communityRequest.status,
      requesterId: communityRequest.requesterId
    });

    // TODO: Send email notification to user confirming submission
    // TODO: Notify admins of new request

    return NextResponse.json({
      success: true,
      request: {
        id: communityRequest.id,
        type: communityRequest.type,
        geographicScope: communityRequest.geographicScope,
        status: communityRequest.status,
        createdAt: communityRequest.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating community request:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Failed to create community request',
        details: error.message
      },
      { status: 500 }
    );
  }
}
