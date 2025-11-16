import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../lib/prisma';

// GET /api/squads/:id - Get squad details with members
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = params;

    // Get the squad with all related data
    const squad = await prisma.recoverySquad.findUnique({
      where: { id },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        report: {
          select: {
            id: true,
            petName: true,
            species: true,
            breed: true,
            color: true,
            lastSeenAddress: true,
            lastSeenLatitude: true,
            lastSeenLongitude: true,
            lastSeenDate: true,
            description: true,
            photoUrl: true,
            reporterId: true,
            reporter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true
              }
            }
          }
        },
        members: {
          where: {
            leftAt: null  // Only active members
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                rescueLevel: true
              }
            },
            subsquad: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [
            { role: 'asc' },  // OWNER, LEADER, MEMBER
            { joinedAt: 'asc' }
          ]
        },
        subsquads: {
          include: {
            community: {
              select: {
                id: true,
                name: true
              }
            },
            _count: {
              select: {
                members: true
              }
            }
          }
        },
        searchAreas: {
          orderBy: {
            markedAt: 'desc'
          },
          take: 10,
          include: {
            markedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        petSpottings: {
          orderBy: {
            reportedAt: 'desc'
          },
          take: 10,
          include: {
            reportedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!squad) {
      return NextResponse.json(
        { error: 'Squad not found' },
        { status: 404 }
      );
    }

    // Check if the user is a member (if logged in)
    let userMembership = null;
    let isCommunityMember = false;

    if (session?.user?.id) {
      userMembership = squad.members.find(m => m.userId === session.user.id);

      // Check if they're a member of the community
      const communityMembership = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: squad.communityId,
            userId: session.user.id
          }
        }
      });

      isCommunityMember = communityMembership?.status === 'APPROVED';
    }

    return NextResponse.json({
      squad: {
        id: squad.id,
        name: squad.name,
        status: squad.status,
        memberCount: squad.memberCount,
        searchAreasMarked: squad.searchAreasMarked,
        totalAcreageSearched: squad.totalAcreageSearched,
        createdAt: squad.createdAt,
        community: squad.community,
        report: squad.report,
        members: squad.members.map(m => ({
          id: m.id,
          userId: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          role: m.role,
          rescueLevel: m.user.rescueLevel,
          messagesSent: m.messagesSent,
          areasMarked: m.areasMarked,
          actionsCount: m.actionsCount,
          joinedAt: m.joinedAt,
          subsquad: m.subsquad
        })),
        subsquads: squad.subsquads.map(s => ({
          id: s.id,
          name: s.name,
          community: s.community,
          memberCount: s._count.members,
          createdAt: s.createdAt
        })),
        recentSearchAreas: squad.searchAreas,
        recentSpottings: squad.petSpottings,
        userMembership: userMembership ? {
          id: userMembership.id,
          role: userMembership.role,
          joinedAt: userMembership.joinedAt
        } : null,
        canJoin: session?.user?.id && !userMembership && isCommunityMember
      }
    });

  } catch (error) {
    console.error('Error fetching squad:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squad details' },
      { status: 500 }
    );
  }
}
