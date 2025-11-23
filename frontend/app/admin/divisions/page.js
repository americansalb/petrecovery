'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDivisionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else if (session) {
      fetchRequests();
    }
  }, [session, filter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/divisions/requests?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching division requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!confirm('Are you sure you want to approve this division request?')) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/divisions/approve/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Can include overrides if needed
      });

      if (res.ok) {
        alert('Division request approved successfully!');
        fetchRequests();
        setSelectedRequest(null);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/divisions/reject/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason })
      });

      if (res.ok) {
        alert('Division request rejected');
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

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
              Division Management
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Create divisions and review requests {pendingCount > 0 && `(${pendingCount} pending)`}
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
              href="/rescue-squads"
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

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          borderBottom: '2px solid #f1f5f9',
          paddingBottom: '1rem'
        }}>
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: '0.5rem 1rem',
                background: filter === status ? '#667eea' : 'transparent',
                color: filter === status ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {status}
            </button>
          ))}
        </div>

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
            <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading requests...</div>
          </div>
        ) : requests.length === 0 ? (
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
              No {filter !== 'ALL' && filter.toLowerCase()} division requests
            </h2>
            <p style={{ color: '#64748b' }}>
              Check back later for new requests
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
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
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{
                      fontSize: '1.8rem',
                      fontWeight: '700',
                      color: '#0f172a',
                      marginBottom: '0.5rem'
                    }}>
                      {request.proposedName}
                    </h2>
                    <div style={{
                      fontSize: '1rem',
                      color: '#64748b',
                      marginBottom: '0.5rem'
                    }}>
                      For: <strong>{request.rescueSquad?.name}</strong>
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#94a3b8'
                    }}>
                      Requested by: {request.requester.firstName} {request.requester.lastName} ({request.requester.email})
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#94a3b8'
                    }}>
                      Submitted: {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {request.status === 'PENDING' && (
                      <span style={{
                        padding: '0.5rem 1rem',
                        background: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700'
                      }}>
                        ⏳ Pending Review
                      </span>
                    )}
                    {request.status === 'APPROVED' && (
                      <span style={{
                        padding: '0.5rem 1rem',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700'
                      }}>
                        ✓ Approved
                      </span>
                    )}
                    {request.status === 'REJECTED' && (
                      <span style={{
                        padding: '0.5rem 1rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700'
                      }}>
                        ✗ Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* Justification */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '0.75rem'
                  }}>
                    Justification
                  </h3>
                  <p style={{
                    color: '#64748b',
                    lineHeight: '1.6'
                  }}>
                    {request.justification}
                  </p>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  {/* Squad Info */}
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      marginBottom: '0.25rem'
                    }}>
                      Rescue Squad
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#0f172a'
                    }}>
                      {request.rescueSquad?.name}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#64748b'
                    }}>
                      {request.rescueSquad?._count?.members} members • {request.rescueSquad?._count?.divisions || 0} divisions
                    </div>
                  </div>

                  {/* ZIP Codes */}
                  {request.zipCodes && request.zipCodes !== '[]' && (
                    <div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        marginBottom: '0.25rem'
                      }}>
                        ZIP Codes
                      </div>
                      <div style={{
                        fontSize: '0.95rem',
                        color: '#0f172a'
                      }}>
                        {JSON.parse(request.zipCodes).join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Radius */}
                  {request.estimatedRadius && (
                    <div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        marginBottom: '0.25rem'
                      }}>
                        Radius
                      </div>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {request.estimatedRadius} miles
                      </div>
                    </div>
                  )}

                  {/* Population */}
                  {request.estimatedPopulation && (
                    <div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        marginBottom: '0.25rem'
                      }}>
                        Est. Population
                      </div>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {request.estimatedPopulation.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {request.notes && (
                  <div style={{
                    background: '#fef3c7',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: '#92400e',
                      marginBottom: '0.5rem'
                    }}>
                      Additional Notes
                    </div>
                    <div style={{
                      fontSize: '0.95rem',
                      color: '#78350f'
                    }}>
                      {request.notes}
                    </div>
                  </div>
                )}

                {/* Rejection Reason */}
                {request.status === 'REJECTED' && request.rejectionReason && (
                  <div style={{
                    background: '#fef2f2',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    borderLeft: '4px solid #ef4444'
                  }}>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: '#991b1b',
                      marginBottom: '0.5rem'
                    }}>
                      Rejection Reason
                    </div>
                    <div style={{
                      fontSize: '0.95rem',
                      color: '#991b1b'
                    }}>
                      {request.rejectionReason}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      marginTop: '0.5rem'
                    }}>
                      Reviewed by: {request.reviewedBy?.firstName} {request.reviewedBy?.lastName} on {new Date(request.reviewedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {/* Approved Division Info */}
                {request.status === 'APPROVED' && request.approvedDivision && (
                  <div style={{
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    borderLeft: '4px solid #10b981'
                  }}>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: '#065f46',
                      marginBottom: '0.5rem'
                    }}>
                      Division Created
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: '#065f46'
                    }}>
                      {request.approvedDivision.name} - {request.approvedDivision.totalMembers} members, {request.approvedDivision.activeCases} active cases
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      marginTop: '0.5rem'
                    }}>
                      Approved by: {request.reviewedBy?.firstName} {request.reviewedBy?.lastName} on {new Date(request.reviewedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {request.status === 'PENDING' && (
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRejectModal(true);
                      }}
                      disabled={actionLoading}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: '2px solid #fecaca',
                        borderRadius: '8px',
                        fontWeight: '700',
                        cursor: actionLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={actionLoading}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        cursor: actionLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Approve & Create Division
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
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
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '1rem'
              }}>
                Reject Division Request
              </h2>
              <p style={{
                color: '#64748b',
                marginBottom: '1.5rem'
              }}>
                Provide a reason for rejecting "{selectedRequest?.proposedName}"
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  marginBottom: '1.5rem'
                }}
              />
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                    setSelectedRequest(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !rejectionReason.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: (actionLoading || !rejectionReason.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (actionLoading || !rejectionReason.trim()) ? 0.5 : 1
                  }}
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
