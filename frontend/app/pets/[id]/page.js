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
import { PawPrint, Pill, AlertTriangle, Radar, Users, ChevronRight } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, cn } from '@/components/ui';
import { slotsWithStatus, sameDay, formatTime } from '@/lib/medications';
import RescueReadiness from '@/app/components/pets/RescueReadiness';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { healthBookStatus } from '@/lib/healthBook';
import { usePet } from '@/app/components/care/PetProvider';

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
function IdRow({ label, isOwner, addHref, addLabel = 'Add', children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-midnight-500">{label}</dt>
      <dd className="font-semibold text-midnight-900 text-right min-w-0">
        {children || (
          isOwner ? (
            <Link href={addHref} className="inline-flex items-center gap-0.5 text-flash-600 hover:text-flash-700 font-bold text-xs">
              {addLabel} <ChevronRight size={12} />
            </Link>
          ) : (
            <span className="text-midnight-400 font-normal">Not noted</span>
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
        <Card className="max-w-md w-full p-8 text-center">
          <PawPrint className="w-12 h-12 text-midnight-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-midnight-900 mb-2">{petError || 'Pet not found'}</h1>
          <Button href="/pets" variant="primary">Back to My Pets</Button>
        </Card>
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
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-4xl mx-auto">
        {/* Missing? Nothing else matters until they're home. */}
        {activeCase && (
          <div className="rounded-3xl bg-midnight-950 border-2 border-red-500/60 p-5 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0">
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
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold rounded-2xl transition text-sm"
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

        {/* Today's care, one line */}
        <Link href={`/pets/${petId}/today`} className="block group mb-3">
          <Card padding="lg" className="group-hover:border-flash-400 border-2 border-transparent transition-colors">
            <div className="flex items-center gap-4">
              <Pill size={20} className="text-midnight-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-midnight-900">Today</p>
                <p className="text-sm text-midnight-500 truncate">
                  {today.medCount === 0 && today.careCount === 0
                    ? 'Nothing set up yet. Add meds or routines once, one tap forever.'
                    : [
                        today.due > 0 && `${today.given}/${today.due} doses given`,
                        today.careDue > 0 && `${today.careDone}/${today.careDue} routines done`,
                        today.careDue === 0 && today.careDone > 0 && `${today.careDone} happy ${today.careDone === 1 ? 'moment' : 'moments'} logged`,
                        today.nextSlot && `next: ${today.nextSlot.med.name} at ${formatTime(today.nextSlot.slot.time)}`,
                      ].filter(Boolean).join(' · ') || 'All clear today'}
                </p>
              </div>
              {today.due > 0 && (
                <span className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-bold shrink-0',
                  today.given >= today.due ? 'bg-emerald-100 text-emerald-700' : 'bg-flash-100 text-flash-800'
                )}>
                  {today.given >= today.due ? 'Done' : `${today.due - today.given} to go`}
                </span>
              )}
              <ChevronRight size={18} className="text-midnight-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </Card>
        </Link>

        {/* The Health Book, one line */}
        <Link href={`/pets/${petId}/health`} className="block group mb-3">
          <Card padding="lg" className="group-hover:border-flash-400 border-2 border-transparent transition-colors">
            <div className="flex items-center gap-4">
              <ShieldIcon size={20} className="text-midnight-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-midnight-900">Health Book</p>
                <p className="text-sm text-midnight-500 truncate">
                  {vaccinations === null
                    ? '...'
                    : healthBookStatus(vaccinations, pet.name).sentence}
                </p>
              </div>
              <ChevronRight size={18} className="text-midnight-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </Card>
        </Link>

        {/* The people, one line */}
        <Link href={`/pets/${petId}/share`} className="block group mb-6">
          <Card padding="lg" className="group-hover:border-flash-400 border-2 border-transparent transition-colors">
            <div className="flex items-center gap-4">
              <Users size={20} className="text-midnight-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-midnight-900">Care team</p>
                <p className="text-sm text-midnight-500 truncate">
                  {shares === null
                    ? (isOwner ? '...' : `You help care for ${pet.name}.`)
                    : shares.length === 0
                      ? `Just you so far. Invite family or share a view link.`
                      : shares.slice(0, 4).map((sh) => [sh.user?.firstName, sh.user?.lastName?.[0]].filter(Boolean).join(' ') || sh.email).join(', ')}
                </p>
              </div>
              <ChevronRight size={18} className="text-midnight-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </Card>
        </Link>

        {/* About: the facts a finder or searcher would need */}
        <Card padding="lg" className="mb-6">
          <h2 className="font-bold text-midnight-900 mb-4">About {pet.name}</h2>
          <dl className="space-y-3 text-sm">
            {traitLine && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-midnight-500">Looks</dt>
                <dd className="font-semibold text-midnight-900 text-right">{traitLine}</dd>
              </div>
            )}
            <IdRow label="Microchip" isOwner={isOwner} addHref={`/pets/${petId}/edit`}>
              {pet.microchipId && <span className="font-mono text-xs">{pet.microchipId}</span>}
            </IdRow>
            <IdRow label="Collar" isOwner={isOwner} addHref={`/pets/${petId}/edit`}>
              {pet.collarInfo}
            </IdRow>
            {/* Weight is a log, not a form field: it's read here, written in
                the Health Book's weight card (the one write path). */}
            <IdRow label="Weight" isOwner={access !== 'VIEWER'} addHref={`/pets/${petId}/health`} addLabel="Log">
              {pet.weight ? `${pet.weight} lbs` : null}
            </IdRow>
            {pet.distinctiveMarks && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-midnight-500 shrink-0">Marks</dt>
                <dd className="text-midnight-800 text-right">{pet.distinctiveMarks}</dd>
              </div>
            )}
            {pet.medicalConditions && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-midnight-500 shrink-0">Medical</dt>
                <dd className="text-midnight-800 text-right">{pet.medicalConditions}</dd>
              </div>
            )}
            {personality.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {personality.slice(0, 6).map((trait) => (
                  <span key={trait} className="px-2.5 py-1 rounded-full bg-flash-50 border border-flash-200 text-flash-800 text-xs font-semibold">
                    {trait}
                  </span>
                ))}
              </div>
            )}
          </dl>
        </Card>

        {/* Photos - only once there's more than the avatar already shows */}
        {uniquePhotos.length >= 2 && (
          <Card padding="lg" className="mb-6">
            <h2 className="font-bold text-midnight-900 mb-4">Photos</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {uniquePhotos.slice(0, 10).map((url) => (
                <div key={url} className="aspect-square rounded-xl overflow-hidden bg-midnight-100">
                  <img src={url} alt={pet.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
