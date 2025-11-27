'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DivisionDetailPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [division, setDivision] = useState(null);
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [legalError, setLegalError] = useState(null);
  const [isSquadMember, setIsSquadMember] = useState(false);
  const [isDivisionMember, setIsDivisionMember] = useState(false);
  const [userMembership, setUserMembership] = useState(null);

  useEffect(() => {
    loadDivision();
  }, [params.id, params.divisionId, session]);

  const loadDivision = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load division');
      }

      setDivision(data.division);
      setSquad(data.squad);
      setIsSquadMember(data.isSquadMember);
      setIsDivisionMember(data.isDivisionMember);
      setUserMembership(data.userMembership);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinDivision = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}/divisions/${params.divisionId}`);
      return;
    }

    if (!isSquadMember) {
      setError('You must join the squad before joining a division.');
      return;
    }

    setJoining(true);
    setError('');
    setLegalError(null);

    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}/join`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for legal consent requirement
        if (res.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          return;
        }

        throw new Error(data.error || 'Failed to join division');
      }

      setIsDivisionMember(true);
      loadDivision(); // Reload to show updated member count
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
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{
          fontSize: '1.2rem',
          color: '#64748b'
        }}>
          Loading division details...
        </div>
      </div>
    );
  }

  if (error || !division) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '2rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          maxWidth: '500px'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#dc2626',
            marginBottom: '1rem'
          }}>
            Division Not Found
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            {error || 'The division you\'re looking for doesn\'t exist.'}
          </p>
          <Link
            href={`/rescue-squads/${params.id}`}
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700'
            }}
          >
            Back to Squad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Breadcrumb */}
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.95rem'
        }}>
          <Link
            href="/rescue-squads"
            style={{ color: '#667eea', textDecoration: 'none' }}
          >
            Rescue Squads
          </Link>
          <span style={{ color: '#94a3b8' }}>/</span>
          <Link
            href={`/rescue-squads/${params.id}`}
            style={{ color: '#667eea', textDecoration: 'none' }}
          >
            {squad?.name || 'Squad'}
          </Link>
          <span style={{ color: '#94a3b8' }}>/</span>
          <span style={{ color: '#64748b' }}>{division.name}</span>
        </div>

        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}>
                  {division.name.toLowerCase().includes('search') ? '🔍' :
                   division.name.toLowerCase().includes('transport') ? '🚗' :
                   division.name.toLowerCase().includes('medical') ? '⚕️' :
                   division.name.toLowerCase().includes('comm') ? '📡' :
                   division.name.toLowerCase().includes('train') ? '📚' :
                   '⭐'}
                </div>
                <div>
                  <h1 style={{
                    fontSize: '2rem',
                    fontWeight: '900',
                    color: '#0f172a',
                    marginBottom: '0.25rem'
                  }}>
                    {division.name}
                  </h1>
                  <p style={{
                    fontSize: '1rem',
                    color: '#64748b'
                  }}>
                    Part of {squad?.name}
                  </p>
                </div>
              </div>

              {division.description && (
                <p style={{
                  fontSize: '1.05rem',
                  color: '#475569',
                  lineHeight: '1.6',
                  marginBottom: '1rem'
                }}>
                  {division.description}
                </p>
              )}

              {squad && (
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  fontSize: '0.95rem',
                  color: '#64748b'
                }}>
                  <span>📍 {squad.city}, {squad.state}</span>
                  {division.totalMembers > 0 && (
                    <span>👥 {division.totalMembers} member{division.totalMembers === 1 ? '' : 's'}</span>
                  )}
                </div>
              )}
            </div>

            {/* Join/Status Button */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'flex-end'
            }}>
              {isDivisionMember ? (
                <div style={{
                  padding: '1rem 2rem',
                  background: '#d1fae5',
                  border: '2px solid #10b981',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem',
                  color: '#065f46'
                }}>
                  You're in this Division
                </div>
              ) : isSquadMember ? (
                <button
                  onClick={handleJoinDivision}
                  disabled={joining}
                  style={{
                    padding: '1rem 2rem',
                    background: joining ? '#cbd5e1' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '1rem',
                    cursor: joining ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  {joining ? 'Joining...' : 'Join This Division'}
                </button>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  alignItems: 'flex-end'
                }}>
                  <div style={{
                    padding: '0.75rem 1.5rem',
                    background: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#92400e'
                  }}>
                    Join the squad first
                  </div>
                  <Link
                    href={`/rescue-squads/${params.id}`}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#10b981',
                      color: 'white',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '700',
                      fontSize: '0.95rem'
                    }}
                  >
                    Go to Squad Page
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Legal Consent Required Banner */}
          {legalError && (
            <div style={{
              padding: '1.5rem',
              background: '#fef3c7',
              border: '2px solid #fbbf24',
              borderRadius: '12px',
              marginTop: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', color: '#92400e', marginBottom: '0.25rem' }}>
                    Legal Agreement Required
                  </div>
                  <div style={{ color: '#b45309', fontSize: '0.95rem' }}>
                    {legalError.message}
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push(legalError.redirectTo)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Review & Accept Now
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && !legalError && (
            <div style={{
              padding: '1rem',
              background: '#fee2e2',
              border: '2px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginTop: '1.5rem',
              fontWeight: '600'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Division Members
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#667eea'
            }}>
              {division.totalMembers || 0}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Status
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: division.isActive ? '#10b981' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: division.isActive ? '#10b981' : '#94a3b8'
              }}></span>
              {division.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Parent Squad
            </div>
            <Link
              href={`/rescue-squads/${params.id}`}
              style={{
                fontSize: '1rem',
                fontWeight: '700',
                color: '#667eea',
                textDecoration: 'none'
              }}
            >
              {squad?.name || 'View Squad'}
            </Link>
          </div>
        </div>

        {/* Members List */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            color: '#0f172a',
            marginBottom: '1.5rem'
          }}>
            Division Members
          </h2>

          {division.members && division.members.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {division.members.map(member => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{
                      width: '45px',
                      height: '45px',
                      borderRadius: '50%',
                      background: member.role === 'FOUNDER' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                                 member.role === 'LEADER' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' :
                                 '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: '1.1rem'
                    }}>
                      {member.user.firstName?.[0] || '?'}
                    </div>
                    <div>
                      <div style={{
                        fontWeight: '700',
                        color: '#0f172a',
                        fontSize: '1.05rem'
                      }}>
                        {member.user.firstName} {member.user.lastName}
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#64748b'
                      }}>
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    padding: '0.4rem 1rem',
                    background: member.role === 'FOUNDER' ? '#fef3c7' :
                               member.role === 'LEADER' ? '#e0e7ff' :
                               '#f1f5f9',
                    color: member.role === 'FOUNDER' ? '#92400e' :
                           member.role === 'LEADER' ? '#4338ca' :
                           '#64748b',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '700'
                  }}>
                    {member.role}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              background: '#f8fafc',
              borderRadius: '12px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                No members yet
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                Be the first to join this division!
              </div>
            </div>
          )}
        </div>

        {/* Back to Squad Link */}
        <div style={{
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <Link
            href={`/rescue-squads/${params.id}`}
            style={{
              color: '#667eea',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            ← Back to {squad?.name || 'Squad'}
          </Link>
        </div>
      </div>
    </div>
  );
}
