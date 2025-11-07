'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { theme } from '../../lib/theme';

export default function PatrolDatabasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [speciesFilter, setSpeciesFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchDatabase() {
      try {
        const params = new URLSearchParams();
        if (typeFilter !== 'ALL') params.append('type', typeFilter);
        if (speciesFilter !== 'ALL') params.append('species', speciesFilter);
        if (statusFilter) params.append('status', statusFilter);
        if (searchQuery) params.append('search', searchQuery);

        const res = await fetch(`/api/patrol/database?${params.toString()}`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load database');
        }

        const data = await res.json();
        setReports(data.reports);
        setFilteredReports(data.reports);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchDatabase();
    }
  }, [status, searchQuery, typeFilter, speciesFilter, statusFilter]);

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
          <p style={{ color: theme.colors.gray[600] }}>Loading patrol database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
        padding: '2rem',
      }}>
        <div style={{
          background: 'white',
          borderRadius: theme.radius.xl,
          padding: '3rem',
          boxShadow: theme.shadows.lg,
          textAlign: 'center',
          maxWidth: '500px',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚫</div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: theme.colors.gray[900],
          }}>
            Access Denied
          </h1>
          <p style={{
            fontSize: '1.05rem',
            color: theme.colors.gray[600],
            marginBottom: '2rem',
          }}>
            {error}
          </p>
          {error.includes('patrol members') && (
            <Link
              href="/patrol/join"
              style={{
                display: 'inline-block',
                padding: '1rem 2rem',
                background: '#0ea5e9',
                color: 'white',
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                fontWeight: '700',
                marginRight: '1rem',
              }}
            >
              Join Patrol
            </Link>
          )}
          <Link
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              background: '#f1f5f9',
              color: theme.colors.gray[700],
              borderRadius: theme.radius.lg,
              textDecoration: 'none',
              fontWeight: '700',
            }}
          >
            ← Back to Dashboard
          </Link>
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
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '1.5rem 2rem',
        boxShadow: theme.shadows.sm,
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <Link
            href="/dashboard"
            style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#1e293b',
              textDecoration: 'none',
            }}
          >
            ← PetRecovery
          </Link>
          <div style={{
            padding: '0.5rem 1rem',
            background: '#dbeafe',
            border: '2px solid #0ea5e9',
            borderRadius: theme.radius.lg,
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#075985',
          }}>
            🦸 Patrol Member Database
          </div>
        </div>
      </div>

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
            Pet Recovery Database
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: theme.colors.gray[600],
          }}>
            Search and browse all lost and found pet reports. Exclusive access for patrol members.
          </p>
        </div>

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
                href={`/reports/${report.id}`}
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
                      <span style={{ color: theme.colors.gray[500] }}>Species: </span>
                      <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>
                        {report.species}
                      </span>
                    </div>
                    {report.breed && (
                      <div>
                        <span style={{ color: theme.colors.gray[500] }}>Breed: </span>
                        <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>
                          {report.breed}
                        </span>
                      </div>
                    )}
                    <div>
                      <span style={{ color: theme.colors.gray[500] }}>Color: </span>
                      <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>
                        {report.color}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: theme.colors.gray[500] }}>Size: </span>
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
                    color: theme.colors.gray[500],
                    marginBottom: '1rem',
                  }}>
                    {new Date(report.lastSeenAt).toLocaleDateString()}
                  </div>

                  {/* Contact */}
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
