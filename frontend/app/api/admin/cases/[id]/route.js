// /api/admin/cases/[id]/route.js
// Admin API for getting case details

import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'view case details');

    const { id } = params;

    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        coordinator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        primarySquad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        sightings: {
          orderBy: { sightedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(caseData);
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Admin case fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}
