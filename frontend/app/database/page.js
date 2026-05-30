'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { theme } from '../lib/theme';

export default function PublicDatabasePage() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [speciesFilter, setSpeciesFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function fetchDatabase() {
      try {
        const params = new URLSearchParams();
        if (typeFilter !== 'ALL') params.append('type', typeFilter);
        if (speciesFilter !== 'ALL') params.append('species', speciesFilter);
        if (statusFilter) params.append('status', statusFilter);
        if (searchQuery) params.append('search', searchQuery);

        const res = await fetch(`/api/database?${params.toString()}`);

        if (!res.ok) {
          throw new Error('Failed to load database');
        }

        const data = await res.json();
        setReports(data.reports);
        setFilteredReports(data.reports);
        setIsAuthenticated(data.isAuthenticated);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching database:', err);
        setLoading(false);
      }
    }

    fetchDatabase();
  }, [searchQuery, typeFilter, speciesFilter, statusFilter]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #0ea5e9',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite',
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: theme.colors.gray[600] }}>Loading pet database...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      fontFamily: theme.fonts.sans,
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '3rem 2rem',
      }}>
        {/* Title & Description */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '900',
            marginBottom: '0.5rem',
            color: theme.colors.gray[900],
          }}>
            Lost & Found Pet Database
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: theme.colors.gray[600],
          }}>
            Browse all lost and found pet reports. {!isAuthenticated && 'Sign in to view contact information.'}
          </p>
        </div>

        {/* Alert for unauthenticated users */}
        {!isAuthenticated && (
          <div style={{
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: theme.radius.lg,
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{ fontSize: '2rem' }}>🔒</div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                marginBottom: '0.5rem',
                color: '#78350f',
              }}>
                Sign In to View Contact Information
              </h3>
              <p style={{ color: '#92400e', marginBottom: '1rem' }}>
                Create an account to see contact details and help reunite pets with their families.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Link
                  href="/login"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#facc15',
                    color: '#0f172a',
                    borderRadius: theme.radius.md,
                    textDecoration: 'none',
                    fontWeight: '700',
                    fontSize: '0.95rem',
                  }}
                >
                  Sign In
                </Link>
                <Link
                  href="/patrol/join"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#b45309',
                    border: '2px solid #b45309',
                    borderRadius: theme.radius.md,
                    textDecoration: 'none',
                    fontWeight: '700',
                    fontSize: '0.95rem',
                  }}
                >
                  Join Community Patrol
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div style={{
          background: 'white',
          borderRadius: theme.radius.xl,
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: theme.shadows.md,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
          }}>
            {/* Search */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                fontSize: '0.9rem',
                color: theme.colors.gray[700],
              }}>
                🔍 Search
              </label>
              <input
                type="text"
                placeholder="Pet name, breed, color, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.md,
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Type Filter */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                fontSize: '0.9rem',
                color: theme.colors.gray[700],
              }}>
                Report Type
              </label>
              <select
                aria-label="Report Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.md,
                  fontSize: '1rem',
                }}
              >
                <option value="ALL">All Types</option>
                <option value="LOST">Lost Only</option>
                <option value="FOUND">Found Only</option>
              </select>
            </div>

            {/* Species Filter */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                fontSize: '0.9rem',
                color: theme.colors.gray[700],
              }}>
                Species
              </label>
              <select
                aria-label="Species"
                value={speciesFilter}
                onChange={(e) => setSpeciesFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.md,
                  fontSize: '1rem',
                }}
              >
                <option value="ALL">All Species</option>
                <option value="DOG">Dogs</option>
                <option value="CAT">Cats</option>
                <option value="BIRD">Birds</option>
                <option value="RABBIT">Rabbits</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                fontSize: '0.9rem',
                color: theme.colors.gray[700],
              }}>
                Status
              </label>
              <select
                aria-label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.md,
                  fontSize: '1rem',
                }}
              >
                <option value="ACTIVE">Active Only</option>
                <option value="ALL">All Statuses</option>
                <option value="FOUND">Found/Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: theme.radius.md,
            textAlign: 'center',
            fontWeight: '600',
            color: theme.colors.gray[700],
          }}>
            Showing {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Results Grid */}
        {filteredReports.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '4rem 2rem',
            boxShadow: theme.shadows.md,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: theme.colors.gray[900],
            }}>
              No Reports Found
            </h2>
            <p style={{
              fontSize: '1rem',
              color: theme.colors.gray[600],
            }}>
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
          }}>
            {filteredReports.map((report) => (
              <Link
                key={report.id}
                href={`/cases/${report.caseNumber}`}
                style={{
                  display: 'block',
                  background: 'white',
                  borderRadius: theme.radius.xl,
                  overflow: 'hidden',
                  boxShadow: theme.shadows.md,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  border: '2px solid transparent',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = theme.shadows.lg;
                  e.currentTarget.style.borderColor = report.reportType === 'LOST' ? '#dc2626' : '#10b981';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = theme.shadows.md;
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {/* Photo */}
                {report.primaryPhotoUrl && (
                  <div style={{
                    width: '100%',
                    height: '250px',
                    overflow: 'hidden',
                    background: '#f8fafc',
                  }}>
                    <img
                      src={report.primaryPhotoUrl}
                      alt={report.petName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                )}

                {/* Content */}
                <div style={{ padding: '1.5rem' }}>
                  {/* Badge */}
                  <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    background: report.reportType === 'LOST' ? '#dc2626' : '#10b981',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    marginBottom: '0.75rem',
                  }}>
                    {report.reportType === 'LOST' ? '🚨 LOST' : '🎉 FOUND'}
                  </div>

                  {/* Pet Name */}
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    marginBottom: '0.75rem',
                    color: theme.colors.gray[900],
                  }}>
                    {report.petName}
                  </h3>

                  {/* Details Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                  }}>
                    <div>
                      <span style={{ color: theme.colors.gray[700] }}>Species: </span>
                      <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>
                        {report.species}
                      </span>
                    </div>
                    {report.breed && (
                      <div>
                        <span style={{ color: theme.colors.gray[700] }}>Breed: </span>
                        <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>
                          {report.breed}
                        </span>
                      </div>
                    )}
                    <div>
                      <span style={{ color: theme.colors.gray[700] }}>Color: </span>
                      <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>
                        {report.color}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: theme.colors.gray[700] }}>Size: </span>
                      <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>
                        {report.size}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  <div style={{
                    fontSize: '0.9rem',
                    color: theme.colors.gray[600],
                    marginBottom: '0.75rem',
                  }}>
                    📍 {report.lastSeenAddress}
                  </div>

                  {/* Date */}
                  <div style={{
                    fontSize: '0.85rem',
                    color: theme.colors.gray[700],
                    marginBottom: '1rem',
                  }}>
                    {new Date(report.lastSeenAt).toLocaleDateString()}
                  </div>

                  {/* Contact - Conditional */}
                  {isAuthenticated ? (
                    <div style={{
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: theme.radius.md,
                      fontSize: '0.9rem',
                    }}>
                      <div style={{ fontWeight: '600', color: theme.colors.gray[900] }}>
                        Contact: {report.reporterName}
                      </div>
                      <div style={{ color: theme.colors.gray[600], marginTop: '0.25rem' }}>
                        {report.reporterPhone}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '0.75rem',
                      background: '#fef3c7',
                      border: '2px solid #f59e0b',
                      borderRadius: theme.radius.md,
                      fontSize: '0.9rem',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#78350f',
                    }}>
                      🔒 Sign in to view contact
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
