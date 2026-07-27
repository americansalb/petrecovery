/**
 * One animal, inside the portal. This is where a shelter actually works:
 * status, intake, legal hold, health record, and the adoption handoff, all
 * under portal chrome. Staff never get bounced out to the consumer pet
 * pages, which belong to people managing their own animals.
 *
 * The animal must belong to THIS shelter or the page 404s, so a roster id
 * from another shelter is not probeable.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/app/lib/prisma';
import { requirePortal } from '../../lib';
import AnimalWorkspace from './AnimalWorkspace';
import {
  INTAKE_TYPE_LABELS, strayHoldEndsAt, daysInCare,
} from '@/app/lib/shelterStatuses';
import { ArrowLeft, Radar, PawPrint } from 'lucide-react';

export const dynamic = 'force-dynamic';

const SPECIES_LABEL = { DOG: 'Dog', CAT: 'Cat', BIRD: 'Bird', RABBIT: 'Rabbit', OTHER: 'Pet' };
const SEX_LABEL = { MALE: 'Male', FEMALE: 'Female' };

export default async function PortalAnimal({ params }) {
  const { id } = await params;
  const { shelter } = await requirePortal();

  const pet = await prisma.pet.findFirst({
    where: { id, managedByShelterId: shelter.id, isDeleted: false },
    select: {
      id: true, name: true, species: true, breed: true, age: true, sex: true,
      color: true, size: true, primaryPhotoUrl: true, shelterStatus: true,
      intakeType: true, intakeDate: true, intakeFoundAddress: true, createdAt: true,
      medicalConditions: true, vetName: true, vetClinic: true, vetPhone: true,
      transfers: { where: { status: 'PENDING' }, select: { toEmail: true }, take: 1 },
    },
  });
  if (!pet) notFound();

  const [profile, pendingMatches] = await Promise.all([
    prisma.shelterProfile.findUnique({
      where: { shelterId: shelter.id },
      select: { strayHoldDays: true },
    }),
    prisma.shelterStrayMatch.count({
      where: { petId: pet.id, shelterId: shelter.id, status: 'PENDING' },
    }),
  ]);

  const holdEnd = strayHoldEndsAt(pet, profile?.strayHoldDays);
  const holdActive = holdEnd && holdEnd.getTime() > Date.now();
  const days = daysInCare(pet);

  const basics = [
    SPECIES_LABEL[pet.species] || 'Pet',
    pet.breed,
    pet.age != null ? `${pet.age} yr${pet.age === 1 ? '' : 's'}` : null,
    SEX_LABEL[pet.sex],
    pet.color,
  ].filter(Boolean).join(' · ');

  const intakeLine = [
    pet.intakeType ? INTAKE_TYPE_LABELS[pet.intakeType] || pet.intakeType : null,
    pet.intakeDate
      ? `taken in ${new Date(pet.intakeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : null,
    pet.intakeFoundAddress ? `found near ${pet.intakeFoundAddress}` : null,
    days === null ? null : days === 0 ? 'in care since today' : `${days} days in care`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6">
      <Link
        href="/my-shelter/animals"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-midnight-500 hover:text-midnight-900 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All animals
      </Link>

      {/* Identity */}
      <div className="flex items-start gap-4 flex-wrap">
        {pet.primaryPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.primaryPhotoUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
        ) : (
          <span className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <PawPrint className="w-7 h-7 text-midnight-300" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-black text-midnight-900">{pet.name}</h1>
          <p className="text-[15px] text-midnight-500 mt-0.5">{basics}</p>
          {intakeLine && <p className="text-[13px] text-midnight-400 mt-1">{intakeLine}</p>}
        </div>
      </div>

      {holdActive && (
        <p className="rounded-xl border border-midnight-100 border-l-4 border-l-amber-400 bg-white px-4 py-3 text-sm text-midnight-700">
          <span className="font-bold text-midnight-900">Legal stray hold until{' '}
            {holdEnd.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
          </span>{' '}
          The owner can still reclaim {pet.name}; adoption cannot be completed before then.
        </p>
      )}

      {pendingMatches > 0 && (
        <Link
          href="/my-shelter/matches"
          className="flex items-center gap-3 rounded-xl border border-midnight-100 border-l-4 border-l-flash-400 bg-white px-4 py-3 hover:bg-flash-50/50 transition"
        >
          <Radar className="w-4 h-4 text-midnight-500 shrink-0" />
          <p className="flex-1 min-w-0 text-sm text-midnight-700">
            <span className="font-bold text-midnight-900">
              {pendingMatches === 1 ? 'A lost-pet report may match ' : `${pendingMatches} lost-pet reports may match `}
              {pet.name}.
            </span>{' '}
            Nothing reaches the owner until you confirm.
          </p>
          <span className="text-[13px] font-bold text-midnight-900 shrink-0">Review</span>
        </Link>
      )}

      <AnimalWorkspace
        petId={pet.id}
        petName={pet.name}
        species={pet.species}
        petRecord={{
          name: pet.name,
          medicalConditions: pet.medicalConditions,
          vetName: pet.vetName,
          vetClinic: pet.vetClinic,
          vetPhone: pet.vetPhone,
        }}
        shelterStatus={pet.shelterStatus}
        pendingTransferEmail={pet.transfers[0]?.toEmail || null}
        holdActive={Boolean(holdActive)}
      />
    </div>
  );
}
