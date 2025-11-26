import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// Force dynamic rendering since this route uses headers (via getServerSession)
export const dynamic = 'force-dynamic';

// GET /api/admin/rescue-squads - List all squads (admin only)
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squads = await prisma.rescueSquad.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            members: true,
            caseAssignments: true,
          },
        },
      },
    });

    return NextResponse.json({ squads });
  } catch (error) {
    console.error('Error loading squads:', error);
    return NextResponse.json({ error: 'Failed to load squads' }, { status: 500 });
  }
}
