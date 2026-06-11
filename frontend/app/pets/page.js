'use client';

/**
 * My Pets Page - Phase 1.3
 *
 * Route: /pets
 * Lists all pets belonging to the logged-in user
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dog, Cat, Bird, Rabbit, PawPrint, Plus, AlertTriangle, X, Loader2, HeartHandshake, Check, ChevronRight, Heart } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, Badge, EmptyState } from '@/components/ui';

const SPECIES_ICONS = {
  DOG: Dog,
  CAT: Cat,
  BIRD: Bird,
  RABBIT: Rabbit,
  OTHER: PawPrint,
};

export default function MyPetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pets, setPets] = useState([]);
  const [sharedPets, setSharedPets] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
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

  const handleDelete = (petId, petName) => {
    setConfirmDialog({ petId, petName });
  };

  const confirmDelete = async () => {
    if (!confirmDialog) return;

    const { petId, petName } = confirmDialog;
    setConfirmDialog(null);
    setDeletingId(petId);
    setError(null);

    try {
      const res = await fetch(`/api/pets/${petId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete pet');
      }

      setPets(pets.filter(p => p.id !== petId));
      setSuccessMessage(`${petName}'s profile has been deleted.`);
    } catch (err) {
      console.error('[PETS] Delete error:', err);
      setError(err.message);
    } finally {
      setDeletingId(null);
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

  const getSpeciesIcon = (species) => {
    return SPECIES_ICONS[species] || PawPrint;
  };

  const getSizeLabel = (size) => {
    const labels = {
      TINY: 'Tiny (<10 lbs)',
      SMALL: 'Small (10-25 lbs)',
      MEDIUM: 'Medium (25-50 lbs)',
      LARGE: 'Large (50-90 lbs)',
      GIANT: 'Giant (90+ lbs)',
    };
    return labels[size] || size;
  };

  const getCaseStatus = (pet) => {
    if (!pet.cases || pet.cases.length === 0) return null;
    const latestCase = pet.cases[0];
    return latestCase.status;
  };

  const getCaseStatusBadge = (status) => {
    const badges = {
      OPEN: { variant: 'warning', label: 'Missing' },
      ACTIVE_SEARCH: { variant: 'primary', label: 'Active Search' },
      RESOLVED: { variant: 'success', label: 'Found' },
      CLOSED_OTHER: { variant: 'default', label: 'Closed' },
    };
    return badges[status] || null;
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

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-12">
      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-midnight-900 mb-3">
              Delete Pet Profile?
            </h3>
            <p className="text-midnight-600 mb-6">
              Are you sure you want to delete <strong>{confirmDialog.petName}</strong>&apos;s profile? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmDialog(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                className="flex-1"
              >
                Yes, Delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-green-600 hover:text-green-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-midnight-900">
              My Pets
            </h1>
            <p className="text-midnight-600 mt-2">
              The whole family, one tap away.
            </p>
          </div>
          <Button
            variant="primary"
            href="/pets/new"
            size="lg"
          >
            <Plus size={18} />
            Add Pet
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Pending share invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-3 mb-8">
            {pendingInvites.map((invite) => (
              <Card key={invite.shareId} accent="yellow" padding="md" className="flex items-center gap-4 flex-wrap">
                <div className="w-12 h-12 rounded-xl bg-midnight-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {invite.pet.primaryPhotoUrl ? (
                    <img src={invite.pet.primaryPhotoUrl} alt={invite.pet.name} className="w-full h-full object-cover" />
                  ) : (
                    <PawPrint className="w-6 h-6 text-midnight-400" />
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
        {pets.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="No pets registered yet"
            description="Add your pets now so you can quickly create a lost pet report if they ever go missing."
            action={{ href: '/pets/new', label: 'Add Your First Pet', icon: Plus }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet) => {
              const missionStatus = getCaseStatus(pet);
              const badgeInfo = missionStatus ? getCaseStatusBadge(missionStatus) : null;
              const SpeciesIcon = getSpeciesIcon(pet.species);

              return (
                <Link key={pet.id} href={`/pets/${pet.id}`} className="group block">
                  <Card padding="none" className="overflow-hidden border-2 border-transparent group-hover:border-flash-400 group-hover:shadow-xl group-hover:-translate-y-1 transition-all">
                    <div className="aspect-[4/3] bg-midnight-100 relative flex items-center justify-center">
                      {pet.primaryPhotoUrl ? (
                        <img
                          src={pet.primaryPhotoUrl}
                          alt={pet.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <SpeciesIcon className="w-16 h-16 text-midnight-300" />
                      )}
                      <div className="absolute top-3 right-3">
                        {badgeInfo ? (
                          <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-emerald-700 text-xs font-bold">
                            <Heart size={11} /> Home
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-midnight-900 truncate group-hover:text-flash-600 transition-colors">
                          {pet.name}
                        </h3>
                        <p className="text-sm text-midnight-500 truncate">
                          {[pet.breed || pet.species, pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`, pet.microchipId && 'Microchipped'].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-midnight-300 group-hover:text-flash-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </Card>
                </Link>
              );
            })}
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
              {sharedPets.map(({ shareId, role, ownerName, pet }) => {
                const SpeciesIcon = getSpeciesIcon(pet.species);
                return (
                  <Link key={shareId} href={`/pets/${pet.id}`} className="group block">
                    <Card padding="none" className="overflow-hidden border-2 border-transparent group-hover:border-flash-400 group-hover:shadow-xl group-hover:-translate-y-1 transition-all">
                      <div className="aspect-[4/3] bg-midnight-100 relative flex items-center justify-center">
                        {pet.primaryPhotoUrl ? (
                          <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <SpeciesIcon className="w-16 h-16 text-midnight-300" />
                        )}
                        <div className="absolute top-3 right-3">
                          <Badge variant={role === 'CAREGIVER' ? 'primary' : 'default'}>
                            {role === 'CAREGIVER' ? 'Caregiver' : 'Viewer'}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-midnight-900 truncate group-hover:text-flash-600 transition-colors">{pet.name}</h3>
                          <p className="text-sm text-midnight-500 truncate">{ownerName}&apos;s pet · {pet.breed || pet.species}</p>
                        </div>
                        <ChevronRight size={18} className="text-midnight-300 group-hover:text-flash-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
