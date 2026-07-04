'use client';

/**
 * My Pets — the one dashboard for the daily care product.
 *
 * This page absorbed the old /care members dashboard: same pets, one
 * home. It wears the care product's warm daylight register (the
 * midnight/dark register belongs to the rescue world), and every card
 * offers the two daily doors directly — Today (log doses) and the
 * Health Book (the record) — so the most-used surfaces are two taps
 * from anywhere. Pending care-team invites are accepted here; pets
 * shared with you live below your own.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PawPrint, Plus, X, HeartHandshake, Check, ChevronRight, Heart, Sun, AlertTriangle,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, Badge, EmptyState } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';

function caseBadge(pet) {
  const status = pet.cases?.[0]?.status;
  const badges = {
    OPEN: { variant: 'warning', label: 'Missing' },
    ACTIVE_SEARCH: { variant: 'primary', label: 'Active Search' },
    RESOLVED: { variant: 'success', label: 'Found' },
    CLOSED_OTHER: { variant: 'default', label: 'Closed' },
  };
  return status ? badges[status] || null : null;
}

/**
 * One pet, one card. The photo + name open the Overview; the two chips
 * below jump straight into the daily rooms. (Chips are separate links,
 * not nested inside the card link.)
 */
function PetCard({ pet, badge, byline }) {
  return (
    <Card padding="none" className="overflow-hidden border-2 border-transparent hover:border-flash-400 hover:shadow-xl hover:-translate-y-1 transition-all">
      <Link href={`/pets/${pet.id}`} className="group block">
        <div className="aspect-[4/3] bg-gradient-to-br from-amber-50 to-midnight-100 relative flex items-center justify-center">
          {pet.primaryPhotoUrl ? (
            <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
          ) : (
            <SpeciesIcon species={pet.species} size={64} className="text-midnight-300" />
          )}
          <div className="absolute top-3 right-3">
            {badge ? (
              badge.variant ? (
                <Badge variant={badge.variant}>
                  {badge.label === 'Missing' && <AlertTriangle size={11} className="inline -mt-0.5 mr-1" />}
                  {badge.label}
                </Badge>
              ) : (
                badge.node
              )
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-emerald-700 text-xs font-bold">
                <Heart size={11} /> Home
              </span>
            )}
          </div>
        </div>
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-midnight-900 truncate group-hover:text-flash-600 transition-colors">
              {pet.name}
            </h3>
            <p className="text-sm text-midnight-500 truncate">{byline}</p>
          </div>
          <ChevronRight size={18} className="text-midnight-300 group-hover:text-flash-500 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </Link>
      {/* The daily doors: straight into the rooms people visit every day */}
      <div className="flex gap-2 px-4 pb-4">
        <Link
          href={`/pets/${pet.id}/today`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-midnight-100 bg-midnight-50/60 px-3 py-2 text-xs font-bold text-midnight-600 hover:border-flash-400 hover:bg-flash-50 hover:text-midnight-900 transition-colors"
        >
          <Sun size={14} className="text-amber-500" /> Today
        </Link>
        <Link
          href={`/pets/${pet.id}/health`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-midnight-100 bg-midnight-50/60 px-3 py-2 text-xs font-bold text-midnight-600 hover:border-flash-400 hover:bg-flash-50 hover:text-midnight-900 transition-colors"
        >
          <ShieldIcon size={14} className="text-emerald-600" /> Health Book
        </Link>
      </div>
    </Card>
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
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading your pets..." />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  const firstName = session?.user?.firstName || session?.user?.name;

  return (
    <div className="min-h-screen bg-midnight-50 pb-24 lg:pb-12">
      {/* Warm header band: this is the daily product's home, in daylight */}
      <div className="bg-gradient-to-b from-flash-50 via-amber-50/40 to-midnight-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-6 flex justify-between items-end flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-midnight-900 tracking-tight">
              {firstName ? `${firstName}'s pets` : 'My Pets'}
            </h1>
            <p className="text-midnight-600 mt-2">
              Every Health Book, one tap away.
            </p>
          </div>
          <Button variant="primary" href="/pets/new" size="lg">
            <Plus size={18} />
            Add a pet
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-2">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl mb-6 flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-emerald-600 hover:text-emerald-800 transition-colors"
              aria-label="Dismiss"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Pending care-team invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-3 mb-8">
            {pendingInvites.map((invite) => (
              <Card key={invite.shareId} accent="yellow" padding="md" className="flex items-center gap-4 flex-wrap">
                <div className="w-12 h-12 rounded-xl bg-midnight-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {invite.pet.primaryPhotoUrl ? (
                    <img src={invite.pet.primaryPhotoUrl} alt={invite.pet.name} className="w-full h-full object-cover" />
                  ) : (
                    <SpeciesIcon species={invite.pet.species} size={24} className="text-midnight-400" />
                  )}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold text-midnight-900">
                    <HeartHandshake size={15} className="inline -mt-0.5 mr-1.5 text-flash-600" />
                    {invite.ownerName} shared {invite.pet.name} with you
                  </p>
                  <p className="text-sm text-midnight-500">
                    As {invite.role === 'CAREGIVER' ? 'a caregiver, so you can track and log their medications' : 'a viewer, so you can see their profile and schedule'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => respondToInvite(invite, true)}
                    loading={respondingId === invite.shareId}
                  >
                    <Check size={14} />
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => respondToInvite(invite, false)}
                    disabled={respondingId === invite.shareId}
                  >
                    Decline
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pet Grid */}
        {pets.length === 0 && sharedPets.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="Start their Health Book"
            description="Medications with one-tap logging, vaccine records, weight over time, and a link any vet or sitter can read. Free forever."
            action={{ href: '/pets/new', label: 'Add your first pet', icon: Plus }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                badge={caseBadge(pet)}
                byline={[
                  pet.breed || pet.species,
                  pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`,
                  pet.microchipId && 'Microchipped',
                ].filter(Boolean).join(' · ')}
              />
            ))}
          </div>
        )}

        {/* Shared with me */}
        {sharedPets.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold text-midnight-900 mb-1 flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-flash-500" /> Shared with me
            </h2>
            <p className="text-midnight-500 text-sm mb-4">Pets you help care for</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedPets.map(({ shareId, role, ownerName, pet }) => (
                <PetCard
                  key={shareId}
                  pet={pet}
                  badge={{
                    node: (
                      <Badge variant={role === 'CAREGIVER' ? 'primary' : 'default'}>
                        {role === 'CAREGIVER' ? 'Caregiver' : 'Viewer'}
                      </Badge>
                    ),
                  }}
                  byline={`${ownerName}'s pet · ${pet.breed || pet.species}`}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-midnight-400 mt-12">
          A record you keep, not medical advice. Your vet&apos;s guidance comes first.
        </p>
      </div>
    </div>
  );
}
