'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/communities/my-requests');
    } else if (session?.user) {
      fetchRequests();
    }
  }, [status, session, filter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const url = filter === 'ALL'
        ? '/api/communities/requests'
        : `/api/communities/requests?status=${filter}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
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
        justifyContent: 'center'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: { bg: '#fef3c7', color: '#92400e', text: '🟡 PENDING' },
      APPROVED: { bg: '#d1fae5', color: '#065f46', text: '✅ APPROVED' },
      REJECTED: { bg: '#fee2e2', color: '#991b1b', text: '❌ REJECTED' }
    };

    const style = styles[status] || styles.PENDING;

    return (
      <div style={{
        display: 'inline-block',
        padding: '0.5rem 1rem',
        background: style.bg,
        color: style.color,
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '800'
      }}>
        {style.text}
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTypeLabel = (type) => {
    const labels = {
      METRO_AREA: 'Metro Area',
      COUNTY: 'County',
      SUBCOMMUNITY: 'Subcommunity'
    };
    return labels[type] || type;
  };

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
              My Community Requests
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Track the status of your community creation requests
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              href="/"
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
              ← Home
            </Link>
            <Link
              href="/communities"
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
              ← Communities
            </Link>
            <Link
              href="/communities/request"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              + Request New Community
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(filterOption => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              style={{
                padding: '0.75rem 1.5rem',
                background: filter === filterOption ? '#667eea' : 'white',
                color: filter === filterOption ? 'white' : '#64748b',
                border: `2px solid ${filter === filterOption ? '#667eea' : '#e2e8f0'}`,
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {filterOption}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
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
              No requests found
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              You haven't submitted any community requests yet.
            </p>
            <Link
              href="/communities/request"
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
              Submit Your First Request
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            {requests.map(request => (
              <div
                key={request.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2rem',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                  border: '2px solid #f1f5f9'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#64748b'
                  }}>
                    {getTypeLabel(request.type)} • Requested {formatDate(request.createdAt)}
                  </div>
                </div>

                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '0.75rem'
                }}>
                  {request.geographicScope}
                </h3>

                {request.notes && (
                  <p style={{
                    color: '#64748b',
                    marginBottom: '1rem',
                    fontStyle: 'italic'
                  }}>
                    "{request.notes}"
                  </p>
                )}

                {/* Approved - Show Community Link */}
                {request.status === 'APPROVED' && request.approvedCommunity && (
                  <div style={{
                    padding: '1rem',
                    background: '#d1fae5',
                    borderRadius: '8px',
                    marginTop: '1rem'
                  }}>
                    <div style={{ color: '#065f46', fontWeight: '600', marginBottom: '0.5rem' }}>
                      → Community created: {request.approvedCommunity.name}
                    </div>
                    <Link
                      href={`/communities/${request.approvedCommunity.id}`}
                      style={{
                        color: '#059669',
                        fontWeight: '700',
                        textDecoration: 'underline'
                      }}
                    >
                      View Community →
                    </Link>
                  </div>
                )}

                {/* Rejected - Show Reason */}
                {request.status === 'REJECTED' && request.rejectionReason && (
                  <div style={{
                    padding: '1rem',
                    background: '#fee2e2',
                    borderRadius: '8px',
                    marginTop: '1rem'
                  }}>
                    <div style={{ color: '#991b1b', fontWeight: '600', marginBottom: '0.5rem' }}>
                      📝 Rejection Reason:
                    </div>
                    <div style={{ color: '#991b1b' }}>
                      {request.rejectionReason}
                    </div>
                  </div>
                )}

                {/* Pending - Show Awaiting Review */}
                {request.status === 'PENDING' && (
                  <div style={{
                    padding: '1rem',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    marginTop: '1rem',
                    color: '#92400e'
                  }}>
                    → Awaiting admin review
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
