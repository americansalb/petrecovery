'use client';

/**
 * Profile tab (direction D). Subtabs: About (who Max is), ID & marks (the
 * finder-critical details, prominent because they matter if he goes
 * missing), and Photos. A calm read view; editing opens the full form.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Pencil, ChevronRight } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { usePet } from '@/app/components/care/PetProvider';
import RescueReadiness from '@/app/components/pets/RescueReadiness';
import SubTabs from '@/app/components/care/kit/SubTabs';
import { Card, Overline } from '@/app/components/care/kit/Tile';

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try { const a = JSON.parse(value || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
const cap = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);

function Rows({ children }) {
  return <Card className="overflow-hidden">{children}</Card>;
}
function Row({ label, value, missing, editHref, first }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 py-3.5 ${!first ? 'border-t border-care-lineSoft' : ''}`}>
      <dt className="text-[13px] text-care-sub shrink-0 pt-0.5">{label}</dt>
      <dd className="text-[14.5px] text-care-ink text-right min-w-0">
        {value || (editHref ? <Link href={editHref} className="inline-flex items-center gap-0.5 text-care-sub hover:text-care-ink">Add<ChevronRight size={13} /></Link> : <span className="text-care-faint">{missing || 'Not noted'}</span>)}
      </dd>
    </div>
  );
}

function ProfileInner() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const petId = params.id;
  const { pet, access } = usePet();

  const initial = ['id', 'photos'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'about';
  const [tab, setTab] = useState(initial);

  // Team + view-link state feed the readiness count, so this page and the
  // edit page always report the same N of 7 (they used to disagree).
  const [shares, setShares] = useState([]);
  const [viewLinkUrl, setViewLinkUrl] = useState(null);
  useEffect(() => {
    if (status !== 'authenticated' || !petId || access !== 'OWNER') return;
    fetch(`/api/pets/${petId}/shares`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.shares) setShares(d.shares); }).catch(() => {});
    fetch(`/api/pets/${petId}/share-link`).then((r) => (r.ok ? r.json() : null)).then((d) => setViewLinkUrl(d?.url || null)).catch(() => {});
  }, [status, petId, access]);

  if (status === 'loading' || !pet) return <div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner text="Loading..." /></div>;
  if (status === 'unauthenticated') { router.push(`/login?callbackUrl=/pets/${petId}/profile`); return null; }

  const isOwner = access === 'OWNER';
  const editHref = isOwner ? `/pets/${petId}/edit` : undefined;
  const anchored = (hash) => (editHref ? `${editHref}#${hash}` : undefined);
  const photos = parseJsonArray(pet.photos);
  const personality = parseJsonArray(pet.personality);
  const uniquePhotos = [...new Set([pet.primaryPhotoUrl, ...photos].filter(Boolean))];
  const looks = [pet.breed || pet.species, pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`, cap(pet.color), cap(pet.size), cap(pet.sex)].filter(Boolean).join(', ');

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
      <div className="flex items-end justify-between gap-3 mb-4">
        <h1 className="text-[24px] font-semibold tracking-tight text-care-ink">Profile</h1>
        {isOwner && <Link href={`/pets/${petId}/edit`} className="inline-flex items-center gap-1.5 rounded-xl border border-care-line text-[13.5px] font-semibold text-care-ink px-4 py-2 hover:border-care-ink transition-colors"><Pencil size={14} /> Edit</Link>}
      </div>

      <SubTabs
        tabs={[{ id: 'about', label: 'About' }, { id: 'id', label: 'ID & marks' }, { id: 'photos', label: 'Photos' }]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {tab === 'about' && (
        <div className="flex flex-col gap-5">
          <Rows>
            <Row first label="Looks" value={looks} editHref={editHref} />
            <Row label="Neutered" value={pet.isNeutered ? 'Yes' : 'No'} />
          </Rows>
          {personality.length > 0 && (
            <div>
              <Overline className="mb-2.5">Personality</Overline>
              <div className="flex flex-wrap gap-2">
                {personality.map((t) => <span key={t} className="text-[13px] px-3 py-1 rounded-full bg-care-surface shadow-care text-care-ink">{t}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'id' && (
        <div className="flex flex-col gap-5">
          {isOwner && <RescueReadiness pet={pet} photos={uniquePhotos} personality={personality} shares={shares} viewLinkUrl={viewLinkUrl} isOwner={isOwner} />}
          <Rows>
            <Row first label="Microchip" value={pet.microchipId} editHref={anchored('identification')} />
            <Row label="Collar & tag" value={pet.collarInfo} editHref={anchored('identification')} />
            <Row label="Distinctive marks" value={pet.distinctiveMarks} editHref={anchored('appearance')} />
            <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-t border-care-lineSoft">
              <dt className="text-[13px] text-care-sub shrink-0 pt-0.5">Medical</dt>
              <dd className="text-[14.5px] text-right min-w-0">{pet.medicalConditions ? <span className="text-red-600 font-medium">{pet.medicalConditions}</span> : (editHref ? <Link href={anchored('medical')} className="inline-flex items-center gap-0.5 text-care-sub hover:text-care-ink">Add<ChevronRight size={13} /></Link> : <span className="text-care-faint">None noted</span>)}</dd>
            </div>
          </Rows>
        </div>
      )}

      {tab === 'photos' && (
        uniquePhotos.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {uniquePhotos.map((url) => <img key={url} src={url} alt={pet.name} className="w-full aspect-square rounded-2xl object-cover shadow-care" />)}
          </div>
        ) : (
          <Card className="text-center py-12 px-6">
            <p className="text-[15px] text-care-sub">No photos yet.</p>
            {isOwner && <Link href={`/pets/${petId}/edit`} className="inline-flex items-center gap-2 mt-4 rounded-xl bg-care-teal text-white text-sm font-semibold px-5 py-2.5 hover:bg-care-tealDark transition-colors"><Pencil size={15} /> Add photos</Link>}
          </Card>
        )
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner /></div>}>
      <ProfileInner />
    </Suspense>
  );
}
