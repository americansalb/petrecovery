/**
 * GET /api/shelter/matches - pending stray-vs-lost matches for the
 * caller's claimed shelter, joined with the roster animal and a PII-free
 * slice of the lost case (coarse area, no owner contact info; the owner
 * is only contacted after the shelter confirms).
 *
 * Rows with a confident DIFFERENT vision verdict stay in the database
 * for audit but are left out of the default review list.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { coarseArea } from '@/app/lib/cascade/reverseMatch';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const profile = await prisma.shelterProfile.findFirst({
      where: { claimedById: session.user.id },
      select: { shelterId: true },
    });
    if (!profile) {
      return NextResponse.json({ error: 'You don\'t manage a shelter' }, { status: 403 });
    }

    const rows = await prisma.shelterStrayMatch.findMany({
      where: { shelterId: profile.shelterId, status: 'PENDING' },
      orderBy: [{ pTrueMatch: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        pet: {
          select: {
            id: true, name: true, species: true, breed: true,
            primaryPhotoUrl: true, intakeDate: true, intakeFoundAddress: true,
            isDeleted: true, managedByShelterId: true,
          },
        },
        case: {
          select: {
            id: true, caseNumber: true, status: true, petName: true,
            petSpecies: true, petBreed: true, petColor: true, petPhotoUrl: true,
            lastSeenAddress: true, lastSeenAt: true, createdAt: true,
            pet: { select: { primaryPhotoUrl: true } },
          },
        },
      },
    });

    const matches = rows
      // hide resolved/removed sides and confident photo mismatches
      .filter((r) => !r.pet.isDeleted && r.pet.managedByShelterId && r.case.status === 'ACTIVE')
      .filter((r) => !(r.visualVerdict === 'DIFFERENT' && (r.visualConfidence ?? 0) >= 0.8))
      .map((r) => ({
        id: r.id,
        pTrueMatch: r.pTrueMatch,
        band: r.band,
        matchSource: r.matchSource,
        visualVerdict: r.visualVerdict,
        visualConfidence: r.visualConfidence,
        createdAt: r.createdAt,
        pet: {
          id: r.pet.id,
          name: r.pet.name,
          species: r.pet.species,
          breed: r.pet.breed,
          photoUrl: r.pet.primaryPhotoUrl,
          intakeDate: r.pet.intakeDate,
          intakeFoundAddress: r.pet.intakeFoundAddress,
        },
        case: {
          caseNumber: r.case.caseNumber,
          petName: r.case.petName,
          species: r.case.petSpecies,
          breed: r.case.petBreed,
          color: r.case.petColor,
          photoUrl: r.case.pet?.primaryPhotoUrl || r.case.petPhotoUrl || '',
          coarseArea: coarseArea(r.case.lastSeenAddress, null),
          reportedAt: r.case.createdAt,
        },
      }));

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('[SHELTER-MATCHES] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load matches' }, { status: 500 });
  }
}
