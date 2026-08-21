'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCommunitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Approval form state
  const [approvalData, setApprovalData] = useState({
    name: '',
    description: '',
    zipCodes: '',
    centerLatitude: '',
    centerLongitude: ''
  });

  // Rejection form state
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user) {
      fetchRequests();
    }
  }, [status, session, filter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const url = `/api/admin/communities/requests?status=${filter}`;
      const res = await fetch(url);

      if (res.status === 403) {
        router.push('/dashboard'); // Not admin
        return;
      }

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

  const handleApprove = (request) => {
    setSelectedRequest(request);
    setApprovalData({
      name: `${request.geographicScope} Community`,
      description: `Pet recovery community for ${request.geographicScope}`,
      zipCodes: '',
      centerLatitude: '',
      centerLongitude: ''
    });
    setShowApprovalModal(true);
    setError('');
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowRejectionModal(true);
    setError('');
  };

  const submitApproval = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const zipCodesArray = approvalData.zipCodes
        ? approvalData.zipCodes.split(',').map(z => z.trim()).filter(Boolean)
        : [];

      const res = await fetch(`/api/admin/communities/requests/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: approvalData.name,
          description: approvalData.description,
          zipCodes: zipCodesArray,
          centerLatitude: approvalData.centerLatitude ? parseFloat(approvalData.centerLatitude) : null,
          centerLongitude: approvalData.centerLongitude ? parseFloat(approvalData.centerLongitude) : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve request');
      }

      setShowApprovalModal(false);
      fetchRequests(); // Refresh list

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitRejection = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/communities/requests/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: rejectionReason
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject request');
      }

      setShowRejectionModal(false);
      fetchRequests(); // Refresh list

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
        maxWidth: '1200px',
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
              Community Approval Queue
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Review and approve community creation requests
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              href="/admin/communities/create"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              + Create Community
            </Link>
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
              ← Back to Dashboard
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
          {['PENDING', 'APPROVED', 'REJECTED'].map(filterOption => (
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
              {filterOption} ({requests.length})
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
              No {filter.toLowerCase()} requests
            </h2>
            <p style={{ color: '#64748b' }}>
              All caught up!
            </p>
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
                  marginBottom: '1.5rem',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.75rem',
                      fontWeight: '700',
                      color: '#0f172a',
                      marginBottom: '0.5rem'
                    }}>
                      {request.geographicScope}
                    </h3>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#64748b'
                    }}>
                      {getTypeLabel(request.type)} • Requested {formatDate(request.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Requester Info */}
                <div style={{
                  padding: '1.5rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.75rem' }}>
                    Requested by:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <strong>{request.requester.firstName} {request.requester.lastName}</strong> ({request.requester.email})
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      {request.requester.rescueLevel} • Account age: {Math.floor((new Date() - new Date(request.requester.createdAt)) / (1000 * 60 * 60 * 24))} days
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                      <span style={{ color: request.requester.emailVerified ? '#10b981' : '#ef4444' }}>
                        {request.requester.emailVerified ? '✓' : '✗'} Email verified
                      </span>
                      {' • '}
                      <span style={{ color: request.requester.phoneVerified ? '#10b981' : '#64748b' }}>
                        {request.requester.phoneVerified ? '✓' : '○'} Phone verified
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      Member of: {request.requester.communityCount} communities
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {request.notes && (
                  <div style={{
                    padding: '1rem',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.5rem', color: '#78350f' }}>
                      Notes:
                    </div>
                    <div style={{ color: '#92400e', fontStyle: 'italic' }}>
                      "{request.notes}"
                    </div>
                  </div>
                )}

                {/* Overlap Check */}
                <div style={{
                  padding: '1rem',
                  background: request.overlapCheck.hasOverlap ? '#fee2e2' : '#d1fae5',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    color: request.overlapCheck.hasOverlap ? '#991b1b' : '#065f46',
                    fontWeight: '700'
                  }}>
                    {request.overlapCheck.hasOverlap ? '⚠️ Overlap detected' : '✓ No overlaps detected'}
                  </div>
                </div>

                {/* Action Buttons */}
                {request.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={() => handleApprove(request)}
                      style={{
                        flex: 1,
                        padding: '1rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      style={{
                        flex: 1,
                        padding: '1rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}

                {/* Approved/Rejected Status */}
                {request.status === 'APPROVED' && (
                  <div style={{
                    padding: '1rem',
                    background: '#d1fae5',
                    borderRadius: '8px',
                    color: '#065f46'
                  }}>
                    ✓ Approved on {formatDate(request.reviewedAt)}
                    {request.approvedCommunity && (
                      <div style={{ marginTop: '0.5rem' }}>
                        Community created: {request.approvedCommunity.name}
                      </div>
                    )}
                  </div>
                )}

                {request.status === 'REJECTED' && (
                  <div style={{
                    padding: '1rem',
                    background: '#fee2e2',
                    borderRadius: '8px',
                    color: '#991b1b'
                  }}>
                    ✗ Rejected on {formatDate(request.reviewedAt)}
                    <div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                      Reason: {request.rejectionReason}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '700',
              marginBottom: '1.5rem'
            }}>
              Approve Community Request
            </h2>

            {error && (
              <div style={{
                padding: '1rem',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                color: '#991b1b'
              }}>
                {error}
              </div>
            )}

            <form method="post" onSubmit={submitApproval}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '700',
                  marginBottom: '0.5rem'
                }}>
                  Community Name *
                </label>
                <input
                  type="text"
                  value={approvalData.name}
                  onChange={(e) => setApprovalData({ ...approvalData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '700',
                  marginBottom: '0.5rem'
                }}>
                  Description
                </label>
                <textarea
                  value={approvalData.description}
                  onChange={(e) => setApprovalData({ ...approvalData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '700',
                  marginBottom: '0.5rem'
                }}>
                  Zip Codes (comma-separated)
                </label>
                <input
                  type="text"
                  value={approvalData.zipCodes}
                  onChange={(e) => setApprovalData({ ...approvalData, zipCodes: e.target.value })}
                  placeholder="60601, 60602, 60603"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontWeight: '700',
                    marginBottom: '0.5rem'
                  }}>
                    Center Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={approvalData.centerLatitude}
                    onChange={(e) => setApprovalData({ ...approvalData, centerLatitude: e.target.value })}
                    placeholder="41.8781"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontWeight: '700',
                    marginBottom: '0.5rem'
                  }}>
                    Center Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={approvalData.centerLongitude}
                    onChange={(e) => setApprovalData({ ...approvalData, centerLongitude: e.target.value })}
                    placeholder="-87.6298"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    background: 'white',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    background: submitting ? '#cbd5e1' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Approving...' : 'Approve Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%'
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '700',
              marginBottom: '1.5rem'
            }}>
              Reject Community Request
            </h2>

            {error && (
              <div style={{
                padding: '1rem',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                color: '#991b1b'
              }}>
                {error}
              </div>
            )}

            <form method="post" onSubmit={submitRejection}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '700',
                  marginBottom: '0.5rem'
                }}>
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                  rows={4}
                  placeholder="Explain why this request is being rejected..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectionModal(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    background: 'white',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    background: submitting ? '#cbd5e1' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
