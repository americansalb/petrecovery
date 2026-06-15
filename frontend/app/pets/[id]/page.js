'use client';

/**
 * The Pet Dashboard - one place for everything about this pet.
 *
 * The profile used to be four tabs (Overview / Today / Health Book /
 * Sharing) that each re-stated slices of the same data. This is the
 * consolidation: one page that owns the data once and lays it out as
 * sections you can act on in place. Today's dose checklist lives here
 * (you log meds right where you see them), the full Health Book record
 * lives here, and so do the identity facts and the care team. The old
 * /today and /health routes redirect in.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PawPrint, AlertTriangle, Radar, Users, ChevronRight, Sun, ShieldCheck, IdCard, Images } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, cn } from '@/components/ui';
import RescueReadiness from '@/app/components/pets/RescueReadiness';
import CareToday from '@/app/components/care/CareToday';
import GoodStuff from '@/app/components/care/GoodStuff';
import HealthBook from '@/app/components/health/HealthBook';

function parseJsonArray(value) {
  try { const arr = JSON.parse(value || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}

function activeCaseOf(pet) {
  const c = pet?.cases?.[0];
  if (!c) return null;
  if (['REUNITED', 'CLOSED_OTHER', 'RESOLVED'].includes(c.status)) return null;
  return c;
}

/* A profile fact row: the value when known, a one-tap "Add" when not. */
function IdRow({ label, isOwner, addHref, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-midnight-500 shrink-0">{label}</dt>
      <dd className="font-semibold text-midnight-900 text-right min-w-0">
        {children || (
          isOwner ? (
            <Link href={addHref} className="inline-flex items-center gap-0.5 text-flash-600 hover:text-flash-700 font-bold text-xs">Add <ChevronRight size={12} /></Link>
          ) : (
            <span className="text-midnight-400 font-normal">Not noted</span>
          )
        )}
      </dd>
    </div>
  );
}

/* Section heading with an anchor the sticky nav scrolls to. */
function SectionTitle({ id, icon: Icon, children, action }) {
  return (
    <div id={id} className="scroll-mt-24 flex items-center justify-between gap-3 mb-3 mt-10 first:mt-0">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-midnight-900 tracking-tight">
        <Icon size={19} className="text-midnight-400" /> {children}
      </h2>
      {action}
    </div>
  );
}

