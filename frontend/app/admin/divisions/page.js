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
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      loadDivisions();
    }
  }, [session]);

  const loadDivisions = async () => {
    try {
      const res = await fetch('/api/admin/divisions');
      if (res.ok) {
        const data = await res.json();
        setDivisions(data.divisions || []);
      }
    } catch (error) {
      console.error('Error loading divisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (divisionId, divisionName) => {
    setDeleteConfirmOpen({ divisionId, divisionName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmOpen) return;
    const { divisionId } = deleteConfirmOpen;
    setDeleteConfirmOpen(null);

    setDeleting(divisionId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/divisions/${divisionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setDivisions(divisions.filter(d => d.id !== divisionId));
    } catch (error) {
      setDeleteError('Failed to delete division');
    } finally {
      setDeleting(null);
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
              Delete Division?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Delete &quot;{deleteConfirmOpen.divisionName}&quot;? Members will stay in the parent squad.
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

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
              Manage Divisions
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#64748b' }}>
              Neighborhood subdivisions within rescue squads
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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

            <Link
              href="/admin/divisions/create"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              + Create Division
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#667eea' }}>
            {divisions.length}
          </div>
          <div style={{ color: '#64748b' }}>Total Divisions</div>
        </div>

        {/* Divisions List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            Loading...
          </div>
        ) : divisions.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '3rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              No divisions yet
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Create your first neighborhood division
            </p>
            <Link
              href="/admin/divisions/create"
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
              + Create Division
            </Link>
          </div>
        ) : (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '700' }}>
                    Division
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '700' }}>
                    Rescue Squad
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '700' }}>
                    Members
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '700' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {divisions.map(division => (
                  <tr key={division.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>
                        {division.name}
                      </div>
                      {division.description && (
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          {division.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '500' }}>
                        {division.rescueSquad.name}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {division.rescueSquad.city}, {division.rescueSquad.state}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {division._count?.members || 0}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(division.id, division.name)}
                        disabled={deleting === division.id}
                        style={{
                          padding: '0.5rem 1rem',
                          background: deleting === division.id ? '#cbd5e1' : '#fee2e2',
                          color: deleting === division.id ? '#64748b' : '#991b1b',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          cursor: deleting === division.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {deleting === division.id ? 'Deleting...' : 'Delete'}
                      </button>
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
