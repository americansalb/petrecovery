'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RescueSquadDetailPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    loadSquad();
  }, [params.id, session]);

  const loadSquad = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${params.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load squad');
      }

      setSquad(data.squad);

      // Check if current user is a member
      if (session?.user?.id && data.squad.members) {
        const memberExists = data.squad.members.some(
          m => m.userId === session.user.id && m.isActive
        );
        setIsMember(memberExists);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}`);
      return;
    }

    setJoining(true);
    setError('');

    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/join`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join squad');
      }

      setIsMember(true);
      loadSquad(); // Reload to show updated member count
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
          Loading squad details...
        </div>
      </div>
    );
  }

  if (error || !squad) {
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
            Squad Not Found
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            {error || 'The rescue squad you\'re looking for doesn\'t exist.'}
          </p>
          <Link
            href="/rescue-squads"
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
            ← Browse Rescue Squads
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
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1 }}>
            <Link
              href="/rescue-squads"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '600',
                marginBottom: '1rem',
                display: 'inline-block'
              }}
            >
              ← Back to Rescue Squads
            </Link>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              {squad.name}
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              {squad.description || 'Volunteer rescue squad'}
            </p>
          </div>

          {/* Join Button */}
          {!isMember && (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                padding: '1rem 2rem',
                background: joining ? '#cbd5e1' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1.1rem',
                cursor: joining ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {joining ? 'Joining...' : 'Join Squad'}
            </button>
          )}

          {isMember && (
            <div style={{
              padding: '1rem 2rem',
              background: '#d1fae5',
              border: '2px solid #10b981',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1.1rem',
              color: '#065f46'
            }}>
              ✓ You're a Member
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Active Members
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#0f172a'
            }}>
              {squad._count?.members || 0}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Active Cases
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#dc2626'
            }}>
              {squad.activeCases || 0}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Successful Reunions
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#10b981'
            }}>
              {squad.successfulReunions || 0}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Coverage Area
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#0f172a'
            }}>
              {squad.radiusMiles} mi
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Squad Info */}
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
              About This Squad
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: '0.5rem',
                fontWeight: '600'
              }}>
                Coverage Type
              </div>
              <div style={{
                fontSize: '1.1rem',
                color: '#0f172a'
              }}>
                {squad.coverageType || 'CITYWIDE'}
              </div>
            </div>

            {squad.zipCodes && squad.zipCodes.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  fontWeight: '600'
                }}>
                  ZIP Codes Served
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  color: '#0f172a'
                }}>
                  {Array.isArray(squad.zipCodes)
                    ? squad.zipCodes.join(', ')
                    : JSON.parse(squad.zipCodes).join(', ')}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: '0.5rem',
                fontWeight: '600'
              }}>
                Availability
              </div>
              <div style={{
                fontSize: '1.1rem',
                color: '#0f172a'
              }}>
                {squad.availability247 ? '24/7 Available' : 'Business Hours'}
              </div>
            </div>

            {squad.contactEmail && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  fontWeight: '600'
                }}>
                  Contact
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  color: '#667eea'
                }}>
                  {squad.contactEmail}
                </div>
              </div>
            )}
          </div>

          {/* Members Preview */}
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
              Squad Leaders
            </h2>

            {squad.members && squad.members.filter(m => ['FOUNDER', 'LEADER'].includes(m.role)).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {squad.members
                  .filter(m => ['FOUNDER', 'LEADER'].includes(m.role))
                  .slice(0, 5)
                  .map(member => (
                    <div key={member.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#667eea',
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
                          color: '#0f172a'
                        }}>
                          {member.user.firstName} {member.user.lastName}
                        </div>
                        <div style={{
                          fontSize: '0.85rem',
                          color: '#64748b'
                        }}>
                          {member.role}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>No leaders listed</p>
            )}
          </div>
        </div>

        {/* Divisions */}
        {squad.divisions && squad.divisions.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Divisions
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {squad.divisions.map(division => (
                <div key={division.id} style={{
                  padding: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '0.5rem'
                  }}>
                    {division.name}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#64748b'
                  }}>
                    {division.totalMembers || 0} members
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
            marginTop: '1rem',
            fontWeight: '600'
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
