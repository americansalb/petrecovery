import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// Force dynamic rendering since we use session/headers
export const dynamic = 'force-dynamic';

// GET /api/admin/rescue-forces - List all forces (admin only)
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const forces = await prisma.rescueForce.findMany({
      where: {
        isDeleted: false, // Don't show deleted forces
      },
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

    return NextResponse.json({ forces });
  } catch (error) {
    console.error('Error loading forces:', error);
    return NextResponse.json({ error: 'Failed to load forces' }, { status: 500 });
  }
}
