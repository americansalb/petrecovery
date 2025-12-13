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
import { Dog, Cat, Bird, Rabbit, PawPrint, Plus, Edit2, AlertTriangle, Eye, Trash2, X, Loader2, Info } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('[PETS] User not authenticated, redirecting to login');
      router.push('/login?callbackUrl=/pets');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPets();
    }
  }, [status]);

  const fetchPets = async () => {
    console.log('[PETS] Fetching pets list');
    try {
      const res = await fetch('/api/pets');
      console.log('[PETS] Response status:', res.status);
      if (!res.ok) throw new Error('Failed to fetch pets');
      const data = await res.json();
      console.log('[PETS] Fetched pets:', data.pets?.length || 0);
      setPets(data.pets || []);
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

    console.log('[PETS] Deleting pet:', petId);

    try {
      const res = await fetch(`/api/pets/${petId}`, { method: 'DELETE' });
      const data = await res.json();
      console.log('[PETS] Delete response:', res.status, data);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete pet');
      }

      console.log('[PETS] Pet deleted successfully');
      setPets(pets.filter(p => p.id !== petId));
      setSuccessMessage(`${petName}'s profile has been deleted.`);
    } catch (err) {
      console.error('[PETS] Delete error:', err);
      setError(err.message);
    } finally {
      setDeletingId(null);
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
              Pre-register your pets so you can quickly report if they go missing
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

        {/* Pet Grid */}
        {pets.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="No pets registered yet"
            description="Add your pets now so you can quickly create a lost pet report if they ever go missing."
            actionLabel="Add Your First Pet"
            actionHref="/pets/new"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet) => {
              const missionStatus = getCaseStatus(pet);
              const badgeInfo = missionStatus ? getCaseStatusBadge(missionStatus) : null;
              const SpeciesIcon = getSpeciesIcon(pet.species);

              return (
                <Card key={pet.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Pet Photo */}
                  <div className="h-48 bg-midnight-100 flex items-center justify-center relative">
                    {pet.primaryPhotoUrl ? (
                      <img
                        src={pet.primaryPhotoUrl}
                        alt={pet.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <SpeciesIcon className="w-16 h-16 text-midnight-400" />
                    )}

                    {/* Status Badge */}
                    {badgeInfo && (
                      <div className="absolute top-3 right-3">
                        <Badge variant={badgeInfo.variant}>
                          {badgeInfo.label}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Pet Info */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <SpeciesIcon className="w-5 h-5 text-flash-500" />
                      <h3 className="text-xl font-semibold text-midnight-900">
                        {pet.name}
                      </h3>
                    </div>

                    <div className="text-midnight-600 text-sm mb-4">
                      <p className="mb-1">
                        {pet.breed || pet.species} {pet.sex && `• ${pet.sex.charAt(0) + pet.sex.slice(1).toLowerCase()}`}
                      </p>
                      <p>
                        {pet.color} • {getSizeLabel(pet.size).split(' ')[0]}
                        {pet.age && ` • ${pet.age} year${pet.age !== 1 ? 's' : ''} old`}
                      </p>
                    </div>

                    {/* Microchip indicator */}
                    {pet.microchipId && (
                      <Badge variant="success" className="mb-4">
                        Microchipped
                      </Badge>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-midnight-100">
                      <Button
                        variant="ghost"
                        href={`/pets/${pet.id}`}
                        size="sm"
                        className="flex-1"
                      >
                        <Edit2 size={14} />
                        Edit
                      </Button>
                      {!missionStatus || missionStatus === 'RESOLVED' || missionStatus === 'CLOSED_OTHER' ? (
                        <Button
                          variant="danger"
                          href={`/report/new?petId=${pet.id}`}
                          size="sm"
                          className="flex-[2]"
                        >
                          <AlertTriangle size={14} />
                          Report Lost
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          href={`/missions/${pet.cases[0].caseNumber}`}
                          size="sm"
                          className="flex-[2]"
                        >
                          <Eye size={14} />
                          View Case
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(pet.id, pet.name)}
                        disabled={deletingId === pet.id}
                        className="p-2 border border-midnight-200 text-midnight-600 rounded-lg hover:bg-midnight-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Delete pet"
                      >
                        {deletingId === pet.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Help Text */}
        <Card variant="primary" className="mt-8 p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-flash-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-midnight-900 mb-2">
                Why register your pets?
              </h3>
              <ul className="space-y-1 text-midnight-700 text-sm">
                <li>• Quickly report a lost pet with all their details pre-filled</li>
                <li>• Store important info like microchip numbers and medical conditions</li>
                <li>• Keep photos ready for flyers and social media</li>
                <li>• Help rescuers identify your pet faster</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
