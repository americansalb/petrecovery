/**
 * Animals: the roster. Every animal is a full Health Book record;
 * statuses edit inline; the adoption handoff lives on each row.
 */

import Link from 'next/link';
import prisma from '@/app/lib/prisma';
import { requirePortal } from '../lib';
import ShelterRoster from '@/app/shelter/ShelterRoster';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PortalAnimals() {
  const { shelter } = await requirePortal();

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-midnight-900">Animals</h1>
          <p className="text-midnight-500">
            {roster.length === 0
              ? 'Your roster is empty.'
              : `${roster.length} in your care, each with a full Health Book.`}
          </p>
        </div>
        <Link
          href={`/care/start?shelter=${shelter.id}`}
          className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2.5 rounded-xl transition"
        >
          <Plus className="w-4 h-4" /> Add animal
        </Link>
      </div>

      <ShelterRoster pets={roster} />

      <p className="text-sm text-midnight-500">
        Tap an animal for its Health Book: medications, vaccinations, weight tracking,
        and shareable care pages. When one is adopted, send the record home with the
        adopter; the complete medical history goes with it.
      </p>
    </div>
  );
}
