'use client';

/**
 * My pets: a plain list. Each row is a pet (photo, name, a line of
 * basics, and a red Missing badge when there is an open case) that
 * opens straight to Today. Pending care invites sit at the top as
 * rows; pets shared with you sit in their own group below.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, X, ChevronRight } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';

function activeCaseOf(pet) {
  const c = pet.cases?.[0];
  if (!c || ['RESOLVED', 'CLOSED_OTHER', 'REUNITED'].includes(c.status)) return null;
  return c;
}

function PetRow({ pet, href, basics, note, activeCase, onOpenCase }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 group">
      {pet.primaryPhotoUrl ? (
        <img src={pet.primaryPhotoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
          <SpeciesIcon species={pet.species} size={22} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-medium text-neutral-900 truncate">{pet.name}</p>
          {activeCase && (
            /* In a panic, the badge is what gets tapped: it opens the CASE,
               while the rest of the row still opens the pet's care pages. */
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenCase(activeCase); }}
              className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0 hover:bg-red-100 transition-colors"
              aria-label={`${pet.name} is missing. Open the live search.`}
            >
              Missing · open search
            </button>
          )}
        </div>
        {(basics || note) && <p className="text-[13px] text-neutral-500 truncate">{note || basics}</p>}
      </div>
      <ChevronRight size={16} className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
    </Link>
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
        setSuccessMessage(`You now help care for ${invite.pet.name}.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRespondingId(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  const firstName = session?.user?.firstName || session?.user?.name;
  const basicsFor = (pet) => [
    pet.breed || pet.species,
    pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`,
  ].filter(Boolean).join(', ');

  const missingPets = pets
    .map((pet) => ({ pet, activeCase: activeCaseOf(pet) }))
    .filter((x) => x.activeCase);
  const missingNames = missingPets
    .map((x) => x.pet.name)
    .reduce((acc, name, i, arr) => {
      if (i === 0) return name;
      return i === arr.length - 1 ? `${acc} and ${name}` : `${acc}, ${name}`;
    }, '');

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {firstName ? `${firstName}'s pets` : 'My pets'}
          </h1>
          <Link
            href="/care/start"
            className="inline-flex items-center gap-1.5 rounded-full bg-care-teal text-white text-sm font-medium px-4 py-2 hover:bg-care-tealDark transition-colors"
          >
            <Plus size={15} /> Add pet
          </Link>
        </div>

        {/* A missing pet is the page's headline - everything else on
            this screen can wait. One tap into the live search. */}
        {missingPets.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 mb-6">
            <p className="font-semibold text-red-700">
              {missingNames} {missingPets.length === 1 ? 'is' : 'are'} missing.
            </p>
            <p className="text-[13px] text-red-600/90 mt-0.5 mb-2.5">
              Every hour matters. The live search is running:
            </p>
            <div className="flex flex-wrap gap-2">
              {missingPets.map(({ pet, activeCase }) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => router.push(`/mission-control?mission=${activeCase.caseNumber}`)}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3.5 py-1.5 rounded-full transition-colors"
                >
                  Open {pet.name}&rsquo;s search →
                </button>
              ))}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 text-emerald-700 px-4 py-3 mb-4 text-sm">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-800" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        {pendingInvites.length > 0 && (
          <div className="mb-8">
            <p className="text-[13px] font-medium text-neutral-500 mb-1">Invitations</p>
            <div className="divide-y divide-neutral-100">
              {pendingInvites.map((invite) => (
                <div key={invite.shareId} className="flex items-center gap-3 py-3">
                  {invite.pet.primaryPhotoUrl ? (
                    <img src={invite.pet.primaryPhotoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                      <SpeciesIcon species={invite.pet.species} size={22} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-neutral-900 truncate">{invite.pet.name}</p>
                    <p className="text-[13px] text-neutral-500 truncate">
                      {invite.ownerName} invited you as {invite.role === 'CAREGIVER' ? 'a caregiver' : 'a viewer'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => respondToInvite(invite, false)}
                      disabled={respondingId === invite.shareId}
                      className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => respondToInvite(invite, true)}
                      disabled={respondingId === invite.shareId}
                      className="rounded-full bg-care-teal text-white text-sm font-medium px-4 py-1.5 hover:bg-care-tealDark transition-colors disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pets.length === 0 && sharedPets.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-lg font-medium text-neutral-900 mb-1">Add your first pet</p>
            <p className="text-[15px] text-neutral-500 max-w-sm mx-auto mb-6">
              Track medications with one-tap logging, keep vaccine and weight records,
              and share a link any vet or sitter can read. Free forever.
            </p>
            <Link
              href="/care/start"
              className="inline-flex items-center gap-1.5 rounded-full bg-care-teal text-white text-sm font-medium px-5 py-2.5 hover:bg-care-tealDark transition-colors"
            >
              <Plus size={15} /> Add pet
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {pets.map((pet) => (
              <PetRow
                key={pet.id}
                pet={pet}
                href={`/pets/${pet.id}/today`}
                basics={basicsFor(pet)}
                activeCase={activeCaseOf(pet)}
                onOpenCase={(c) => router.push(`/mission-control?mission=${c.caseNumber}`)}
              />
            ))}
          </div>
        )}

        {sharedPets.length > 0 && (
          <div className="mt-8">
            <p className="text-[13px] font-medium text-neutral-500 mb-1">Shared with me</p>
            <div className="divide-y divide-neutral-100">
              {sharedPets.map(({ shareId, role, ownerName, pet }) => (
                <PetRow
                  key={shareId}
                  pet={pet}
                  href={`/pets/${pet.id}/today`}
                  activeCase={activeCaseOf(pet)}
                  onOpenCase={(c) => router.push(`/mission-control?mission=${c.caseNumber}`)}
                  note={`${ownerName}'s pet, you help as ${role === 'CAREGIVER' ? 'a caregiver' : 'a viewer'}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
