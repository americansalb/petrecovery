'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDivisionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else if (session) {
      fetchDivisions();
    }
  }, [session]);

  const fetchDivisions = async () => {
    try {
      console.log('🔍 [ADMIN] Fetching all divisions from database...');
      setLoading(true);
      const res = await fetch('/api/admin/divisions');
      const data = await res.json();

      if (!res.ok) {
        console.error('❌ [ADMIN] Failed to fetch divisions:', data.error);
        throw new Error(data.error || 'Failed to fetch divisions');
      }

      console.log('✅ [ADMIN] Loaded divisions:', data.divisions?.length || 0);
      setDivisions(data.divisions || []);
    } catch (err) {
      console.error('❌ [ADMIN] Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

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
              All Divisions
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              {loading ? 'Loading...' : `${divisions.length} division${divisions.length === 1 ? '' : 's'} in database`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              href="/admin/divisions/create"
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
            >
              ➕ Create Division
            </Link>
            <Link
              href="/admin/rescue-squads"
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#64748b',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              ← Back to Squads
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1.5rem',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            color: '#991b1b',
            marginBottom: '2rem',
            fontWeight: '600'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading divisions from database...</div>
          </div>
        ) : divisions.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              No divisions created yet
            </h2>
            <p style={{ color: '#64748b', marginBottom: '2rem' }}>
              Create the first division to get started
            </p>
            <Link
              href="/admin/divisions/create"
              style={{
                display: 'inline-block',
                padding: '1rem 2rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
            >
              ➕ Create First Division
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1.5rem'
          }}>
            {divisions.map(division => (
              <div
                key={division.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2rem',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                  border: division.isActive ? '2px solid #f1f5f9' : '2px solid #fecaca'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1.5rem',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{
                      fontSize: '1.8rem',
                      fontWeight: '700',
                      color: '#0f172a',
                      marginBottom: '0.5rem'
                    }}>
                      {division.name}
                    </h2>
                    <div style={{
                      fontSize: '1rem',
                      color: '#667eea',
                      marginBottom: '0.5rem',
                      fontWeight: '600'
                    }}>
                      Squad: {division.rescueSquad?.name || 'Unknown'}
                    </div>
                    {division.description && (
                      <div style={{
                        fontSize: '0.95rem',
                        color: '#64748b',
                        marginTop: '0.75rem',
                        lineHeight: '1.5'
                      }}>
                        {division.description}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {division.isActive ? (
                      <span style={{
                        padding: '0.5rem 1rem',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700'
                      }}>
                        ✓ Active
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.5rem 1rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700'
                      }}>
                        ✗ Inactive
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '1.5rem',
                  padding: '1.5rem',
                  background: '#f8fafc',
                  borderRadius: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      marginBottom: '0.25rem',
                      textTransform: 'uppercase',
                      fontWeight: '700'
                    }}>
                      Members
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '900',
                      color: '#0f172a'
                    }}>
                      {division.totalMembers || 0}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      marginBottom: '0.25rem',
                      textTransform: 'uppercase',
                      fontWeight: '700'
                    }}>
                      Active Cases
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '900',
                      color: '#dc2626'
                    }}>
                      {division.activeCases || 0}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      marginBottom: '0.25rem',
                      textTransform: 'uppercase',
                      fontWeight: '700'
                    }}>
                      Reunions
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '900',
                      color: '#10b981'
                    }}>
                      {division.successfulReunions || 0}
                    </div>
                  </div>

                  {division.centerLatitude && division.centerLongitude && (
                    <div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        marginBottom: '0.25rem',
                        textTransform: 'uppercase',
                        fontWeight: '700'
                      }}>
                        Center Point
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {division.centerLatitude.toFixed(4)}, {division.centerLongitude.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div style={{
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  display: 'flex',
                  gap: '2rem',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <strong>Created:</strong> {new Date(division.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>ID:</strong> {division.id}
                  </div>
                  {division.boundaries && (
                    <div>
                      <strong>Has Polygon:</strong> Yes ({JSON.parse(division.boundaries).length} points)
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div style={{
                  marginTop: '1.5rem',
                  display: 'flex',
                  gap: '1rem'
                }}>
                  <Link
                    href={`/rescue-squads/${division.rescueSquadId}/divisions/${division.id}`}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '700',
                      display: 'inline-block'
                    }}
                  >
                    View Division
                  </Link>
                  <Link
                    href={`/rescue-squads/${division.rescueSquadId}`}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'white',
                      color: '#64748b',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '700',
                      display: 'inline-block'
                    }}
                  >
                    View Squad
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
