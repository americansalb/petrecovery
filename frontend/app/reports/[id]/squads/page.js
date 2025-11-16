'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ReportSquadsPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [canCreateSquad, setCanCreateSquad] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [communities, setCommunities] = useState([]);
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSquads();
    if (session?.user?.id) {
      fetchCommunities();
    }
  }, [params.id, session]);

  const fetchSquads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/${params.id}/squads`);
      if (!res.ok) {
        throw new Error('Failed to fetch squads');
      }
      const data = await res.json();
      setSquads(data.squads);
      setIsOwner(data.isOwner);
      setCanCreateSquad(data.canCreateSquad);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommunities = async () => {
    try {
      // Get communities where user is an approved member
      const res = await fetch('/api/communities');
      if (res.ok) {
        const data = await res.json();
        const approvedCommunities = data.communities.filter(
          c => c.userMembership?.status === 'APPROVED'
        );
        setCommunities(approvedCommunities);
      }
    } catch (err) {
      console.error('Error fetching communities:', err);
    }
  };

  const handleCreateSquad = async () => {
    if (!selectedCommunity) {
      setError('Please select a community');
      return;
    }

    try {
      setCreating(true);
      setError('');

      const res = await fetch('/api/squads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: params.id,
          communityId: selectedCommunity
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create squad');
      }

      setShowCreateModal(false);
      setSelectedCommunity('');
      await fetchSquads(); // Refresh list

      // Navigate to the new squad
      router.push(`/squads/${data.squad.id}`);

    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>Loading squads...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc'
    }}>
      {/* Header Navigation */}
      <div style={{
        background: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Link
            href="/"
            style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#1e293b',
              textDecoration: 'none'
            }}
          >
            🐾 PetRecovery
          </Link>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              href={`/reports/${params.id}`}
              style={{
                padding: '0.5rem 1rem',
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '600'
              }}
            >
              ← Back to Report
            </Link>
            {session && (
              <Link
                href="/dashboard"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  color: '#64748b',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem 3rem'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Recovery Squads
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Active volunteer teams helping with this search
            </p>
          </div>

          {canCreateSquad && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '1rem 2rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              + Create New Squad
            </button>
          )}
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
            marginBottom: '2rem'
          }}>
            {error}
          </div>
        )}

        {/* Squads Grid */}
        {squads.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👥</div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              No Recovery Squads Yet
            </h2>
            <p style={{
              color: '#64748b',
              marginBottom: '2rem',
              fontSize: '1.1rem'
            }}>
              {isOwner
                ? 'Create a squad to organize volunteers in specific communities'
                : 'The pet owner hasn\'t created any squads yet'}
            </p>
            {canCreateSquad && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '1rem 2rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Create First Squad
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem'
          }}>
            {squads.map(squad => (
              <Link
                key={squad.id}
                href={`/squads/${squad.id}`}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                  border: '2px solid #f1f5f9',
                  transition: 'all 0.2s',
                  display: 'block'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#f1f5f9';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: '#0f172a',
                      marginBottom: '0.5rem'
                    }}>
                      {squad.community.name}
                    </h3>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#64748b'
                    }}>
                      {squad.community.type === 'METRO_AREA' && '🌆 Metro Area'}
                      {squad.community.type === 'COUNTY' && '🏞️ County'}
                      {squad.community.type === 'SUBCOMMUNITY' && '🏘️ Subcommunity'}
                    </div>
                  </div>
                  {squad.userMembership && (
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: '#d1fae5',
                      color: '#065f46',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      Joined
                    </span>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  padding: '1rem 0',
                  borderTop: '1px solid #f1f5f9',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>
                      {squad.memberCount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Members</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>
                      {squad.searchAreasMarked}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Areas</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>
                      {squad.spottingsReported}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Spottings</div>
                  </div>
                </div>

                <div style={{
                  marginTop: '1rem',
                  fontSize: '0.9rem',
                  color: '#667eea',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  View Squad Details →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Squad Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              marginBottom: '1rem',
              color: '#0f172a'
            }}>
              Create Recovery Squad
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#64748b',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              Select a community where you want to organize volunteers for this search.
            </p>

            {error && (
              <div style={{
                padding: '0.75rem',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                color: '#0f172a'
              }}>
                Select Community *
              </label>
              <select
                value={selectedCommunity}
                onChange={(e) => setSelectedCommunity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Choose a community...</option>
                {communities.map(community => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
              {communities.length === 0 && (
                <p style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  marginTop: '0.5rem'
                }}>
                  You need to join a community first to create a squad
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                  setSelectedCommunity('');
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSquad}
                disabled={creating || !selectedCommunity}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: creating || !selectedCommunity ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: creating || !selectedCommunity ? 'not-allowed' : 'pointer'
                }}
              >
                {creating ? 'Creating...' : 'Create Squad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
