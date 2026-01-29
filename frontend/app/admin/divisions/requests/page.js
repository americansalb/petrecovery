'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Building2,
  FileText,
  RefreshCw
} from 'lucide-react';

export default function AdminDivisionRequestsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approveModal, setApproveModal] = useState(null);
  const [approveOverrides, setApproveOverrides] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else if (session) {
      loadRequests();
    }
  }, [session, filter]);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/divisions/requests?status=${filter}`);
      if (!res.ok) throw new Error('Failed to load requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approveModal) return;

    setProcessing(approveModal.id);
    setError('');
    setApproveModal(null);

    try {
      const body = {};
      if (approveOverrides.name) body.name = approveOverrides.name;
      if (approveOverrides.description) body.description = approveOverrides.description;

      const res = await fetch(`/api/admin/divisions/approve/${approveModal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve request');
      }

      setSuccessMessage(`Division "${approveModal.proposedName}" has been approved and created!`);
      setApproveOverrides({ name: '', description: '' });
      loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectionReason.trim()) return;

    setProcessing(rejectModal.id);
    setError('');
    setRejectModal(null);

    try {
      const res = await fetch(`/api/admin/divisions/reject/${rejectModal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject request');
      }

      setSuccessMessage(`Division request has been rejected.`);
      setRejectionReason('');
      loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      PENDING: { bg: '#fef3c7', color: '#92400e', icon: Clock, label: 'Pending Review' },
      APPROVED: { bg: '#d1fae5', color: '#065f46', icon: CheckCircle, label: 'Approved' },
      REJECTED: { bg: '#fee2e2', color: '#991b1b', icon: XCircle, label: 'Rejected' }
    };
    const config = configs[status] || configs.PENDING;
    const Icon = config.icon;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        background: config.bg,
        color: config.color,
        borderRadius: '9999px',
        fontSize: '0.85rem',
        fontWeight: '600'
      }}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '2rem 1rem'
    }}>
      {/* Approve Modal */}
      {approveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle size={24} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.25rem' }}>
                  Approve Division Request
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  This will create a new division in the squad
                </p>
              </div>
            </div>

            <div style={{
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '0.25rem' }}>
                Proposed: {approveModal.proposedName}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                For: {approveModal.rescueSquad?.name}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#374151',
                fontSize: '0.9rem'
              }}>
                Division Name (optional override)
              </label>
              <input
                type="text"
                placeholder={approveModal.proposedName}
                value={approveOverrides.name}
                onChange={(e) => setApproveOverrides(prev => ({ ...prev, name: e.target.value }))}
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
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#374151',
                fontSize: '0.9rem'
              }}>
                Description (optional)
              </label>
              <textarea
                placeholder="Add a description for this division..."
                value={approveOverrides.description}
                onChange={(e) => setApproveOverrides(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setApproveModal(null);
                  setApproveOverrides({ name: '', description: '' });
                }}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Approve & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <XCircle size={24} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.25rem' }}>
                  Reject Division Request
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  Please provide a reason for the requester
                </p>
              </div>
            </div>

            <div style={{
              padding: '1rem',
              background: '#fef2f2',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '0.25rem' }}>
                Rejecting: {rejectModal.proposedName}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                Requested by: {rejectModal.requester?.firstName} {rejectModal.requester?.lastName}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#374151',
                fontSize: '0.9rem'
              }}>
                Rejection Reason *
              </label>
              <textarea
                placeholder="Explain why this request is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectionReason('');
                }}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: !rejectionReason.trim() ? '#cbd5e1' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: !rejectionReason.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#d1fae5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '1rem 2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <CheckCircle size={20} />
          <span style={{ fontWeight: '600' }}>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#065f46',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0 0.5rem'
            }}
          >
            &times;
          </button>
        </div>
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.5rem'
        }}>
          <div>
            <Link
              href="/admin/divisions"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#4f46e5',
                textDecoration: 'none',
                fontWeight: '600',
                marginBottom: '1rem'
              }}
            >
              <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
              Back to Divisions
            </Link>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '0.5rem',
              letterSpacing: '-0.025em'
            }}>
              Division Requests
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#64748b' }}>
              Review and approve community division proposals
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {filter === 'PENDING' && pendingCount > 0 && (
              <div style={{
                padding: '0.75rem 1.25rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: 'white',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.9rem',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}>
                {pendingCount} Pending
              </div>
            )}
            <button
              onClick={loadRequests}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: '1rem 1.5rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={20} />
            <span style={{ flex: 1, fontWeight: '500' }}>{error}</span>
            <button
              onClick={() => setError('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: '1.25rem',
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          background: 'white',
          padding: '0.5rem',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          width: 'fit-content'
        }}>
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: '0.75rem 1.5rem',
                background: filter === status
                  ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                  : 'transparent',
                color: filter === status ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {status === 'ALL' ? 'All Requests' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e2e8f0',
              borderTopColor: '#4f46e5',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#64748b', fontWeight: '500' }}>Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <FileText size={36} color="#94a3b8" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
              No {filter === 'ALL' ? '' : filter.toLowerCase()} requests
            </h3>
            <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
              {filter === 'PENDING'
                ? 'All caught up! No division requests waiting for review.'
                : `No ${filter.toLowerCase()} division requests to display.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {requests.map(request => (
              <div
                key={request.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: request.status === 'PENDING'
                    ? '2px solid #fbbf24'
                    : '1px solid #e2e8f0',
                  transition: 'all 0.2s'
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {request.proposedName}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      color: '#64748b',
                      fontSize: '0.95rem',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Building2 size={16} />
                        {request.rescueSquad?.name || 'Unknown Force'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Users size={16} />
                        {request.requester?.firstName} {request.requester?.lastName}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Clock size={16} />
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Justification */}
                <div style={{
                  padding: '1.25rem',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '1.5rem'
                }}>
                  <h4 style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.5rem'
                  }}>
                    Justification
                  </h4>
                  <p style={{
                    color: '#0f172a',
                    lineHeight: '1.6',
                    fontSize: '0.95rem'
                  }}>
                    {request.justification}
                  </p>
                </div>

                {/* Geographic Details */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  {request.zipCodes && (
                    <div style={{
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                        ZIP CODES
                      </div>
                      <div style={{ color: '#0f172a', fontWeight: '600' }}>
                        {(() => {
                          try {
                            const zips = JSON.parse(request.zipCodes);
                            return Array.isArray(zips) ? zips.join(', ') : request.zipCodes;
                          } catch {
                            return request.zipCodes;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                  {request.estimatedRadius && (
                    <div style={{
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                        RADIUS
                      </div>
                      <div style={{ color: '#0f172a', fontWeight: '600' }}>
                        {request.estimatedRadius} miles
                      </div>
                    </div>
                  )}
                  {request.estimatedPopulation && (
                    <div style={{
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                        EST. POPULATION
                      </div>
                      <div style={{ color: '#0f172a', fontWeight: '600' }}>
                        {request.estimatedPopulation.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {request.centerLatitude && request.centerLongitude && (
                    <div style={{
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                        CENTER COORDS
                      </div>
                      <div style={{ color: '#0f172a', fontWeight: '600', fontSize: '0.9rem' }}>
                        {request.centerLatitude.toFixed(4)}, {request.centerLongitude.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {request.notes && (
                  <div style={{
                    padding: '1rem',
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: '8px',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: '600', marginBottom: '0.25rem' }}>
                      ADDITIONAL NOTES
                    </div>
                    <p style={{ color: '#78350f', fontSize: '0.9rem' }}>
                      {request.notes}
                    </p>
                  </div>
                )}

                {/* Rejection Reason (if rejected) */}
                {request.status === 'REJECTED' && request.rejectionReason && (
                  <div style={{
                    padding: '1rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: '600', marginBottom: '0.25rem' }}>
                      REJECTION REASON
                    </div>
                    <p style={{ color: '#7f1d1d', fontSize: '0.9rem' }}>
                      {request.rejectionReason}
                    </p>
                    {request.reviewedBy && (
                      <p style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        Rejected by {request.reviewedBy.firstName} {request.reviewedBy.lastName} on{' '}
                        {new Date(request.reviewedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Approved Division Info */}
                {request.status === 'APPROVED' && request.approvedDivision && (
                  <div style={{
                    padding: '1rem',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '600', marginBottom: '0.25rem' }}>
                      CREATED DIVISION
                    </div>
                    <div style={{ color: '#14532d', fontWeight: '600' }}>
                      {request.approvedDivision.name}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#15803d' }}>
                      <span>{request.approvedDivision.totalMembers || 0} members</span>
                      <span>{request.approvedDivision.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    {request.reviewedBy && (
                      <p style={{ color: '#22c55e', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        Approved by {request.reviewedBy.firstName} {request.reviewedBy.lastName} on{' '}
                        {new Date(request.reviewedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons (only for pending) */}
                {request.status === 'PENDING' && (
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <button
                      onClick={() => setApproveModal(request)}
                      disabled={processing === request.id}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '1rem',
                        background: processing === request.id
                          ? '#e2e8f0'
                          : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: processing === request.id ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      <CheckCircle size={18} />
                      {processing === request.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setRejectModal(request)}
                      disabled={processing === request.id}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '1rem',
                        background: 'white',
                        color: '#dc2626',
                        border: '2px solid #dc2626',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: processing === request.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
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
