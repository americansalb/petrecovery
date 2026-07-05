'use client';

/**
 * My Pets — the bookshelf.
 *
 * The care product is the Paper Passport: every pet is a cloth-bound
 * Health Book on a shelf. The cover carries a taped-in polaroid, the
 * pet's name on a paper plate, a stamped status, and two bookmarks —
 * Today and the Health Book — so the daily rooms are two taps from
 * anywhere. Pending care-team invites are notes slipped between the
 * books; pets shared with you sit on their own shelf below.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, X, Check } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import {
  PaperScaffold, Sheet, Polaroid, StampText,
} from '@/app/components/care/paper/Paper';

// Cloth colors for the covers, rotated per book: oxblood, navy, olive, tan.
const CLOTH = [
  { bg: '#8a3033', edge: '#6f2629' },
  { bg: '#2f4156', edge: '#243347' },
  { bg: '#4a6b52', edge: '#3a5641' },
  { bg: '#7c5c34', edge: '#654a29' },
];

function caseStamp(pet) {
  const status = pet.cases?.[0]?.status;
  const map = {
    OPEN: { tone: 'red', label: 'Missing' },
    ACTIVE_SEARCH: { tone: 'red', label: 'Active search' },
    RESOLVED: { tone: 'green', label: 'Found' },
    CLOSED_OTHER: { tone: 'ink', label: 'Closed' },
  };
  return status ? map[status] || null : null;
}

/**
 * One book on the shelf. The cover opens the Overview; the two
 * bookmarks jump straight into the daily rooms.
 */
function BookCover({ pet, index, stamp, plateLine, byline }) {
  const cloth = CLOTH[index % CLOTH.length];
  return (
    <div className="group" style={{ transform: `rotate(${index % 2 ? 0.4 : -0.5}deg)` }}>
      <Link href={`/pets/${pet.id}`} className="block">
        <div
          className="relative rounded-[6px] rounded-l-[3px] px-5 pt-6 pb-5 shadow-[inset_10px_0_14px_-10px_rgba(0,0,0,0.55),0_14px_28px_-14px_rgba(35,42,61,0.55)] transition-transform group-hover:-translate-y-1"
          style={{ background: cloth.bg }}
        >
          {/* the spine's binding groove */}
          <span aria-hidden="true" className="absolute left-2.5 top-2 bottom-2 w-px opacity-40" style={{ background: cloth.edge, boxShadow: `3px 0 0 ${cloth.edge}` }} />

          <div className="flex items-start gap-4 pl-3">
            <Polaroid
              src={pet.primaryPhotoUrl}
              alt={pet.name}
              fallback={<SpeciesIcon species={pet.species} size={30} />}
              size="md"
              rotate={index % 2 ? 3 : -3}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 pt-1">
              {/* the pasted-on name plate */}
              <div className="bg-paper-50 border border-paper-400 rounded-[3px] px-3 py-2 shadow-[0_2px_5px_rgba(0,0,0,0.3)]" style={{ transform: 'rotate(-0.6deg)' }}>
                <p className="font-diary italic text-[19px] leading-tight text-pen-900 truncate">{pet.name}</p>
                <p className="font-stamp text-[8.5px] uppercase tracking-[0.14em] text-pen-400 truncate mt-0.5">{plateLine}</p>
              </div>
              {byline && (
                <p className="font-diary italic text-[11px] text-paper-200/90 mt-2 truncate">{byline}</p>
              )}
            </div>
            <span className="shrink-0 pt-1">
              {stamp ? (
                <StampText tone={stamp.tone} rotate={5} size="sm" className="bg-paper-50/95">{stamp.label}</StampText>
              ) : (
                <StampText tone="green" rotate={5} size="sm" className="bg-paper-50/95">Home</StampText>
              )}
            </span>
          </div>
        </div>
      </Link>

      {/* the bookmarks hanging out of the book */}
      <div className="flex gap-2 pl-8 -mt-px">
        <Link
          href={`/pets/${pet.id}/today`}
          className="font-stamp text-[9px] uppercase tracking-[0.14em] bg-marker text-pen-900 rounded-b-[4px] px-3.5 pt-1.5 pb-2 shadow-[0_3px_6px_rgba(35,42,61,0.25)] hover:pb-3 transition-all"
        >
          Today
        </Link>
        <Link
          href={`/pets/${pet.id}/health`}
          className="font-stamp text-[9px] uppercase tracking-[0.14em] bg-paper-300 text-pen-600 rounded-b-[4px] px-3.5 pt-1.5 pb-2 shadow-[0_3px_6px_rgba(35,42,61,0.25)] hover:pb-3 transition-all"
        >
          Health Book
        </Link>
      </div>
    </div>
  );
}

