import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '../../../../lib/prisma';

// GET /api/reports/:id/squads - Get all recovery squads for a report
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id: reportId } = params;

    // Get the report
    const report = await prisma.lostReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        petName: true,
        reporterId: true,
        status: true
      }
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Get all squads for this report
    const squads = await prisma.recoverySquad.findMany({
      where: {
        reportId: reportId
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        _count: {
          select: {
            members: true,
            searchAreas: true,
            petSpottings: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Check if user is the owner
    const isOwner = session?.user?.id === report.reporterId;

    // For each squad, check if user is a member
    let squadsWithMembership = squads;
    if (session?.user?.id) {
      squadsWithMembership = await Promise.all(
        squads.map(async (squad) => {
          const membership = await prisma.squadMember.findUnique({
            where: {
              squadId_userId: {
                squadId: squad.id,
                userId: session.user.id
              }
            },
            where: {
              leftAt: null
            }
          });

          return {
            ...squad,
            userMembership: membership ? {
              id: membership.id,
              role: membership.role,
              joinedAt: membership.joinedAt
            } : null
          };
        })
      );
    }

    return NextResponse.json({
      squads: squadsWithMembership.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        memberCount: s.memberCount,
        searchAreasMarked: s._count.searchAreas,
        spottingsReported: s._count.petSpottings,
        community: s.community,
        createdAt: s.createdAt,
        userMembership: s.userMembership || null
      })),
      isOwner,
      canCreateSquad: isOwner && report.status === 'ACTIVE'
    });

  } catch (error) {
    console.error('Error fetching squads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squads' },
      { status: 500 }
    );
  }
}
