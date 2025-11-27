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
import LoadingSpinner from '@/app/components/LoadingSpinner';

export default function MyPetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (petId, petName) => {
    if (!confirm(`Are you sure you want to delete ${petName}'s profile? This cannot be undone.`)) {
      return;
    }

    setDeletingId(petId);
    try {
      const res = await fetch(`/api/pets/${petId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete pet');
      }

      setPets(pets.filter(p => p.id !== petId));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getSpeciesEmoji = (species) => {
    const emojis = {
      DOG: '🐕',
      CAT: '🐈',
      BIRD: '🐦',
      RABBIT: '🐰',
      OTHER: '🐾',
    };
    return emojis[species] || '🐾';
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
      OPEN: { bg: '#fef3c7', color: '#92400e', label: 'Missing' },
      ACTIVE_SEARCH: { bg: '#dbeafe', color: '#1e40af', label: 'Active Search' },
      RESOLVED: { bg: '#dcfce7', color: '#166534', label: 'Found' },
      CLOSED_OTHER: { bg: '#f3f4f6', color: '#374151', label: 'Closed' },
    };
    return badges[status] || null;
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading your pets..." />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              My Pets
            </h1>
            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
              Pre-register your pets so you can quickly report if they go missing
            </p>
          </div>
          <Link
            href="/pets/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#2563eb',
              color: 'white',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.95rem',
            }}
          >
            + Add Pet
          </Link>
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#dc2626',
            marginBottom: '1.5rem',
          }}>
            {error}
          </div>
        )}

        {/* Pet Grid */}
        {pets.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🐾</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.5rem' }}>
              No pets registered yet
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              Add your pets now so you can quickly create a lost pet report if they ever go missing.
            </p>
            <Link
              href="/pets/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: '#2563eb',
                color: 'white',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              + Add Your First Pet
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem',
          }}>
            {pets.map((pet) => {
              const caseStatus = getCaseStatus(pet);
              const badge = caseStatus ? getCaseStatusBadge(caseStatus) : null;

              return (
                <div
                  key={pet.id}
                  style={{
                    background: 'white',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  {/* Pet Photo */}
                  <div style={{
                    height: '200px',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {pet.primaryPhotoUrl ? (
                      <img
                        src={pet.primaryPhotoUrl}
                        alt={pet.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '4rem' }}>{getSpeciesEmoji(pet.species)}</span>
                    )}

                    {/* Status Badge */}
                    {badge && (
                      <div style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        background: badge.bg,
                        color: badge.color,
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}>
                        {badge.label}
                      </div>
                    )}
                  </div>

                  {/* Pet Info */}
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                    }}>
                      <span style={{ fontSize: '1.25rem' }}>{getSpeciesEmoji(pet.species)}</span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                        {pet.name}
                      </h3>
                    </div>

                    <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      <p style={{ margin: '0.25rem 0' }}>
                        {pet.breed || pet.species} {pet.sex && `• ${pet.sex.charAt(0) + pet.sex.slice(1).toLowerCase()}`}
                      </p>
                      <p style={{ margin: '0.25rem 0' }}>
                        {pet.color} • {getSizeLabel(pet.size).split(' ')[0]}
                        {pet.age && ` • ${pet.age} year${pet.age !== 1 ? 's' : ''} old`}
                      </p>
                    </div>

                    {/* Microchip indicator */}
                    {pet.microchipId && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        background: '#dcfce7',
                        color: '#166534',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        marginBottom: '1rem',
                      }}>
                        <span>💉</span> Microchipped
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid #f1f5f9',
                    }}>
                      <Link
                        href={`/pets/${pet.id}`}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: '#f1f5f9',
                          color: '#475569',
                          borderRadius: '0.375rem',
                          textDecoration: 'none',
                          textAlign: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                        }}
                      >
                        Edit
                      </Link>
                      {!caseStatus || caseStatus === 'RESOLVED' || caseStatus === 'CLOSED_OTHER' ? (
                        <Link
                          href={`/cases/report?petId=${pet.id}`}
                          style={{
                            flex: 2,
                            padding: '0.5rem',
                            background: '#dc2626',
                            color: 'white',
                            borderRadius: '0.375rem',
                            textDecoration: 'none',
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                          }}
                        >
                          Report Lost
                        </Link>
                      ) : (
                        <Link
                          href={`/cases/${pet.cases[0].caseNumber}`}
                          style={{
                            flex: 2,
                            padding: '0.5rem',
                            background: '#2563eb',
                            color: 'white',
                            borderRadius: '0.375rem',
                            textDecoration: 'none',
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                          }}
                        >
                          View Case
                        </Link>
                      )}
                      <button
                        onClick={() => handleDelete(pet.id, pet.name)}
                        disabled={deletingId === pet.id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          color: '#64748b',
                          borderRadius: '0.375rem',
                          cursor: deletingId === pet.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          opacity: deletingId === pet.id ? 0.5 : 1,
                        }}
                      >
                        {deletingId === pet.id ? '...' : '🗑️'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help Text */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#eff6ff',
          borderRadius: '0.75rem',
          border: '1px solid #bfdbfe',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
            Why register your pets?
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3b82f6', fontSize: '0.9rem' }}>
            <li>Quickly report a lost pet with all their details pre-filled</li>
            <li>Store important info like microchip numbers and medical conditions</li>
            <li>Keep photos ready for flyers and social media</li>
            <li>Help rescuers identify your pet faster</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
