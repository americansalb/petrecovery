'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminRescueSquadsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      loadSquads();
    }
  }, [session]);

  const loadSquads = async () => {
    try {
      const res = await fetch('/api/admin/rescue-squads');
      if (res.ok) {
        const data = await res.json();
        setSquads(data.squads || []);
      }
    } catch (error) {
      console.error('Error loading squads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (squadId, squadName) => {
    setDeleteConfirmOpen({ squadId, squadName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmOpen) return;
    const { squadId } = deleteConfirmOpen;
    setDeleteConfirmOpen(null);

    setDeleting(squadId);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/rescue-squads/${squadId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete rescue force');
      }

      // Remove from list
      setSquads(squads.filter(s => s.id !== squadId));
    } catch (error) {
      setDeleteError('Failed to delete rescue force: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  const filteredSquads = squads.filter(squad => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      squad.name.toLowerCase().includes(query) ||
      (squad.description && squad.description.toLowerCase().includes(query))
    );
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
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
              Delete Squad?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Are you sure you want to delete &quot;{deleteConfirmOpen.squadName}&quot;? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteConfirmOpen(null)}
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
                onClick={confirmDelete}
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
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Error Banner */}
        {deleteError && (
          <div style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{deleteError}</span>
            <button
              onClick={() => setDeleteError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: '1.25rem',
              }}
            >
              ×
            </button>
          </div>
        )}

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
              Manage Rescue Forces
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              View, create, and delete rescue forces
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard"
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
              ← Dashboard
            </Link>

            <Link
              href="/admin/divisions"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              📍 Manage Divisions
            </Link>

            <Link
              href="/admin/rescue-squads/create"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              + Create New Rescue Force
            </Link>
          </div>
        </div>

        {/* Search */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rescue forces by name or description..."
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              outline: 'none'
            }}
          />
        </div>

        {/* Stats */}
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
              Total Squads
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#0f172a'
            }}>
              {squads.length}
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
              Total Members
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#0f172a'
            }}>
              {squads.reduce((sum, s) => sum + (s._count?.members || 0), 0)}
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
              Total Reunions
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#10b981'
            }}>
              {squads.reduce((sum, s) => sum + (s.successfulReunions || 0), 0)}
            </div>
          </div>
        </div>

        {/* Squads Table */}
        {loading ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
              Loading squads...
            </div>
          </div>
        ) : filteredSquads.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚁</div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              No rescue forces found
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              {searchQuery ? 'Try a different search' : 'Create your first rescue force'}
            </p>
            {!searchQuery && (
              <Link
                href="/admin/rescue-squads/create"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '700'
                }}
              >
                Create First Squad
              </Link>
            )}
          </div>
        ) : (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  background: '#f8fafc',
                  borderBottom: '2px solid #e2e8f0'
                }}>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}>
                    Squad Name
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}>
                    Members
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}>
                    Cases
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}>
                    Reunions
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}>
                    Status
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'right',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontSize: '0.9rem'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSquads.map(squad => (
                  <tr
                    key={squad.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '1rem' }}>
                      <div>
                        <div style={{
                          fontWeight: '700',
                          color: '#0f172a',
                          marginBottom: '0.25rem'
                        }}>
                          {squad.name}
                        </div>
                        {squad.description && (
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#64748b'
                          }}>
                            {squad.description.slice(0, 60)}
                            {squad.description.length > 60 && '...'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: '#0f172a'
                    }}>
                      {squad._count?.members || 0}
                    </td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: '#0f172a'
                    }}>
                      {squad._count?.caseAssignments || 0}
                    </td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: '#10b981'
                    }}>
                      {squad.successfulReunions || 0}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: squad.isActive ? '#d1fae5' : '#fee2e2',
                        color: squad.isActive ? '#065f46' : '#991b1b',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        {squad.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'right'
                    }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <Link
                          href={`/rescue-squads/${squad.id}`}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#e0e7ff',
                            color: '#4338ca',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(squad.id, squad.name)}
                          disabled={deleting === squad.id}
                          style={{
                            padding: '0.5rem 1rem',
                            background: deleting === squad.id ? '#cbd5e1' : '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: deleting === squad.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {deleting === squad.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
