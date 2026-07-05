'use client';

/**
 * The Pet Profile Overview - STATE, and only state
 *
 * The glance: whether they're safe, rescue readiness, one line per
 * room (Today / Health Book / Care team), the About facts, photos.
 * The Overview owns nothing (PET_PROFILE_DESIGN.md §3): every card is
 * a summary that links into its room — dose history lives in Today's
 * week strip, the record's history lives in the Health Book.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PawPrint, AlertTriangle, Radar, ChevronRight } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { slotsWithStatus, sameDay, formatTime } from '@/lib/medications';
import RescueReadiness from '@/app/components/pets/RescueReadiness';
import { healthBookStatus } from '@/lib/healthBook';
import { usePet } from '@/app/components/care/PetProvider';
import {
  Sheet, SectionInk, RuledList, RuledRow, Polaroid, StampText,
} from '@/app/components/care/paper/Paper';

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const arr = JSON.parse(value || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function activeCaseOf(pet) {
  const c = pet?.cases?.[0];
  if (!c) return null;
  if (['REUNITED', 'CLOSED_OTHER', 'RESOLVED'].includes(c.status)) return null;
  return c;
}

/* A profile fact row: shows the value when known, a one-tap "Add" when not -
   an empty record should read as an invitation, never as dead text. */
