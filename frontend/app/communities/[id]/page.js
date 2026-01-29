'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CommunityPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  useEffect(() => {
    fetchCommunity();
  }, [params.id]);

  const fetchCommunity = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/communities/${params.id}`);
      if (!res.ok) {
        throw new Error('Community not found');
      }
      const data = await res.json();
      setCommunity(data.community);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }

    try {
      setJoining(true);
      setError('');

      const res = await fetch(`/api/communities/${params.id}/join`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join community');
      }

      // Refresh community data
      await fetchCommunity();
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    setLeaveConfirmOpen(true);
  };

  const confirmLeave = async () => {
    setLeaveConfirmOpen(false);

    try {
      setJoining(true);
      setError('');

      const res = await fetch(`/api/communities/${params.id}/leave`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to leave community');
      }

      // Refresh community data
      await fetchCommunity();
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
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
        <div>Loading community...</div>
      </div>
    );
  }

  if (error && !community) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '3rem' }}>❌</div>
        <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>Community not found</div>
        <Link
          href="/communities"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '700'
          }}
        >
          ← Back to Communities
        </Link>
      </div>
    );
  }

  const getJoinButton = () => {
    if (!session) {
      return (
        <button
          onClick={handleJoin}
          style={{
            padding: '1rem 2rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Sign In to Join
        </button>
      );
    }

    if (!community.userMembership) {
      return (
        <button
          onClick={handleJoin}
          disabled={joining}
          style={{
            padding: '1rem 2rem',
            background: joining ? '#cbd5e1' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            cursor: joining ? 'not-allowed' : 'pointer',
            fontSize: '1rem'
          }}
        >
          {joining ? 'Joining...' : 'Request to Join'}
        </button>
      );
    }

    const { status, role } = community.userMembership;

    if (status === 'PENDING') {
      return (
        <div style={{
          padding: '1rem 2rem',
          background: '#fef3c7',
          color: '#92400e',
          borderRadius: '8px',
          fontWeight: '700'
        }}>
          ⏳ Membership Pending
        </div>
      );
    }

    if (status === 'APPROVED') {
      return (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{
            padding: '1rem 2rem',
            background: '#d1fae5',
            color: '#065f46',
            borderRadius: '8px',
            fontWeight: '700'
          }}>
            ✓ {role === 'MODERATOR' ? 'Moderator' : 'Member'}
          </div>
          <button
            onClick={handleLeave}
            disabled={joining}
            style={{
              padding: '1rem 1.5rem',
              background: 'white',
              color: '#ef4444',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: joining ? 'not-allowed' : 'pointer'
            }}
          >
            Leave
          </button>
        </div>
      );
    }

    if (status === 'REJECTED') {
      return (
        <div style={{
          padding: '1rem 2rem',
          background: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          fontWeight: '700'
        }}>
          ❌ Join Request Rejected
        </div>
      );
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc'
    }}>
      {/* Leave Confirmation Dialog */}
      {leaveConfirmOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#0f172a' }}>
              Leave Community?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Are you sure you want to leave <strong>{community?.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setLeaveConfirmOpen(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLeave}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Yes, Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem 3rem'
      }}>

        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '2rem'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: '0.5rem',
                fontWeight: '600'
              }}>
                {community.type === 'METRO_AREA' && '🌆 Metro Area'}
                {community.type === 'COUNTY' && '🏞️ County'}
                {community.type === 'SUBCOMMUNITY' && '🏘️ Subcommunity'}
              </div>
              <h1 style={{
                fontSize: '3rem',
                fontWeight: '900',
                color: '#0f172a',
                marginBottom: '1rem'
              }}>
                {community.name}
              </h1>
              {community.description && (
                <p style={{
                  fontSize: '1.1rem',
                  color: '#64748b',
                  lineHeight: '1.6',
                  marginBottom: '1.5rem'
                }}>
                  {community.description}
                </p>
              )}

              <div style={{
                display: 'flex',
                gap: '2rem',
                fontSize: '1rem',
                color: '#64748b'
              }}>
                <div>
                  <strong style={{ color: '#0f172a', fontSize: '1.5rem' }}>{community.memberCount}</strong>
                  <div>Members</div>
                </div>
                {community.activeSquadsCount > 0 && (
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '1.5rem' }}>{community.activeSquadsCount}</strong>
                    <div>Active Squads</div>
                  </div>
                )}
                {community.subcommunityCount > 0 && (
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '1.5rem' }}>{community.subcommunityCount}</strong>
                    <div>Subcommunities</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              {getJoinButton()}
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#fee2e2',
              border: '2px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Subcommunities */}
        {community.subcommunities && community.subcommunities.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Subcommunities
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {community.subcommunities.map(sub => (
                <Link
                  key={sub.id}
                  href={`/communities/${sub.id}`}
                  style={{
                    padding: '1.5rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    border: '2px solid #e2e8f0',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#667eea'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '0.5rem'
                  }}>
                    {sub.name}
                  </h3>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#64748b'
                  }}>
                    {sub.memberCount} members
                    {sub.activeSquadsCount > 0 && ` • ${sub.activeSquadsCount} active forces`}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Community Actions */}
        {community.userMembership?.status === 'APPROVED' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Quick Actions
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <Link
                href="/report-lost"
                style={{
                  padding: '1.5rem',
                  background: '#fee2e2',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  textAlign: 'center',
                  border: '2px solid #fecaca',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔴</div>
                <div style={{ fontWeight: '700', color: '#991b1b' }}>Report Lost Pet</div>
              </Link>
              <Link
                href="/report-found"
                style={{
                  padding: '1.5rem',
                  background: '#d1fae5',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  textAlign: 'center',
                  border: '2px solid #a7f3d0',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🟢</div>
                <div style={{ fontWeight: '700', color: '#065f46' }}>Report Found Pet</div>
              </Link>
              <Link
                href="/dashboard"
                style={{
                  padding: '1.5rem',
                  background: '#dbeafe',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  textAlign: 'center',
                  border: '2px solid #bfdbfe',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <div style={{ fontWeight: '700', color: '#1e40af' }}>My Dashboard</div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
