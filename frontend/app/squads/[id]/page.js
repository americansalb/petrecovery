'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SquadDetailsPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchSquad();
  }, [params.id]);

  const fetchSquad = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/squads/${params.id}`);
      if (!res.ok) {
        throw new Error('Squad not found');
      }
      const data = await res.json();
      setSquad(data.squad);
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

    if (!squad.canJoin) {
      setError('You must be a member of the community to join this squad');
      return;
    }

    try {
      setJoining(true);
      setError('');

      const res = await fetch(`/api/squads/${params.id}/join`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join squad');
      }

      await fetchSquad(); // Refresh
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this squad?')) {
      return;
    }

    try {
      setJoining(true);
      setError('');

      const res = await fetch(`/api/squads/${params.id}/leave`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to leave squad');
      }

      await fetchSquad(); // Refresh
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      OWNER: 'Pet Owner',
      LEADER: 'Squad Leader',
      MEMBER: 'Member'
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      OWNER: { bg: '#fef3c7', color: '#92400e' },
      LEADER: { bg: '#dbeafe', color: '#1e40af' },
      MEMBER: { bg: '#f3f4f6', color: '#374151' }
    };
    return colors[role] || colors.MEMBER;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>Loading squad...</div>
      </div>
    );
  }

  if (error && !squad) {
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
        <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>Squad not found</div>
        <Link
          href="/dashboard"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '700'
          }}
        >
          ← Back to Dashboard
        </Link>
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
        {/* Squad Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '3rem',
          marginBottom: '2rem',
          color: 'white',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
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
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: '700',
                marginBottom: '1rem'
              }}>
                {squad.status === 'ACTIVE' ? '🟢 ACTIVE SQUAD' : '⚪ CLOSED'}
              </div>
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: '900',
                marginBottom: '1rem'
              }}>
                {squad.name}
              </h1>
              <div style={{
                fontSize: '1.1rem',
                opacity: 0.95,
                marginBottom: '1.5rem'
              }}>
                Helping find <strong>{squad.report.petName}</strong> • {squad.community.name}
              </div>

              {/* Stats */}
              <div style={{
                display: 'flex',
                gap: '2rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: '900' }}>{squad.memberCount}</div>
                  <div style={{ opacity: 0.9 }}>Members</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: '900' }}>{squad.searchAreasMarked}</div>
                  <div style={{ opacity: 0.9 }}>Areas Searched</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: '900' }}>{squad.totalAcreageSearched.toFixed(1)}</div>
                  <div style={{ opacity: 0.9 }}>Acres Covered</div>
                </div>
              </div>
            </div>

            {/* Join/Leave Button */}
            <div>
              {squad.userMembership ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
                  <div style={{
                    padding: '1rem 2rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '1.1rem'
                  }}>
                    ✓ {getRoleLabel(squad.userMembership.role)}
                  </div>
                  {squad.userMembership.role !== 'OWNER' && (
                    <button
                      onClick={handleLeave}
                      disabled={joining}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(255, 255, 255, 0.9)',
                        color: '#ef4444',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        cursor: joining ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Leave Squad
                    </button>
                  )}
                </div>
              ) : squad.canJoin ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  style={{
                    padding: '1.25rem 2.5rem',
                    background: 'white',
                    color: '#667eea',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    cursor: joining ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  {joining ? 'Joining...' : 'Join Squad'}
                </button>
              ) : !session ? (
                <Link
                  href="/login"
                  style={{
                    display: 'inline-block',
                    padding: '1.25rem 2.5rem',
                    background: 'white',
                    color: '#667eea',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '700',
                    fontSize: '1.1rem'
                  }}
                >
                  Sign In to Join
                </Link>
              ) : (
                <div style={{
                  padding: '1rem 2rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  fontSize: '0.95rem'
                }}>
                  Join the community first to participate
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(254, 226, 226, 0.9)',
              borderRadius: '8px',
              color: '#991b1b'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Lost Pet Info */}
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
            About {squad.report.petName}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: squad.report.photoUrl ? '200px 1fr' : '1fr',
            gap: '2rem'
          }}>
            {squad.report.photoUrl && (
              <img
                src={squad.report.photoUrl}
                alt={squad.report.petName}
                style={{
                  width: '200px',
                  height: '200px',
                  objectFit: 'cover',
                  borderRadius: '12px'
                }}
              />
            )}
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Species</div>
                  <div style={{ fontWeight: '600' }}>{squad.report.species}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Breed</div>
                  <div style={{ fontWeight: '600' }}>{squad.report.breed || 'Unknown'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Color</div>
                  <div style={{ fontWeight: '600' }}>{squad.report.color}</div>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Last Seen</div>
                <div style={{ fontWeight: '600' }}>
                  {squad.report.lastSeenAddress} • {new Date(squad.report.lastSeenDate).toLocaleDateString()}
                </div>
              </div>
              {squad.report.description && (
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Description</div>
                  <div style={{ lineHeight: '1.6', color: '#475569' }}>{squad.report.description}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Squad Members */}
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
            Squad Members ({squad.members.length})
          </h2>
          <div style={{
            display: 'grid',
            gap: '1rem'
          }}>
            {squad.members.map(member => {
              const roleColor = getRoleBadgeColor(member.role);
              return (
                <div
                  key={member.id}
                  style={{
                    padding: '1.5rem',
                    border: '2px solid #f1f5f9',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '0.5rem'
                    }}>
                      <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {member.firstName} {member.lastName}
                      </h3>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: roleColor.bg,
                        color: roleColor.color,
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        {getRoleLabel(member.role)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '1.5rem',
                      fontSize: '0.9rem',
                      color: '#64748b'
                    }}>
                      <div>{member.actionsCount} actions</div>
                      <div>{member.areasMarked} areas marked</div>
                      <div>{member.messagesSent} messages</div>
                      <div>Joined {new Date(member.joinedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coming Soon */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚧</div>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1rem'
          }}>
            More Squad Features Coming Soon
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            We're building chat, search area marking, pet spotting reports, and more!
          </p>
        </div>
      </div>
    </div>
  );
}
