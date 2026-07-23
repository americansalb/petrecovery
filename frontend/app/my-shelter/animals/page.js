/**
 * Animals: the roster as a working table. Every animal is a full Health
 * Book record; statuses edit inline; the adoption handoff lives on each
 * row. The digest under the title is the census a director would ask for.
 */

import Link from 'next/link';
import prisma from '@/app/lib/prisma';
import { requirePortal } from '../lib';
import ShelterRoster from '@/app/shelter/ShelterRoster';
import StrayHoldControl from '@/app/shelter/StrayHoldControl';
import { SHELTER_STATUSES, SHELTER_STATUS_LABELS } from '@/app/lib/shelterStatuses';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PortalAnimals() {
  const { shelter } = await requirePortal();

  const profile = await prisma.shelterProfile.findUnique({
    where: { shelterId: shelter.id },
    select: { strayHoldDays: true },
  });

  const pets = await prisma.pet.findMany({
    where: { managedByShelterId: shelter.id, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      primaryPhotoUrl: true,
      shelterStatus: true,
      intakeType: true,
      intakeDate: true,
      intakeFoundAddress: true,
      transfers: { where: { status: 'PENDING' }, select: { toEmail: true }, take: 1 },
    },
  });

  const roster = pets.map((p) => ({
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed,
    primaryPhotoUrl: p.primaryPhotoUrl,
    shelterStatus: p.shelterStatus,
    intakeType: p.intakeType,
    intakeDate: p.intakeDate ? p.intakeDate.toISOString() : null,
    intakeFoundAddress: p.intakeFoundAddress,
    pendingTransferEmail: p.transfers[0]?.toEmail || null,
  }));

  const counts = roster.reduce((acc, p) => {
    if (p.shelterStatus) acc[p.shelterStatus] = (acc[p.shelterStatus] || 0) + 1;
    return acc;
  }, {});
  const digest = [`${roster.length} ${roster.length === 1 ? 'animal' : 'animals'} in care`];
  for (const s of SHELTER_STATUSES) {
    if (counts[s]) digest.push(`${counts[s]} ${SHELTER_STATUS_LABELS[s].toLowerCase()}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] leading-tight font-black text-midnight-900">Animals</h1>
          <p className="text-[15px] text-midnight-500 mt-1">
            {roster.length === 0 ? 'Your roster is empty.' : digest.join(' · ')}
          </p>
          <div className="mt-1.5">
            <StrayHoldControl holdDays={profile?.strayHoldDays || null} />
          </div>
        </div>
        <Link
          href={`/care/start?shelter=${shelter.id}`}
          className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2.5 rounded-xl transition"
        >
          <Plus className="w-4 h-4" /> Add animal
        </Link>
      </div>

      <ShelterRoster pets={roster} holdDays={profile?.strayHoldDays || null} />

      <p className="text-[12px] leading-relaxed text-midnight-400">
        Every animal here carries a full Health Book: medications, vaccinations,
        weight history. Send it home with the adopter and the record goes with it.
      </p>
    </div>
  );
}
