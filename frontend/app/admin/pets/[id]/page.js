'use client';

/**
 * Admin Pet Detail - the full record for one pet, read-only.
 * Backed by /api/admin/pets/[id] (admin only).
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, User, Mail, Phone, Syringe, Pill, Scale, Users, AlertTriangle, Calendar, Info,
} from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { vaccinationStatus } from '@/lib/healthBook';
import { formatSchedule } from '@/lib/medications';

const ACTIVE_CASE = new Set(['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'OPEN']);
const VAX_STYLE = {
  PROTECTED: 'bg-emerald-100 text-emerald-700',
  DUE_SOON: 'bg-amber-100 text-amber-700',
  EXPIRED: 'bg-red-100 text-red-700',
  ON_FILE: 'bg-gray-200 text-gray-700',
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : 'Not set');

function Section({ title, icon: Icon, count, children }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
        <Icon className="w-5 h-5 text-gray-400" /> {title}
        {count != null && <span className="text-sm font-normal text-gray-400">({count})</span>}
      </h2>
      {children}
    </div>
  );
}

export default function AdminPetDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = useParams();
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push(`/login?callbackUrl=/admin/pets/${id}`);
    else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/dashboard');
  }, [status, session, router, id]);

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pets/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load pet');
        setPet(data.pet);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, id]);

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  }
  if (session?.user?.role !== 'ADMIN') return null;
  if (error || !pet) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-md">
          <p className="text-gray-900 font-semibold mb-3">{error || 'Pet not found'}</p>
          <Link href="/admin/pets" className="text-blue-600 hover:underline">Back to pets</Link>
        </div>
      </div>
    );
  }

  const activeCase = (pet.cases || []).find((c) => ACTIVE_CASE.has(c.status));
  const meds = pet.medications || [];
  const weights = pet.weightEntries || [];
  const latestWeight = weights[weights.length - 1];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center gap-4">
          <Link href="/admin/pets" className="text-gray-500 hover:text-gray-700"><ChevronLeft className="w-6 h-6" /></Link>
          <span className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
            {pet.primaryPhotoUrl ? <img src={pet.primaryPhotoUrl} alt="" className="w-full h-full object-cover" /> : <SpeciesIcon species={pet.species} size={26} className="text-gray-400" />}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{pet.name}</h1>
            <p className="text-sm text-gray-500 capitalize truncate">{[pet.breed || pet.species, pet.age != null ? `${pet.age} yr${pet.age === 1 ? '' : 's'}` : null, pet.sex?.toLowerCase()].filter(Boolean).join(' · ')}</p>
          </div>
          {activeCase && (
            <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" /> {activeCase.caseNumber || 'Missing'}</span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Owner */}
        <Section title="Owner" icon={User}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href={`/admin/users/${pet.owner?.id}`} className="font-semibold text-blue-600 hover:underline">
              {[pet.owner?.firstName, pet.owner?.lastName].filter(Boolean).join(' ') || 'Unknown'}
            </Link>
            {pet.owner?.email && <span className="inline-flex items-center gap-1 text-gray-600"><Mail className="w-3 h-3" /> {pet.owner.email}</span>}
            {pet.owner?.phone && <span className="inline-flex items-center gap-1 text-gray-600"><Phone className="w-3 h-3" /> {pet.owner.phone}</span>}
          </div>
        </Section>

        {/* Identity */}
        <Section title="About" icon={Info}>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['Species', pet.species], ['Breed', pet.breed], ['Age', pet.age != null ? `${pet.age} yrs` : null],
              ['Sex', pet.sex], ['Color', pet.color], ['Size', pet.size],
              ['Weight', pet.weight != null ? `${pet.weight} lb` : null], ['Microchip', pet.microchipId], ['Collar', pet.collarInfo],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-gray-500">{k}</dt><dd className="font-medium text-gray-900 capitalize break-words">{v ? String(v).toLowerCase() : 'Not set'}</dd></div>
            ))}
          </dl>
          {pet.distinctiveMarks && <p className="mt-4 text-sm"><span className="text-gray-500">Distinctive marks: </span>{pet.distinctiveMarks}</p>}
          {pet.medicalConditions && <p className="mt-2 text-sm"><span className="text-gray-500">Medical: </span>{pet.medicalConditions}</p>}
          {Array.isArray(pet.personality) && pet.personality.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {pet.personality.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">{t}</span>)}
            </div>
          )}
        </Section>

        {/* Vaccinations */}
        <Section title="Vaccinations" icon={Syringe} count={(pet.vaccinations || []).length}>
          {(pet.vaccinations || []).length === 0 ? (
            <p className="text-sm text-gray-400">None recorded.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pet.vaccinations.map((v) => {
                const st = vaccinationStatus(v);
                return (
                  <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="font-medium text-gray-900 flex-1 truncate">{v.name}</span>
                    {v.vetName && <span className="text-gray-400 truncate hidden sm:block">{v.vetName}</span>}
                    <span className="text-gray-500">{v.expiresAt ? `until ${fmtDate(v.expiresAt)}` : fmtDate(v.administeredAt)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VAX_STYLE[st]}`}>{st.replace('_', ' ').toLowerCase()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Medications */}
        <Section title="Medications" icon={Pill} count={meds.length}>
          {meds.length === 0 ? (
            <p className="text-sm text-gray-400">None on file.</p>
          ) : (
            <ul className="space-y-3">
              {meds.map((m) => {
                const given = (m.doses || []).filter((d) => d.status === 'GIVEN').length;
                return (
                  <li key={m.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{m.name}</span>
                      {m.strength && <span className="text-xs text-gray-500">{m.strength}</span>}
                      {!m.isActive && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">Paused</span>}
                      {m.kind === 'CARE' && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 text-xs">Routine</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{formatSchedule(m)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {m.quantityRemaining != null ? `${Math.round(m.quantityRemaining * 10) / 10} left · ` : ''}{given} recent dose{given === 1 ? '' : 's'} logged
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Weight + Care team */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Weight" icon={Scale} count={weights.length}>
            {latestWeight ? (
              <>
                <p className="text-2xl font-bold text-gray-900">{latestWeight.weightLbs}<span className="text-sm font-normal text-gray-400 ml-1">lb</span></p>
                <p className="text-xs text-gray-400 mb-3">latest, {fmtDate(latestWeight.recordedAt)}</p>
                <ul className="text-sm divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {[...weights].reverse().slice(0, 12).map((w) => (
                    <li key={w.id} className="flex justify-between py-1.5"><span className="text-gray-500">{fmtDate(w.recordedAt)}</span><span className="font-medium text-gray-900">{w.weightLbs} lb</span></li>
                  ))}
                </ul>
              </>
            ) : <p className="text-sm text-gray-400">No weigh-ins.</p>}
          </Section>

          <Section title="Care team" icon={Users} count={(pet.shares || []).length}>
            {(pet.shares || []).length === 0 ? (
              <p className="text-sm text-gray-400">Just the owner.</p>
            ) : (
              <ul className="text-sm divide-y divide-gray-100">
                {pet.shares.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <span className="text-gray-900 truncate">{[s.user?.firstName, s.user?.lastName].filter(Boolean).join(' ') || s.email}</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{(s.role || 'VIEWER').toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Cases */}
        {(pet.cases || []).length > 0 && (
          <Section title="Cases" icon={Calendar} count={pet.cases.length}>
            <ul className="text-sm divide-y divide-gray-100">
              {pet.cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-gray-700">{c.caseNumber}</span>
                  <span className="text-gray-500">{c.status?.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="text-gray-400">{fmtDate(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">Admin read-only view. Owner: {pet.owner?.email}.</p>
      </div>
    </div>
  );
}
