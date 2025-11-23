'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MyCasesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, participating, division

  useEffect(() => {
    if (session) {
      loadCases();
    }
  }, [session]);

  const loadCases = async () => {
    try {
      const res = await fetch('/api/cases/my-feed');
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        setStats(data.stats || null);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return null;
  }

  const filteredCases = cases.filter(caseItem => {
    if (filter === 'all') return true;
    if (filter === 'participating') return caseItem.isParticipating;
    if (filter === 'division') return caseItem.matchType === 'YOUR_DIVISION';
    return true;
  });

  const getPriorityColor = (priority) => {
    const colors = {
      URGENT: '#dc2626',
      HIGH: '#f59e0b',
      NORMAL: '#3b82f6',
      LOW: '#64748b'
    };
    return colors[priority] || colors.NORMAL;
  };

  const getMatchBadge = (matchType) => {
    const badges = {
      YOUR_DIVISION: { label: 'Your Division', bg: '#dbeafe', color: '#1e40af' },
      YOUR_SQUAD: { label: 'Your Squad', bg: '#e0e7ff', color: '#4338ca' },
      OTHER_SQUAD: { label: 'Other Squad', bg: '#f3f4f6', color: '#6b7280' }
    };
    return badges[matchType] || badges.OTHER_SQUAD;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
              📋 My Cases
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Active cases from your rescue squads
            </p>
          </div>

        </div>

        {/* Stats */}
        {stats && (
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
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Total Cases
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a' }}>
                {stats.total}
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Your Division
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#3b82f6' }}>
                {stats.inDivision}
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Your Squad
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#7c3aed' }}>
                {stats.inSquad}
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Participating
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#10b981' }}>
                {stats.participating}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          {[
            { value: 'all', label: 'All Cases' },
            { value: 'participating', label: 'My Participation' },
            { value: 'division', label: 'Division Priority' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              style={{
                padding: '0.5rem 1rem',
                background: filter === option.value ? '#667eea' : 'white',
                color: filter === option.value ? 'white' : '#64748b',
                border: `2px solid ${filter === option.value ? '#667eea' : '#e2e8f0'}`,
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Cases List */}
        {loading ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
              Loading cases...
            </div>
          </div>
        ) : filteredCases.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              No active cases
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              {cases.length === 0
                ? 'Join a rescue squad to start helping find lost pets'
                : 'No cases match your filter'
              }
            </p>
            {cases.length === 0 && (
              <Link
                href="/rescue-squads/search"
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
                Find a Squad
              </Link>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1.5rem'
          }}>
            {filteredCases.map(caseItem => {
              const matchBadge = getMatchBadge(caseItem.matchType);
              return (
                <Link
                  key={caseItem.id}
                  href={`/cases/${caseItem.id}`}
                  style={{
                    display: 'block',
                    background: 'white',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    border: caseItem.isParticipating ? '3px solid #10b981' : '1px solid #e2e8f0'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem' }}>
                    {/* Pet Photo */}
                    <div style={{
                      width: '150px',
                      height: '150px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#f1f5f9'
                    }}>
                      <img
                        src={caseItem.petPhotoUrl}
                        alt={caseItem.petName}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    </div>

                    {/* Case Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1rem',
                        gap: '1rem'
                      }}>
                        <div>
                          <h3 style={{
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            color: '#0f172a',
                            marginBottom: '0.25rem'
                          }}>
                            {caseItem.petName}
                          </h3>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#64748b',
                            marginBottom: '0.5rem'
                          }}>
                            {caseItem.petSpecies} • {caseItem.petBreed || 'Mixed'} • {caseItem.petColor}
                          </div>
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#64748b',
                            fontFamily: 'monospace'
                          }}>
                            Case #{caseItem.caseNumber}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                          {/* Priority Badge */}
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            background: getPriorityColor(caseItem.priority) + '20',
                            color: getPriorityColor(caseItem.priority),
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                          }}>
                            {caseItem.priority}
                          </span>

                          {/* Match Type Badge */}
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            background: matchBadge.bg,
                            color: matchBadge.color,
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                          }}>
                            {matchBadge.label}
                          </span>

                          {/* Participating Badge */}
                          {caseItem.isParticipating && (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: '#d1fae5',
                              color: '#065f46',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '700'
                            }}>
                              ✓ Participating
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Location & Time */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                            Last Seen
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '600' }}>
                            📍 {caseItem.lastSeenAddress}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                            Squad
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '600' }}>
                            🚁 {caseItem.rescueSquad?.name || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Distance & Active Members */}
                      <div style={{
                        display: 'flex',
                        gap: '1.5rem',
                        fontSize: '0.85rem',
                        color: '#64748b'
                      }}>
                        {caseItem.distanceToUser !== null && (
                          <div>
                            📏 {caseItem.distanceToUser.toFixed(1)} miles away
                          </div>
                        )}
                        <div>
                          👥 {caseItem.activeMembers || 0} active members
                        </div>
                        {caseItem.hasReward && (
                          <div style={{ color: '#10b981', fontWeight: '700' }}>
                            💰 ${caseItem.rewardAmount} reward
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
