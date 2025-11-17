import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../lib/prisma';
import { isValidLocation, isValidZipCode } from '@/lib/us-locations';
import { getZipCodeInfo } from '@/lib/zip-city-mapping';

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

    // ZIP CODE OVERLAP DETECTION
    // If user entered a ZIP code, check if it falls within an existing metro area
    // and suggest creating a subcommunity instead
    if (isValidZipCode(geographicScope)) {
      const zipInfo = getZipCodeInfo(geographicScope);

      if (zipInfo) {
        // This ZIP is in a tracked metro area
        console.log('📍 ZIP code overlap detection:', zipInfo);

        // Find if this metro area exists as a community
        const parentMetro = await prisma.community.findFirst({
          where: {
            geographicScope: zipInfo.metroValue,
            isActive: true,
            type: {
              in: ['METRO_AREA', 'CITY']
            }
          }
        });

        if (parentMetro) {
          // Metro exists! Now check if this specific city exists as a subcommunity
          const existingSubcommunity = await prisma.community.findFirst({
            where: {
              name: zipInfo.city,
              parentCommunityId: parentMetro.id,
              isActive: true
            }
          });

          if (!existingSubcommunity) {
            // Suggest creating this city as a subcommunity instead of a ZIP-based community
            return NextResponse.json({
              suggestion: {
                type: 'subcommunity',
                zipCode: zipInfo.zipCode,
                cityName: zipInfo.city,
                parentMetroName: parentMetro.name,
                parentMetroId: parentMetro.id,
                message: `This ZIP code (${zipInfo.zipCode}) is in ${zipInfo.city}, which is part of ${parentMetro.name}. Would you like to create "${zipInfo.city}" as a subcommunity of ${parentMetro.name} instead?`
              }
            }, { status: 200 });
          } else {
            // City already exists as subcommunity, suggest joining it
            return NextResponse.json({
              error: `${zipInfo.city} already exists as a subcommunity of ${parentMetro.name}. Please join "${existingSubcommunity.name}" instead.`,
              existingCommunityId: existingSubcommunity.id
            }, { status: 409 });
          }
        }
      }
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
