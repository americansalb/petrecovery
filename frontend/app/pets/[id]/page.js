'use client';

/**
 * The Pet Profile - one home per pet
 *
 * Everything about this pet, one screen: who they are, whether they're
 * safe, today's care at a glance, the people who care for them, their
 * photos, their history. The avatar strip up top jumps between all of
 * your pets, so the whole family is one tap apart. Editing moved to
 * /pets/[id]/edit; this page is for living, not form-filling.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, PawPrint, Pencil, Share2, Pill, AlertTriangle, Radar,
  MapPin, Heart, Users, Plus, Loader2, ShieldCheck, Fingerprint,
  Tag, Scale, Cake, Camera, History, ChevronRight, Check,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, Badge, cn } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import { slotsWithStatus, sameDay, careEmoji, formatTime } from '@/lib/medications';

const SPECIES_EMOJI = { DOG: '🐕', CAT: '🐈', BIRD: '🦜', RABBIT: '🐇', OTHER: '🐾' };

function parseJsonArray(value) {
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

/* ----------------------------- The pet switcher --------------------------- */

function PetSwitcher({ pets, currentId }) {
  if (!pets || pets.length < 1) return null;
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-1 px-1 mb-5">
      {pets.map((p) => {
        const current = p.id === currentId;
        return (
          <Link
            key={p.id}
            href={`/pets/${p.id}`}
            className="flex flex-col items-center gap-1 shrink-0 group"
            aria-current={current ? 'page' : undefined}
          >
            <span
              className={cn(
                'w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl bg-midnight-100 transition-all',
                current
                  ? 'ring-[3px] ring-flash-400 ring-offset-2 ring-offset-midnight-50'
                  : 'ring-1 ring-midnight-200 opacity-75 group-hover:opacity-100'
              )}
            >
              {p.primaryPhotoUrl ? (
                <img src={p.primaryPhotoUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                SPECIES_EMOJI[p.species] || '🐾'
              )}
            </span>
            <span className={cn('text-[11px] font-semibold', current ? 'text-midnight-900' : 'text-midnight-400')}>
              {p.name}
            </span>
          </Link>
        );
      })}
      <Link href="/pets/new" className="flex flex-col items-center gap-1 shrink-0 group" aria-label="Add a pet">
        <span className="w-14 h-14 rounded-full border-2 border-dashed border-midnight-300 flex items-center justify-center text-midnight-400 group-hover:border-flash-400 group-hover:text-flash-500 transition-colors">
          <Plus size={20} />
        </span>
        <span className="text-[11px] font-semibold text-midnight-400">Add</span>
      </Link>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function PetProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [allPets, setAllPets] = useState([]);
  const [meds, setMeds] = useState([]);
  const [access, setAccess] = useState('OWNER');
  const [shares, setShares] = useState(null); // null = not loaded / not owner
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}`);
    }
  }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const [petRes, medsRes, petsRes] = await Promise.all([
        fetch(`/api/pets/${petId}`),
        fetch(`/api/pets/${petId}/medications`),
        fetch('/api/pets'),
      ]);
      const petData = await petRes.json();
      if (!petRes.ok) throw new Error(petData.error || 'Pet not found');
      setPet(petData.pet || petData);

      if (medsRes.ok) {
        const medsData = await medsRes.json();
        setMeds(medsData.medications || []);
        setAccess(medsData.access || 'OWNER');
      }
      if (petsRes.ok) {
        const petsData = await petsRes.json();
        setAllPets(petsData.pets || []);
      }
    } catch (err) {
      setError(err.message);
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

  const recent = useMemo(() => {
    const out = [];
    for (const med of meds) {
      for (const dose of med.doses || []) {
        if (dose.deletedAt) continue;
        out.push({ med, dose, at: new Date(dose.givenAt || dose.scheduledFor) });
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 5);
  }, [meds]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading profile..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  if (error || !pet) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <PawPrint className="w-12 h-12 text-midnight-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-midnight-900 mb-2">{error || 'Pet not found'}</h1>
          <Button href="/pets" variant="primary">Back to My Pets</Button>
        </Card>
      </div>
    );
  }

  const isOwner = access === 'OWNER';
  const activeCase = activeCaseOf(pet);
  const photos = parseJsonArray(pet.photos);
  const personality = parseJsonArray(pet.personality);
  const detailLine = [
    pet.breed || pet.species,
    pet.color,
    pet.size && pet.size.charAt(0) + pet.size.slice(1).toLowerCase(),
    pet.sex && pet.sex.charAt(0) + pet.sex.slice(1).toLowerCase(),
    pet.age != null && `${pet.age} year${pet.age !== 1 ? 's' : ''} old`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/pets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors mb-4">
          <ArrowLeft size={16} /> My Pets
        </Link>

        <PetSwitcher pets={allPets} currentId={petId} />

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

        {/* Identity hero */}
        <Card padding="none" className="overflow-hidden mb-6">
          <div className="sm:flex">
            <div className="sm:w-56 h-56 sm:h-auto bg-midnight-100 flex items-center justify-center shrink-0">
              {pet.primaryPhotoUrl ? (
                <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-7xl" aria-hidden="true">{SPECIES_EMOJI[pet.species] || '🐾'}</span>
              )}
            </div>
            <div className="p-5 flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-3xl font-bold text-midnight-900 truncate">{pet.name}</h1>
                  <p className="text-sm text-midnight-500 mt-1">{detailLine}</p>
                </div>
                {!activeCase && (
                  <Badge variant="success" icon={Heart}>Home</Badge>
                )}
              </div>

              {personality.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {personality.slice(0, 6).map((trait) => (
                    <span key={trait} className="px-2.5 py-1 rounded-full bg-flash-50 border border-flash-200 text-flash-800 text-xs font-semibold">
                      {trait}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                {isOwner && (
                  <Button variant="outline" size="sm" href={`/pets/${petId}/edit`} leftIcon={Pencil}>
                    Edit
                  </Button>
                )}
                {isOwner && (
                  <Button variant="outline" size="sm" href={`/pets/${petId}/share`} leftIcon={Share2}>
                    Share
                  </Button>
                )}
                {!activeCase && isOwner && (
                  <Button variant="danger" size="sm" href={`/report/new?petId=${petId}`} leftIcon={AlertTriangle}>
                    Report lost
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Today's care, at a glance */}
        <Link href={`/pets/${petId}/medications`} className="block group mb-6">
          <Card padding="lg" className="group-hover:border-flash-400 border-2 border-transparent transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <span className="w-12 h-12 rounded-2xl bg-flash-100 flex items-center justify-center shrink-0">
                  <Pill size={22} className="text-flash-700" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-bold text-midnight-900">Today&apos;s care</h2>
                  <p className="text-sm text-midnight-500 truncate">
                    {today.medCount === 0 && today.careCount === 0
                      ? 'No medications or routines yet. Set them up once, one tap forever.'
                      : [
                          today.due > 0 && `${today.given}/${today.due} doses given`,
                          today.careDue > 0 && `${today.careDone}/${today.careDue} routines done`,
                          today.careDue === 0 && today.careDone > 0 && `${today.careDone} happy ${today.careDone === 1 ? 'moment' : 'moments'} logged`,
                          today.nextSlot && `next: ${today.nextSlot.med.name} at ${formatTime(today.nextSlot.slot.time)}`,
                        ].filter(Boolean).join(' · ') || 'All clear today'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {today.due > 0 && (
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-bold',
                    today.given >= today.due ? 'bg-emerald-100 text-emerald-700' : 'bg-flash-100 text-flash-800'
                  )}>
                    {today.given >= today.due ? <span className="inline-flex items-center gap-1"><Check size={12} strokeWidth={3} /> Done</span> : `${today.due - today.given} to go`}
                  </span>
                )}
                <ChevronRight size={18} className="text-midnight-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Card>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Identification */}
          <Card padding="lg">
            <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-4">
              <Fingerprint size={18} className="text-midnight-400" /> Identification
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-midnight-500 flex items-center gap-1.5"><ShieldCheck size={14} /> Microchip</dt>
                <dd className={cn('font-semibold text-right', pet.microchipId ? 'text-midnight-900 font-mono text-xs' : 'text-midnight-400')}>
                  {pet.microchipId || 'Not on file'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-midnight-500 flex items-center gap-1.5"><Tag size={14} /> Collar</dt>
                <dd className="font-semibold text-midnight-900 text-right">{pet.collarInfo || <span className="text-midnight-400 font-normal">Not noted</span>}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-midnight-500 flex items-center gap-1.5"><Scale size={14} /> Weight</dt>
                <dd className="font-semibold text-midnight-900">{pet.weight ? `${pet.weight} lbs` : <span className="text-midnight-400 font-normal">Not noted</span>}</dd>
              </div>
              {pet.distinctiveMarks && (
                <div>
                  <dt className="text-midnight-500 mb-1">Distinctive marks</dt>
                  <dd className="text-midnight-800">{pet.distinctiveMarks}</dd>
                </div>
              )}
              {pet.medicalConditions && (
                <div>
                  <dt className="text-midnight-500 mb-1">Medical notes</dt>
                  <dd className="text-midnight-800">{pet.medicalConditions}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Care team */}
          <Card padding="lg">
            <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-4">
              <Users size={18} className="text-midnight-400" /> Care team
            </h2>
            {shares === null ? (
              <p className="text-sm text-midnight-500">
                {isOwner ? 'Loading...' : `You help care for ${pet.name}.`}
              </p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-midnight-500 mb-4">
                Just you so far. Share {pet.name} with family and sitters, or send a view link anyone can open.
              </p>
            ) : (
              <ul className="space-y-2.5 mb-4">
                {shares.slice(0, 5).map((share) => {
                  const name = [share.user?.firstName, share.user?.lastName].filter(Boolean).join(' ') || share.email;
                  return (
                    <li key={share.id} className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-flash-100 text-flash-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-semibold text-midnight-800 truncate">{name}</span>
                      <Badge size="sm" variant={share.status === 'ACTIVE' ? 'success' : 'warning'}>
                        {share.status === 'ACTIVE' ? (share.role === 'CAREGIVER' ? 'Caregiver' : 'Viewer') : share.status === 'REQUESTED' ? 'Requested' : 'Invited'}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            {isOwner && (
              <Button variant="outline" size="sm" href={`/pets/${petId}/share`} fullWidth>
                Manage sharing
              </Button>
            )}
          </Card>
        </div>

        {/* Photos */}
        {(photos.length > 0 || pet.primaryPhotoUrl) && (
          <Card padding="lg" className="mb-6">
            <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-4">
              <Camera size={18} className="text-midnight-400" /> Photos
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[...new Set([pet.primaryPhotoUrl, ...photos].filter(Boolean))].slice(0, 10).map((url) => (
                <div key={url} className="aspect-square rounded-xl overflow-hidden bg-midnight-100">
                  <img src={url} alt={pet.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent care history */}
        {recent.length > 0 && (
          <Card padding="lg" className="mb-6">
            <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-3">
              <History size={18} className="text-midnight-400" /> Recent care
            </h2>
            <ul className="divide-y divide-midnight-100">
              {recent.map(({ med, dose, at }) => (
                <li key={dose.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  {med.kind === 'CARE' ? (
                    <span className="w-8 h-8 rounded-lg bg-midnight-50 border border-midnight-100 flex items-center justify-center text-lg shrink-0" aria-hidden="true">
                      {careEmoji(med.name)}
                    </span>
                  ) : (
                    <MedIconChip med={med} size="sm" />
                  )}
                  <span className="flex-1 min-w-0 text-sm font-semibold text-midnight-800 truncate">{med.name}</span>
                  <Badge variant={dose.status === 'GIVEN' ? 'success' : 'default'} size="sm">
                    {dose.status === 'GIVEN' ? (med.kind === 'CARE' ? 'Done' : 'Given') : 'Skipped'}
                  </Badge>
                  <span className="text-xs text-midnight-500 whitespace-nowrap">
                    {sameDay(at, new Date())
                      ? at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : at.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
