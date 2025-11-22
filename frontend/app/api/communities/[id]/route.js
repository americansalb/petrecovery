import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/communities/:id - Get community details
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = params;

    console.log('🔍 Fetching community with ID:', id);

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        parentCommunity: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        subcommunities: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            type: true,
            _count: {
              select: {
                members: {
                  where: { status: 'APPROVED' }
                },
                recoverySquads: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        },
        members: {
          where: {
            status: 'APPROVED',
            role: 'MODERATOR'
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                rescueLevel: true
              }
            }
          },
          take: 10
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rescueLevel: true
          }
        },
        _count: {
          select: {
            members: {
              where: { status: 'APPROVED' }
            },
            recoverySquads: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    if (!community) {
      console.log('❌ Community not found with ID:', id);
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    console.log('✅ Community found:', {
      id: community.id,
      name: community.name,
      type: community.type,
      isActive: community.isActive
    });

    // Get user's membership if logged in
    let userMembership = null;
    if (session?.user?.id) {
      userMembership = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: id,
            userId: session.user.id
          }
        },
        select: {
          status: true,
          role: true,
          isFounder: true,
          approvedAt: true
        }
      });
    }

    // Get founder
    const founder = await prisma.communityMember.findFirst({
      where: {
        communityId: id,
        isFounder: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rescueLevel: true
          }
        }
      }
    });

    // Format subcommunities
    const subcommunities = community.subcommunities.map(sub => ({
      ...sub,
      memberCount: sub._count.members,
      activeSquadsCount: sub._count.recoverySquads
    }));

    const response = {
      ...community,
      memberCount: community._count.members,
      activeSquadsCount: community._count.recoverySquads,
      subcommunities,
      moderators: community.members.map(m => ({
        ...m.user,
        role: m.role
      })),
      founder: founder ? founder.user : null,
      userMembership
    };

    // Remove _count
    delete response._count;
    delete response.members;

    return NextResponse.json({ community: response });

  } catch (error) {
    console.error('Error fetching community:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community' },
      { status: 500 }
    );
  }
}
