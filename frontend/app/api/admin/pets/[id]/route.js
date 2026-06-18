/**
 * Admin Pet Detail API
 *
 * GET /api/admin/pets/[id] - the full record for ONE pet, read-only, admin
 * only. Lives here (not behind requirePetAccess) so admin visibility into any
 * user's pet stays inside the admin boundary instead of widening the
 * owner-only guards on the user-facing pet routes.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const pet = await prisma.pet.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        vaccinations: { where: { deletedAt: null }, orderBy: { administeredAt: 'desc' } },
        weightEntries: { where: { deletedAt: null }, orderBy: { recordedAt: 'asc' } },
        medications: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            doses: { where: { deletedAt: null }, orderBy: { scheduledFor: 'desc' }, take: 20 },
          },
        },
        shares: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        cases: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, caseNumber: true, status: true, createdAt: true },
        },
      },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    return NextResponse.json({
      pet: {
        ...pet,
        photos: JSON.parse(pet.photos || '[]'),
        personality: JSON.parse(pet.personality || '[]'),
      },
    });
  } catch (error) {
    console.error('[ADMIN PET DETAIL] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch pet' }, { status: 500 });
  }
}
