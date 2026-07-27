/**
 * /shelters - the shelter directory, map-first.
 *
 * The directory IS the first paint: every shelter we know about, pinned
 * and listed before the visitor types anything. (Its predecessor opened
 * with an empty search form and advice cards - a cold start that read as
 * "we have nothing".) Search narrows locally and reaches wider through
 * /api/shelters/search; it never gates. Share metadata lives in layout.js.
 */

import prisma from '@/app/lib/prisma';
import SheltersDirectoryClient from './SheltersDirectoryClient';

export const dynamic = 'force-dynamic';

async function getDirectory() {
  try {
    const shelters = await prisma.shelter.findMany({
      where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
      orderBy: [{ isVerified: 'desc' }, { name: 'asc' }],
      take: 400,
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        phone: true,
        website: true,
        latitude: true,
        longitude: true,
        isVerified: true,
      },
    });

    // Claimed shelters have a public page worth linking to.
    const claimed = await prisma.shelterProfile.findMany({
      where: { shelterId: { in: shelters.map((s) => s.id) }, claimedById: { not: null } },
      select: { shelterId: true },
    });
    const claimedIds = new Set(claimed.map((c) => c.shelterId));

    return shelters.map((s) => ({ ...s, hasPage: claimedIds.has(s.id) }));
  } catch (error) {
    console.error('[SHELTERS] directory load failed:', error);
    return []; // the page still renders; wider search still reaches the API
  }
}

export default async function SheltersPage() {
  const shelters = await getDirectory();
  return <SheltersDirectoryClient initialShelters={shelters} />;
}