export default function PetDashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [meds, setMeds] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [weights, setWeights] = useState([]);
  const [access, setAccess] = useState('OWNER');
  const [shares, setShares] = useState(null);
  const [viewLinkUrl, setViewLinkUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push(`/login?callbackUrl=/pets/${petId}`);
  }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const [petRes, medsRes, vaxRes, wtRes] = await Promise.all([
        fetch(`/api/pets/${petId}`),
        fetch(`/api/pets/${petId}/medications`),
        fetch(`/api/pets/${petId}/vaccinations`),
        fetch(`/api/pets/${petId}/weights`),
      ]);
      const petData = await petRes.json();
      if (!petRes.ok) throw new Error(petData.error || 'Pet not found');
      setPet(petData.pet || petData);
      if (medsRes.ok) {
        const m = await medsRes.json();
        setMeds(m.medications || []);
        setAccess(m.access || 'OWNER');
      }
      if (vaxRes.ok) setVaccinations((await vaxRes.json()).vaccinations || []);
      if (wtRes.ok) setWeights((await wtRes.json()).weights || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) load();
  }, [status, petId, load]);

  // Care team + view link are owner territory; load quietly, tolerate 403.
  useEffect(() => {
    if (status !== 'authenticated' || !petId) return;
    fetch(`/api/pets/${petId}/shares`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.shares) setShares(d.shares); }).catch(() => {});
    fetch(`/api/pets/${petId}/share-link`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.url) setViewLinkUrl(d.url); }).catch(() => {});
  }, [status, petId]);

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-midnight-50 flex items-center justify-center"><LoadingSpinner text="Loading profile..." /></div>;
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
  const canManage = access !== 'VIEWER';
  const activeCase = activeCaseOf(pet);
  const photos = parseJsonArray(pet.photos);
  const personality = parseJsonArray(pet.personality);
  const uniquePhotos = [...new Set([pet.primaryPhotoUrl, ...photos].filter(Boolean))];
  const traitLine = [
    pet.color,
    pet.size && pet.size.charAt(0) + pet.size.slice(1).toLowerCase(),
    pet.sex && pet.sex.charAt(0) + pet.sex.slice(1).toLowerCase(),
  ].filter(Boolean).join(' · ');

  const careTeamLine = shares === null
    ? (isOwner ? null : `You help care for ${pet.name}.`)
    : shares.length === 0
      ? 'Just you so far. Invite family or share a view link.'
      : shares.slice(0, 5).map((sh) => [sh.user?.firstName, sh.user?.lastName?.[0]].filter(Boolean).join(' ') || sh.email).join(', ');

  const NAV = [
    { href: '#today', label: 'Today', icon: Sun },
    { href: '#health', label: 'Health', icon: ShieldCheck },
    { href: '#about', label: 'About', icon: IdCard },
    { href: '#people', label: 'People', icon: Users },
  ];

  return (
    <div className="bg-midnight-50 min-h-screen">
      {/* Sticky in-page nav: the long dashboard's hallway */}
      <div className="sticky top-0 z-20 bg-midnight-50/90 backdrop-blur border-b border-midnight-100">
        <div className="max-w-4xl mx-auto px-4 md:px-8 flex gap-1 overflow-x-auto py-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold text-midnight-500 hover:text-midnight-900 hover:bg-white transition-colors whitespace-nowrap">
              <Icon size={15} /> {label}
            </a>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Missing? Nothing else matters until they're home. */}
          {activeCase ? (
            <div className="rounded-3xl bg-midnight-950 border-2 border-red-500/60 p-5 mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0"><AlertTriangle size={22} className="text-red-400" /></span>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-bold text-white">{pet.name} is missing</p>
                  <p className="text-sm text-midnight-300">Case {activeCase.caseNumber} is live. The search is on.</p>
                </div>
                <Link href={`/mission-control?mission=${activeCase.caseNumber}`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold rounded-2xl transition text-sm">
                  <Radar size={16} /> Mission Control
                </Link>
              </div>
            </div>
          ) : (
            <RescueReadiness pet={pet} photos={uniquePhotos} personality={personality} shares={shares} viewLinkUrl={viewLinkUrl} isOwner={isOwner} />
          )}

          {/* ===== Today ===== */}
          <SectionTitle id="today" icon={Sun}>Today</SectionTitle>
          <CareToday petId={petId} meds={meds} setMeds={setMeds} canManage={canManage} />
          <div className="mt-2">
            <GoodStuff petId={petId} meds={meds} setMeds={setMeds} canManage={canManage} />
          </div>

          {/* ===== Health Book ===== */}
          <SectionTitle id="health" icon={ShieldCheck}>Health Book</SectionTitle>
          <HealthBook
            petId={petId} pet={pet} setPet={setPet}
            vaccinations={vaccinations} setVaccinations={setVaccinations}
            weights={weights} setWeights={setWeights}
            meds={meds} setMeds={setMeds} access={access}
          />

          {/* ===== About ===== */}
          <SectionTitle id="about" icon={IdCard}>About {pet.name}</SectionTitle>
          <Card padding="lg">
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
              <IdRow label="Collar" isOwner={isOwner} addHref={`/pets/${petId}/edit`}>{pet.collarInfo}</IdRow>
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
                  {personality.slice(0, 8).map((trait) => (
                    <span key={trait} className="px-2.5 py-1 rounded-full bg-flash-50 border border-flash-200 text-flash-800 text-xs font-semibold">{trait}</span>
                  ))}
                </div>
              )}
            </dl>

            {uniquePhotos.length >= 2 && (
              <div className="mt-6 pt-5 border-t border-midnight-100">
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.15em] text-midnight-400 mb-3"><Images size={13} /> Photos</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {uniquePhotos.slice(0, 10).map((url) => (
                    <div key={url} className="aspect-square rounded-xl overflow-hidden bg-midnight-100">
                      <img src={url} alt={pet.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ===== People ===== */}
          <SectionTitle id="people" icon={Users} action={
            <Link href={`/pets/${petId}/share`} className="text-sm font-bold text-midnight-400 hover:text-midnight-700">Manage</Link>
          }>Care team</SectionTitle>
          <Link href={`/pets/${petId}/share`} className="block group">
            <Card padding="lg" className="group-hover:border-flash-400 border-2 border-transparent transition-colors">
              <div className="flex items-center gap-4">
                <Users size={20} className="text-midnight-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-midnight-900">The people who care for {pet.name}</p>
                  <p className="text-sm text-midnight-500 truncate">{careTeamLine || 'Invite family, a sitter, or share a read-only link.'}</p>
                </div>
                <ChevronRight size={18} className="text-midnight-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Card>
          </Link>

          <p className="text-center text-xs text-midnight-400 pt-10 pb-4">
            A record you keep, not medical advice. Your vet&rsquo;s guidance comes first.
          </p>
        </div>
      </div>
    </div>
  );
}
