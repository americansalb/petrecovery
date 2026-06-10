'use client';

/**
 * Admin Missions List Page
 * Phase 13-14: Lost Pet Missions MVP (TASK-C03)
 *
 * List of all lost pet missions with filters and bulk actions
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdmin } from '@/app/lib/permissions';

export default function AdminMissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [legalError, setLegalError] = useState(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkStatusChange, setBulkStatusChange] = useState('');
  const [deletingId, setDeletingId] = useState(null); // For individual delete

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/missions');
    } else if (status === 'authenticated' && !isAdmin(session)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch missions
  useEffect(() => {
    if (status === 'authenticated' && isAdmin(session)) {
      fetchMissions();
    }
  }, [status, session, statusFilter, cityFilter, stateFilter, unassignedOnly]);

  const fetchMissions = async () => {
    setLoading(true);
    setError(null);
    setLegalError(null);
    setSelectedIds(new Set()); // Clear selection on refetch

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (cityFilter) params.append('city', cityFilter);
      if (stateFilter) params.append('state', stateFilter);
      if (unassignedOnly) params.append('unassigned', 'true');
      params.append('limit', '100');

      const response = await fetch('/api/missions?' + params.toString());
      const data = await response.json();

      if (!response.ok) {
        // Check for legal error
        if (response.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          return;
        }
        throw new Error(data.error || 'Failed to fetch missions');
      }

      setCases(data.cases || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Selection handlers
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === cases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cases.map(c => c.id)));
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/missions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ids: Array.from(selectedIds)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete missions');
      }

      setShowDeleteConfirm(false);
      fetchMissions(); // Refresh list
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (selectedIds.size === 0 || !bulkStatusChange) return;
    setBulkActionLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/missions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          ids: Array.from(selectedIds),
          status: bulkStatusChange
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update missions');
      }

      setBulkStatusChange('');
      fetchMissions(); // Refresh list
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Single mission delete handler
  const handleSingleDelete = async (id) => {
    if (!id) return;
    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/missions/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete mission');
      }

      fetchMissions(); // Refresh list
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
          <div style={{ color: '#64748b' }}>Loading missions...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      padding: '2rem'
    }}>
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
              Delete {selectedIds.size} Mission{selectedIds.size !== 1 ? 's' : ''}?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              This action cannot be undone. All mission data, updates, and sightings will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkActionLoading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: bulkActionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: bulkActionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {bulkActionLoading ? 'Deleting...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '0.5rem'
            }}>
              Lost Pet Missions
              <span style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                borderRadius: '0.25rem',
                fontWeight: '600',
                marginLeft: '0.5rem'
              }}>
                ADMIN ONLY
              </span>
            </h1>
            <p style={{ color: '#64748b' }}>
              Manage and track all lost pet missions
            </p>
          </div>
          <Link
            href="/admin/missions/new"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#10b981',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            + Create New Mission
          </Link>
        </div>

        {/* Legal Error Banner */}
        {legalError && (
          <div style={{
            padding: '1.5rem',
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>Warning</span>
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
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#991b1b',
            marginBottom: '1rem'
          }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="SIGHTING_REPORTED">Sighting Reported</option>
                <option value="REUNITED">Reunited</option>
                <option value="CLOSED_OTHER">Closed</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                City
              </label>
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Filter by city..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                State
              </label>
              <input
                type="text"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                placeholder="Filter by state..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: unassignedOnly ? '#fef3c7' : '#f3f4f6',
                border: unassignedOnly ? '2px solid #f59e0b' : '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: unassignedOnly ? '600' : '400'
              }}>
                <input
                  type="checkbox"
                  checked={unassignedOnly}
                  onChange={(e) => setUnassignedOnly(e.target.checked)}
                />
                Unassigned Only
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                onClick={() => {
                  setStatusFilter('');
                  setCityFilter('');
                  setStateFilter('');
                  setUnassignedOnly(false);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          marginBottom: '1rem'
        }}>
          <div style={{
            background: '#eef2ff',
            border: '2px solid #6366f1',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ fontWeight: '600', color: '#4338ca' }}>
              {selectedIds.size} mission{selectedIds.size !== 1 ? 's' : ''} selected
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={bulkStatusChange}
                onChange={(e) => setBulkStatusChange(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #c7d2fe',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Change status to...</option>
                <option value="ACTIVE">Active</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="SIGHTING_REPORTED">Sighting Reported</option>
                <option value="REUNITED">Reunited</option>
                <option value="CLOSED_OTHER">Closed</option>
              </select>
              <button
                onClick={handleBulkStatusChange}
                disabled={!bulkStatusChange || bulkActionLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: bulkStatusChange ? '#6366f1' : '#c7d2fe',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: bulkStatusChange ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                Apply
              </button>
            </div>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={bulkActionLoading}
              style={{
                padding: '0.5rem 1rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Delete Selected
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: '#4338ca',
                border: '1px solid #c7d2fe',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Cases Table */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          {cases.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No missions found</div>
              <div>Try adjusting your filters or create a new mission</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ ...headerStyle, width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === cases.length && cases.length > 0}
                      onChange={toggleSelectAll}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={headerStyle}>Mission #</th>
                  <th style={headerStyle}>Pet</th>
                  <th style={headerStyle}>Location</th>
                  <th style={headerStyle}>Status</th>
                  <th style={headerStyle}>Coordinator</th>
                  <th style={headerStyle}>Rescue Force</th>
                  <th style={headerStyle}>Created</th>
                  <th style={headerStyle}>Notes</th>
                  <th style={{ ...headerStyle, width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => {
                  const statusColors = {
                    'ACTIVE': { bg: '#dbeafe', color: '#1e40af' },
                    'IN_PROGRESS': { bg: '#fef3c7', color: '#92400e' },
                    'SIGHTING_REPORTED': { bg: '#fce7f3', color: '#9d174d' },
                    'REUNITED': { bg: '#d1fae5', color: '#065f46' },
                    'CLOSED_OTHER': { bg: '#e5e7eb', color: '#374151' }
                  };
                  const statusColor = statusColors[caseItem.status] || statusColors['ACTIVE'];
                  const isSelected = selectedIds.has(caseItem.id);

                  return (
                    <tr
                      key={caseItem.id}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid #e5e7eb',
                        background: isSelected ? '#eef2ff' : 'white'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected ? '#eef2ff' : 'white';
                      }}
                    >
                      <td style={cellStyle} onClick={(e) => toggleSelect(caseItem.id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {caseItem.missionNumber}
                        </span>
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#111827' }}>
                            {caseItem.petName || 'Unknown'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {caseItem.petSpecies}
                          </div>
                        </div>
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        {caseItem.lastSeenAddress || '-'}
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          background: statusColor.bg,
                          color: statusColor.color,
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          {caseItem.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        {caseItem.coordinator
                          ? `${caseItem.coordinator.firstName} ${caseItem.coordinator.lastName || ''}`.trim()
                          : '-'}
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        {caseItem.assignedSquad ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}>
                            {caseItem.assignedSquad.name}
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: '500' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        {new Date(caseItem.createdAt).toLocaleDateString()}
                      </td>
                      <td style={cellStyle} onClick={() => router.push('/admin/missions/' + caseItem.id)}>
                        {caseItem.updatesCount || 0}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete mission ${caseItem.missionNumber}? This cannot be undone.`)) {
                              handleSingleDelete(caseItem.id);
                            }
                          }}
                          disabled={deletingId === caseItem.id}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: deletingId === caseItem.id ? '#fca5a5' : '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: deletingId === caseItem.id ? 'not-allowed' : 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (deletingId !== caseItem.id) {
                              e.currentTarget.style.background = '#dc2626';
                              e.currentTarget.style.color = 'white';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = deletingId === caseItem.id ? '#fca5a5' : '#fee2e2';
                            e.currentTarget.style.color = '#dc2626';
                          }}
                        >
                          {deletingId === caseItem.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary */}
        {cases.length > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            Showing {cases.length} {cases.length === 1 ? 'mission' : 'missions'}
          </div>
        )}
      </div>
    </div>
  );
}

const headerStyle = {
  padding: '1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: '600',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const cellStyle = {
  padding: '1rem',
  fontSize: '0.875rem',
  color: '#374151'
};
