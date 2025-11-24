import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/communities/:id/members - Get community members
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);

    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where = {
      communityId: id,
      status: 'APPROVED'
    };

    // Filter by role
    if (role && ['MEMBER', 'MODERATOR'].includes(role)) {
      where.role = role;
    }

    // Search by user name
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } }
        ]
      };
    }

    const [members, total] = await Promise.all([
      prisma.communityMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              rescueLevel: true,
              honorsReceived: true,
              successfulReunions: true
            }
          }
        },
        orderBy: [
          { role: 'desc' }, // Moderators first
          { isFounder: 'desc' }, // Then founders
          { createdAt: 'asc' } // Then by join date
        ],
        skip,
        take: limit
      }),
      prisma.communityMember.count({ where })
    ]);

    const formattedMembers = members.map(member => ({
      id: member.id,
      user: member.user,
      role: member.role,
      isFounder: member.isFounder,
      joinedAt: member.createdAt
    }));

    return NextResponse.json({
      members: formattedMembers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching community members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community members' },
      { status: 500 }
    );
  }
}
