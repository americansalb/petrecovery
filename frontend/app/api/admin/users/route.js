// /api/admin/users/route.js
// Admin API for listing users (for coordinator dropdown)

import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import prisma from '@/app/lib/prisma';

export async function GET(request) {
  try {
    const session = await getSession();
    requireStaff(session, 'list users');

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const where = {};

    // Filter by role level (PATROL+ means PATROL, MODERATOR, ADMIN)
    if (role === 'PATROL') {
      where.role = { in: ['PATROL', 'MODERATOR', 'ADMIN'] };
    } else if (role === 'MODERATOR') {
      where.role = { in: ['MODERATOR', 'ADMIN'] };
    } else if (role === 'ADMIN') {
      where.role = 'ADMIN';
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: [
        { role: 'asc' },
        { firstName: 'asc' },
      ],
      take: 100,
    });

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Admin users fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