function IdRow({ label, isOwner, addHref, addLabel = 'add', children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-pen-900/[0.14] last:border-b-0 text-sm">
      <dt className="font-stamp text-[9px] uppercase tracking-[0.16em] text-pen-400">{label}</dt>
      <dd className="font-semibold text-pen-900 text-right min-w-0">
        {children || (
          isOwner ? (
            <Link href={addHref} className="inline-flex items-center gap-0.5 font-stamp text-[9.5px] uppercase tracking-[0.1em] text-stampred hover:text-stampred-dark">
              {addLabel} <ChevronRight size={11} />
            </Link>
          ) : (
            <span className="font-diary italic text-pen-300 font-normal">not noted</span>
          )
        )}
      </dd>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function PetProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;
  const { pet, access, loading: petLoading, error: petError } = usePet();

  const [meds, setMeds] = useState([]);
  const [shares, setShares] = useState(null); // null = not loaded / not owner
  const [viewLinkUrl, setViewLinkUrl] = useState(null);
  const [vaccinations, setVaccinations] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}`);
    }
  }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const medsRes = await fetch(`/api/pets/${petId}/medications`);
      if (medsRes.ok) {
        const medsData = await medsRes.json();
        setMeds(medsData.medications || []);
      }
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) load();
  }, [status, petId, load]);

  // Care team is owner territory; load it quietly and tolerate a 403
  useEffect(() => {
    if (status !== 'authenticated' || !petId) return;
    fetch(`/api/pets/${petId}/shares`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.shares) setShares(data.shares); })
      .catch(() => {});
    fetch(`/api/pets/${petId}/share-link`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.url) setViewLinkUrl(data.url); })
      .catch(() => {});
    fetch(`/api/pets/${petId}/vaccinations`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.vaccinations) setVaccinations(data.vaccinations); })
      .catch(() => {});
  }, [status, petId]);

  // Today's care, computed from the same engine as the tracker
  const today = useMemo(() => {
    const now = new Date();
    const medItems = meds.filter((m) => m.kind !== 'CARE' && m.isActive);
    const careItems = meds.filter((m) => m.kind === 'CARE' && m.isActive);

    let due = 0;
    let given = 0;
    let nextSlot = null;
    for (const med of medItems.filter((m) => m.scheduleType !== 'AS_NEEDED')) {
      for (const slot of slotsWithStatus(med, med.doses, now)) {
        due += 1;
        if (slot.status === 'GIVEN') given += 1;
        else if (!slot.status && !nextSlot) nextSlot = { med, slot };
      }
    }

    let careDue = 0;
    let careDone = 0;
    for (const care of careItems.filter((c) => c.scheduleType !== 'AS_NEEDED')) {
      for (const slot of slotsWithStatus(care, care.doses, now)) {
        careDue += 1;
        if (slot.status === 'GIVEN') careDone += 1;
      }
    }
    for (const care of careItems.filter((c) => c.scheduleType === 'AS_NEEDED')) {
      careDone += (care.doses || []).filter(
        (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), now)
      ).length;
    }

    return { due, given, nextSlot, careDue, careDone, medCount: medItems.length, careCount: careItems.length };
  }, [meds]);

  if (status === 'loading' || petLoading || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Loading profile..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  if (petError || !pet) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <Sheet className="max-w-md w-full p-8 text-center">
          <PawPrint className="w-10 h-10 text-pen-300 mx-auto mb-4" />
          <h1 className="font-diary italic text-[19px] text-pen-900 mb-3">{petError || 'Pet not found'}</h1>
          <Link href="/pets" className="inline-block font-stamp text-[10px] uppercase tracking-[0.12em] border-[1.5px] border-pen-900 text-pen-900 rounded-[4px] px-3.5 py-2 hover:bg-pen-900 hover:text-paper-50 transition-colors">
            Back to My Pets
          </Link>
        </Sheet>
      </div>
    );
  }

  const isOwner = access === 'OWNER';
  const activeCase = activeCaseOf(pet);
  const photos = parseJsonArray(pet.photos);
  const personality = parseJsonArray(pet.personality);
  const uniquePhotos = [...new Set([pet.primaryPhotoUrl, ...photos].filter(Boolean))];
  const traitLine = [
    pet.color,
    pet.size && pet.size.charAt(0) + pet.size.slice(1).toLowerCase(),
    pet.sex && pet.sex.charAt(0) + pet.sex.slice(1).toLowerCase(),
  ].filter(Boolean).join(' · ');

  return (
    <div className="px-4 py-5 md:px-8 md:py-6">
      <div className="max-w-4xl mx-auto">
        {/* Missing? Nothing else matters until they're home. The rescue
            world's dark telegram lands ON the paper — the one place the
            midnight register is allowed into the book. */}
        {activeCase && (
          <div className="rounded-[6px] bg-midnight-950 border-2 border-red-500/60 p-5 mb-5 shadow-[0_10px_24px_-12px_rgba(35,42,61,0.5)]">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="w-11 h-11 rounded-[6px] bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-red-400" />
              </span>
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-white">{pet.name} is missing</p>
                <p className="text-sm text-midnight-300">
                  Case {activeCase.caseNumber} is live. The search is on.
                </p>
              </div>
              <Link
                href={`/mission-control?mission=${activeCase.caseNumber}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold rounded-[6px] transition text-sm"
              >
                <Radar size={16} />
                Mission Control
              </Link>
            </div>
          </div>
        )}

        {/* The profile's spine: how ready is this record for the worst day? */}
        {!activeCase && (
          <RescueReadiness
            pet={pet}
            photos={uniquePhotos}
            personality={personality}
            shares={shares}
            viewLinkUrl={viewLinkUrl}
            isOwner={isOwner}
          />
        )}

        {/* The table of contents: one written line per room */}
        <Sheet perforated className="mb-5">
          <SectionInk>in this book</SectionInk>
          <RuledList>
            <Link href={`/pets/${petId}/today`} className="block group">
              <RuledRow>
                <span className="font-diary italic text-[16px] text-pen-900 w-28 shrink-0">Today</span>
                <span className="flex-1 min-w-0 font-diary italic text-[12.5px] text-pen-400 truncate">
                  {today.medCount === 0 && today.careCount === 0
                    ? 'nothing set up yet — add meds or routines once, one tap forever'
                    : [
                        today.due > 0 && `${today.given}/${today.due} doses given`,
                        today.careDue > 0 && `${today.careDone}/${today.careDue} routines done`,
                        today.careDue === 0 && today.careDone > 0 && `${today.careDone} happy ${today.careDone === 1 ? 'moment' : 'moments'} logged`,
                        today.nextSlot && `next: ${today.nextSlot.med.name} at ${formatTime(today.nextSlot.slot.time)}`,
                      ].filter(Boolean).join(' · ') || 'all clear today'}
                </span>
                {today.due > 0 && (
                  <StampText tone={today.given >= today.due ? 'green' : 'red'} rotate={-4} size="sm">
                    {today.given >= today.due ? 'Done' : `${today.due - today.given} to go`}
                  </StampText>
                )}
                <ChevronRight size={15} className="text-pen-300 group-hover:translate-x-0.5 group-hover:text-pen-600 transition-all shrink-0" />
              </RuledRow>
            </Link>

            <Link href={`/pets/${petId}/health`} className="block group">
              <RuledRow>
                <span className="font-diary italic text-[16px] text-pen-900 w-28 shrink-0">Health Book</span>
                <span className="flex-1 min-w-0 font-diary italic text-[12.5px] text-pen-400 truncate">
                  {vaccinations === null
                    ? '…'
                    : healthBookStatus(vaccinations, pet.name).sentence.toLowerCase()}
                </span>
                <ChevronRight size={15} className="text-pen-300 group-hover:translate-x-0.5 group-hover:text-pen-600 transition-all shrink-0" />
              </RuledRow>
            </Link>

            <Link href={`/pets/${petId}/share`} className="block group">
              <RuledRow>
                <span className="font-diary italic text-[16px] text-pen-900 w-28 shrink-0">Care team</span>
                <span className="flex-1 min-w-0 font-diary italic text-[12.5px] text-pen-400 truncate">
                  {shares === null
                    ? (isOwner ? '…' : `you help care for ${pet.name}.`)
                    : shares.length === 0
                      ? 'just you so far — invite family or share a view link'
                      : shares.slice(0, 4).map((sh) => [sh.user?.firstName, sh.user?.lastName?.[0]].filter(Boolean).join(' ') || sh.email).join(', ')}
                </span>
                <ChevronRight size={15} className="text-pen-300 group-hover:translate-x-0.5 group-hover:text-pen-600 transition-all shrink-0" />
              </RuledRow>
            </Link>
          </RuledList>
        </Sheet>

        {/* About: the facts a finder or searcher would need */}
        <Sheet className="mb-5">
          <SectionInk>about {pet.name}</SectionInk>
          <dl>
            {traitLine && (
              <div className="flex items-center justify-between gap-3 py-2 border-b border-pen-900/[0.14] text-sm">
                <dt className="font-stamp text-[9px] uppercase tracking-[0.16em] text-pen-400">Looks</dt>
                <dd className="font-semibold text-pen-900 text-right">{traitLine}</dd>
              </div>
            )}
            <IdRow label="Microchip" isOwner={isOwner} addHref={`/pets/${petId}/edit`}>
              {pet.microchipId && <span className="font-stamp text-[11px]">{pet.microchipId}</span>}
            </IdRow>
            <IdRow label="Collar" isOwner={isOwner} addHref={`/pets/${petId}/edit`}>
              {pet.collarInfo}
            </IdRow>
            {/* Weight is a log, not a form field: it's read here, written in
                the Health Book's weight card (the one write path). */}
            <IdRow label="Weight" isOwner={access !== 'VIEWER'} addHref={`/pets/${petId}/health`} addLabel="log">
              {pet.weight ? `${pet.weight} lbs` : null}
            </IdRow>
            {pet.distinctiveMarks && (
              <div className="flex items-start justify-between gap-3 py-2 border-b border-pen-900/[0.14] text-sm">
                <dt className="font-stamp text-[9px] uppercase tracking-[0.16em] text-pen-400 shrink-0 pt-0.5">Marks</dt>
                <dd className="text-pen-600 text-right">{pet.distinctiveMarks}</dd>
              </div>
            )}
            {pet.medicalConditions && (
              <div className="flex items-start justify-between gap-3 py-2 border-b border-pen-900/[0.14] text-sm">
                <dt className="font-stamp text-[9px] uppercase tracking-[0.16em] text-stampred shrink-0 pt-0.5">Medical</dt>
                <dd className="text-pen-600 text-right">{pet.medicalConditions}</dd>
              </div>
            )}
            {personality.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-3">
                {personality.slice(0, 6).map((trait) => (
                  <span key={trait} className="font-stamp text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-full border-[1.5px] border-pen-300 text-pen-600">
                    {trait}
                  </span>
                ))}
              </div>
            )}
          </dl>
        </Sheet>

        {/* Photos - taped in, only once there's more than the cover shows */}
        {uniquePhotos.length >= 2 && (
          <Sheet className="mb-5">
            <SectionInk>photos</SectionInk>
            <div className="flex flex-wrap gap-5 pt-2 pl-1">
              {uniquePhotos.slice(0, 10).map((url, i) => (
                <Polaroid key={url} src={url} alt={pet.name} size="lg" rotate={i % 3 === 0 ? -3 : i % 3 === 1 ? 2 : -1} />
              ))}
            </div>
          </Sheet>
        )}
      </div>
    </div>
  );
}
