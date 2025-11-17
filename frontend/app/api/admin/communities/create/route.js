import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '../../../../lib/prisma';
import { isValidLocation } from '@/lib/us-locations';

// POST /api/admin/communities/create - Admin directly creates a community
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      type,
      geographicScope,
      zipCodes,
      parentCommunityId,
      centerLatitude,
      centerLongitude
    } = body;

    // Validation
    if (!name || !type || !geographicScope) {
      return NextResponse.json(
        { error: 'Name, type, and geographic scope are required' },
        { status: 400 }
      );
    }

    // Validate location for metros, counties, and cities (not subcommunities)
    if (type !== 'SUBCOMMUNITY' && !isValidLocation(geographicScope)) {
      return NextResponse.json(
        { error: 'Invalid location. Please select a valid US city, metro area, or county from the dropdown.' },
        { status: 400 }
      );
    }

    // For subcommunities, verify parent exists
    if (type === 'SUBCOMMUNITY') {
      if (!parentCommunityId) {
        return NextResponse.json(
          { error: 'Parent community required for subcommunities' },
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

    // Create the community
    const community = await prisma.community.create({
      data: {
        name,
        description: description || null,
        type,
        geographicScope,
        zipCodes: JSON.stringify(zipCodes || []),
        parentCommunityId: parentCommunityId || null,
        centerLatitude: centerLatitude || null,
        centerLongitude: centerLongitude || null,
        isActive: true,
        createdById: session.user.id,
        approvedById: session.user.id
      }
    });

    console.log('✅ Community created successfully:', {
      id: community.id,
      name: community.name,
      type: community.type,
      isActive: community.isActive
    });

    return NextResponse.json({
      success: true,
      community: {
        id: community.id,
        name: community.name,
        type: community.type,
        geographicScope: community.geographicScope
      }
    });

  } catch (error) {
    console.error('Error creating community:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Failed to create community',
        details: error.message
      },
      { status: 500 }
    );
  }
}
