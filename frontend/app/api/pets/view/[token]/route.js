/**
 * Public pet care view (token holders, no account)
 *
 * GET /api/pets/view/[token]
 *
 * Read-only: the pet's identity, its owner's first name, and the
 * medication schedule with recent dose history, shaped exactly like
 * the authenticated tracker payload so the same client logic renders
 * both. No contact info, no ids beyond what rendering needs, and the
 * whole thing disappears the moment the owner disables the link.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { parseMedication } from '@/app/lib/medicationValidation';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const rate = withRateLimit(request, RateLimitPresets.PUBLIC_READ, 'pets:view');
  if (!rate.success) return rateLimitResponse(rate);

  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const pet = await prisma.pet.findFirst({
      where: { publicViewToken: token, isDeleted: false },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        color: true,
        primaryPhotoUrl: true,
        owner: { select: { firstName: true } },
      },
    });
    if (!pet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const since = new Date(Date.now() - 35 * 86400000);
    const medications = await prisma.petMedication.findMany({
      where: { petId: pet.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        doses: {
          where: { scheduledFor: { gte: since }, deletedAt: null },
          orderBy: { scheduledFor: 'desc' },
          take: 400,
        },
      },
    });

    return NextResponse.json({
      pet: {
        // The pet id is intentionally NOT exposed; requests go through the token
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        color: pet.color,
        primaryPhotoUrl: pet.primaryPhotoUrl,
      },
      ownerFirstName: pet.owner?.firstName || 'The owner',
      medications: medications.map(parseMedication),
    });
  } catch (error) {
    console.error('[PET VIEW] Failed:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
