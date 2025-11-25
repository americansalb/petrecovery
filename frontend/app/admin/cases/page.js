'use client';

/**
 * Admin Cases List Page
 * Phase 13-14: Lost Pet Cases MVP (TASK-C03)
 *
 * List of all lost pet cases with filters
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCasesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [legalError, setLegalError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/cases');
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch cases
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchCases();
    }
  }, [status, session, statusFilter, cityFilter, stateFilter]);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    setLegalError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (cityFilter) params.append('city', cityFilter);
      if (stateFilter) params.append('state', stateFilter);
      params.append('limit', '100');

      const response = await fetch('/api/cases?' + params.toString());
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
        throw new Error(data.error || 'Failed to fetch cases');
      }

      setCases(data.cases || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
          <div style={{ color: '#64748b' }}>Loading cases...</div>
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
              Lost Pet Cases
            </h1>
            <p style={{ color: '#64748b' }}>
              Manage and track all lost pet cases
            </p>
          </div>
          <Link
            href="/admin/cases/new"
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
            + Create New Case
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
              Review & Accept Now →
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
                <option value="OPEN">Open</option>
                <option value="ACTIVE_SEARCH">Active Search</option>
                <option value="RESOLVED">Resolved</option>
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
              <button
                onClick={() => {
                  setStatusFilter('');
                  setCityFilter('');
                  setStateFilter('');
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
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No cases found</div>
              <div>Try adjusting your filters or create a new case</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={headerStyle}>Case #</th>
                  <th style={headerStyle}>Pet</th>
                  <th style={headerStyle}>Location</th>
                  <th style={headerStyle}>Status</th>
                  <th style={headerStyle}>Squad</th>
                  <th style={headerStyle}>Created</th>
                  <th style={headerStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => {
                  const statusColors = {
                    'OPEN': { bg: '#dbeafe', color: '#1e40af' },
                    'ACTIVE_SEARCH': { bg: '#fef3c7', color: '#92400e' },
                    'RESOLVED': { bg: '#d1fae5', color: '#065f46' },
                    'CLOSED_OTHER': { bg: '#e5e7eb', color: '#374151' }
                  };
                  const statusColor = statusColors[caseItem.status] || statusColors['OPEN'];

                  return (
                    <tr
                      key={caseItem.id}
                      onClick={() => router.push('/admin/cases/' + caseItem.id)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <td style={cellStyle}>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {caseItem.caseNumber}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#111827' }}>
                            {caseItem.petName || 'Unknown'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {caseItem.petSpecies}
                          </div>
                        </div>
                      </td>
                      <td style={cellStyle}>
                        {caseItem.city}, {caseItem.state}
                      </td>
                      <td style={cellStyle}>
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
                      <td style={cellStyle}>
                        {caseItem.squad ? caseItem.squad.name : '—'}
                      </td>
                      <td style={cellStyle}>
                        {new Date(caseItem.createdAt).toLocaleDateString()}
                      </td>
                      <td style={cellStyle}>
                        {caseItem._count.notes}
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
            Showing {cases.length} {cases.length === 1 ? 'case' : 'cases'}
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
