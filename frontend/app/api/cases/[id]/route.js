import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const caseId = params.id;

    // Fetch case with all related data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        assignments: {
          include: {
            rescueSquad: {
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                members: {
                  where: { isActive: true },
                  select: {
                    userId: true,
                    role: true
                  }
                }
              }
            },
            participants: {
              where: { isActive: true },
              select: {
                userId: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            _count: {
              select: {
                participants: true,
                petSpottings: true,
                searchAreas: true
              }
            }
          }
        },
        sightings: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json({ case: caseData });

  } catch (error) {
    console.error('Error fetching case:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
      { status: 500 }
    );
  }
}