export default function MyPetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pets, setPets] = useState([]);
  const [sharedPets, setSharedPets] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [respondingId, setRespondingId] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/pets');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPets();
    }
  }, [status]);

  const fetchPets = async () => {
    try {
      const res = await fetch('/api/pets');
      if (!res.ok) throw new Error('Failed to fetch pets');
      const data = await res.json();
      setPets(data.pets || []);
      setSharedPets(data.sharedPets || []);
      setPendingInvites(data.pendingInvites || []);
    } catch (err) {
      console.error('[PETS] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const respondToInvite = async (invite, accept) => {
    setRespondingId(invite.shareId);
    setError(null);
    try {
      const url = `/api/pets/${invite.pet.id}/shares/${invite.shareId}`;
      const res = accept
        ? await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept' }),
          })
        : await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to respond');

      setPendingInvites((prev) => prev.filter((i) => i.shareId !== invite.shareId));
      if (accept) {
        setSharedPets((prev) => [{ ...invite }, ...prev]);
        setSuccessMessage(`You now help care for ${invite.pet.name}!`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRespondingId(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <PaperScaffold className="flex items-center justify-center">
        <LoadingSpinner text="Opening the shelf..." />
      </PaperScaffold>
    );
  }

  if (status === 'unauthenticated') return null;

  const firstName = session?.user?.firstName || session?.user?.name;
  const bylineFor = (pet) => [
    pet.breed || pet.species,
    pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`,
    pet.microchipId && 'microchipped',
  ].filter(Boolean).join(' · ');

  return (
    <PaperScaffold className="pb-24 lg:pb-12">
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-8 md:pt-10">
        {/* The shelf's title, written by hand */}
        <div className="flex items-end justify-between gap-4 border-b-2 border-pen-900 pb-3 mb-6 flex-wrap">
          <div>
            <p className="font-stamp text-[9px] uppercase tracking-[0.2em] text-pen-400 mb-1">The bookshelf</p>
            <h1 className="font-diary italic text-[34px] leading-none text-pen-900">
              {firstName ? `${firstName}'s pets` : 'My Pets'}
            </h1>
          </div>
          <Link
            href="/care/start"
            className="inline-flex items-center gap-1.5 font-stamp text-[10.5px] uppercase tracking-[0.12em] text-stampred border-[1.5px] border-dashed border-stampred rounded-[4px] px-3.5 py-2.5 hover:bg-stampred hover:text-paper-50 hover:border-solid transition-colors"
          >
            <Plus size={13} /> Start a new book
          </Link>
        </div>

        {successMessage && (
          <div className="border-l-[3px] border-stampgreen bg-stampgreen-wash/70 text-stampgreen px-4 py-3 mb-5 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2"><Check size={15} /> {successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="text-stampgreen hover:opacity-70" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="border-l-[3px] border-stampred bg-stampred-wash/60 text-stampred-dark px-4 py-3 mb-5 text-sm">
            {error}
          </div>
        )}

        {/* Pending care-team invites: notes slipped between the books */}
        {pendingInvites.length > 0 && (
          <div className="space-y-3 mb-7">
            {pendingInvites.map((invite) => (
              <Sheet key={invite.shareId} className="flex items-center gap-4 flex-wrap">
                <Polaroid
                  src={invite.pet.primaryPhotoUrl}
                  alt={invite.pet.name}
                  fallback={<SpeciesIcon species={invite.pet.species} size={22} />}
                  size="sm"
                  rotate={2}
                />
                <div className="flex-1 min-w-[200px]">
                  <p className="font-diary italic text-[15px] text-pen-900">
                    {invite.ownerName} shared {invite.pet.name}&rsquo;s book with you
                  </p>
                  <p className="font-diary italic text-[12px] text-pen-400">
                    as {invite.role === 'CAREGIVER' ? 'a caregiver — you can write in doses and keep the record' : 'a viewer — you can read the book and the schedule'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToInvite(invite, true)}
                    disabled={respondingId === invite.shareId}
                    className="inline-flex items-center gap-1 font-stamp text-[10px] uppercase tracking-[0.12em] bg-stampgreen text-paper-50 rounded-[4px] px-3.5 py-2 hover:opacity-90 transition disabled:opacity-50"
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    onClick={() => respondToInvite(invite, false)}
                    disabled={respondingId === invite.shareId}
                    className="font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 px-2 py-2 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </Sheet>
            ))}
          </div>
        )}

        {/* The shelf */}
        {pets.length === 0 && sharedPets.length === 0 ? (
          <Sheet perforated className="text-center py-10">
            <p className="font-diary italic text-[22px] text-pen-900 mb-2">Start their Health Book</p>
            <p className="font-diary italic text-[13.5px] text-pen-400 max-w-md mx-auto mb-6">
              medications with one-tap logging, vaccine stamps, weight over time,
              and a link any vet or sitter can read. free forever.
            </p>
            <Link
              href="/care/start"
              className="inline-flex items-center gap-1.5 font-stamp text-[11px] uppercase tracking-[0.12em] text-stampred border-[1.5px] border-dashed border-stampred rounded-[4px] px-4 py-3 hover:bg-stampred hover:text-paper-50 hover:border-solid transition-colors"
            >
              <Plus size={13} /> Write the first page
            </Link>
          </Sheet>
        ) : (
          <div className="space-y-7">
            {pets.map((pet, i) => (
              <BookCover
                key={pet.id}
                pet={pet}
                index={i}
                stamp={caseStamp(pet)}
                plateLine={bylineFor(pet)}
              />
            ))}
          </div>
        )}

        {/* Shared with me: the borrowed books */}
        {sharedPets.length > 0 && (
          <div className="mt-10">
            <div className="border-b border-pen-900/[0.25] pb-1.5 mb-6">
              <p className="font-stamp text-[9px] uppercase tracking-[0.2em] text-pen-400">Shared with me</p>
              <p className="font-diary italic text-[15px] text-pen-600">books you help keep</p>
            </div>
            <div className="space-y-7">
              {sharedPets.map(({ shareId, role, ownerName, pet }, i) => (
                <BookCover
                  key={shareId}
                  pet={pet}
                  index={pets.length + i}
                  stamp={{ tone: role === 'CAREGIVER' ? 'green' : 'ink', label: role === 'CAREGIVER' ? 'Caregiver' : 'Viewer' }}
                  plateLine={pet.breed || pet.species}
                  byline={`${ownerName}'s pet — they keep the book, you help write it`}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-center font-diary italic text-[12px] text-pen-400 mt-12">
          a record you keep, not medical advice · your vet&rsquo;s guidance comes first
        </p>
      </div>
    </PaperScaffold>
  );
}
