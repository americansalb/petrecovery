import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/admin/divisions - Get ALL divisions from database
export async function GET(request) {
  try {
    console.log('🔍 [API] Get all divisions request');

    const session = await getServerSession(authOptions);
    console.log('👤 [API] Session user:', session?.user?.email, 'Role:', session?.user?.role);

    if (!session || session.user.role !== 'ADMIN') {
      console.error('❌ [API] Unauthorized - admin access required');
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log('💾 [API] Fetching all divisions from database...');
    const divisions = await prisma.division.findMany({
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true
          }
        },
        _count: {
          select: {
            members: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    console.log('✅ [API] Found', divisions.length, 'divisions');

    return NextResponse.json({
      divisions,
      total: divisions.length
    });
  } catch (error) {
    console.error('❌ [API] Error fetching divisions:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch divisions: ' + error.message },
      { status: 500 }
    );
  }
}
