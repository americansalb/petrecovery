'use client';

/**
 * Admin Shelter Requests Page
 *
 * Review and approve/reject shelter account requests.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/Toast';
import Link from 'next/link';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Clock,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Send,
  FileText,
  Calendar,
  Briefcase,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
];

export default function AdminShelterRequestsPage() {
  const toast = useToast();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [expandedClaim, setExpandedClaim] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/shelters/requests');
    } else if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchRequests();
    }
  }, [session, filter]);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/shelters/requests?filter=${filter}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch requests');
      }

      setClaims(data.claims || []);
      setStats(data.stats || { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (claimId) => {
    setProcessingId(claimId);
    try {
      const response = await fetch('/api/admin/shelters/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          action: 'APPROVE',
          reviewNotes: reviewNotes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve request');
      }

      setShowReviewModal(null);
      setReviewNotes('');
      fetchRequests();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (claimId) => {
    if (!reviewNotes.trim()) {
      toast.warning('Please provide a reason for rejection');
      return;
    }

    setProcessingId(claimId);
    try {
      const response = await fetch('/api/admin/shelters/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId,
          action: 'REJECT',
          reviewNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject request');
      }

      setShowReviewModal(null);
      setReviewNotes('');
      fetchRequests();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
      VERIFICATION_SENT: { color: 'bg-blue-100 text-blue-700', icon: Send, label: 'Verification Sent' },
      UNDER_REVIEW: { color: 'bg-purple-100 text-purple-700', icon: Eye, label: 'Under Review' },
      APPROVED: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Approved' },
      REJECTED: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' },
    };
    const config = statusMap[status] || { color: 'bg-gray-100 text-gray-700', icon: AlertCircle, label: status };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  if (status === 'loading' || (session?.user?.role === 'ADMIN' && loading && !claims.length)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href="/admin" className="hover:text-blue-600">Admin</Link>
                <span>/</span>
                <Link href="/admin/shelters" className="hover:text-blue-600">Shelters</Link>
                <span>/</span>
                <span>Requests</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-7 h-7 text-indigo-600" />
                Shelter Requests
              </h1>
            </div>
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div
            onClick={() => setFilter('pending')}
            className={`bg-white rounded-xl p-5 shadow-sm border-2 cursor-pointer transition-all ${
              filter === 'pending' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pending Review</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setFilter('approved')}
            className={`bg-white rounded-xl p-5 shadow-sm border-2 cursor-pointer transition-all ${
              filter === 'approved' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.approved}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setFilter('rejected')}
            className={`bg-white rounded-xl p-5 shadow-sm border-2 cursor-pointer transition-all ${
              filter === 'rejected' ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.rejected}</p>
                <p className="text-sm text-gray-500">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-2">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400 ml-2" />
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === opt.value
                    ? opt.color
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Claims List */}
        <div className="space-y-4">
          {claims.length === 0 && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
              <p className="text-gray-500">
                {filter === 'pending'
                  ? 'No pending shelter requests to review'
                  : filter === 'approved'
                  ? 'No approved requests yet'
                  : filter === 'rejected'
                  ? 'No rejected requests'
                  : 'No shelter requests found'}
              </p>
            </div>
          )}

          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Claim Header */}
              <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {claim.shelter?.name || 'Unknown Shelter'}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {claim.shelter?.city}, {claim.shelter?.state}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(claim.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(claim.status)}
                    {expandedClaim === claim.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedClaim === claim.id && (
                <div className="border-t border-gray-100 p-5 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Shelter Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                        Shelter Details
                      </h4>
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{claim.shelter?.name}</p>
                            <p className="text-xs text-gray-500">
                              {claim.shelter?.type || 'SHELTER'}
                            </p>
                          </div>
                        </div>
                        {claim.shelter?.email && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-gray-400" />
                            <a href={`mailto:${claim.shelter.email}`} className="text-sm text-blue-600 hover:underline">
                              {claim.shelter.email}
                            </a>
                          </div>
                        )}
                        {claim.shelter?.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-gray-400" />
                            <a href={`tel:${claim.shelter.phone}`} className="text-sm text-gray-900">
                              {claim.shelter.phone}
                            </a>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                          <p className="text-sm text-gray-900">
                            {claim.shelter?.city}, {claim.shelter?.state}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Claimant Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                        Requested By
                      </h4>
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {claim.claimant?.firstName} {claim.claimant?.lastName}
                            </p>
                            <p className="text-xs text-gray-500">User ID: {claim.claimant?.id?.slice(0, 8)}...</p>
                          </div>
                        </div>
                        {claim.claimant?.email && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-gray-400" />
                            <a href={`mailto:${claim.claimant.email}`} className="text-sm text-blue-600 hover:underline">
                              {claim.claimant.email}
                            </a>
                          </div>
                        )}
                        {claim.verificationData?.role && (
                          <div className="flex items-center gap-3">
                            <Briefcase className="w-5 h-5 text-gray-400" />
                            <p className="text-sm text-gray-900">
                              Role: {claim.verificationData.role}
                            </p>
                          </div>
                        )}
                        {claim.verificationData?.about && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500 mb-1">About / Message:</p>
                            <p className="text-sm text-gray-700 italic">
                              "{claim.verificationData.about}"
                            </p>
                          </div>
                        )}
                        {claim.verificationData?.howHeard && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500">How they heard about us:</p>
                            <p className="text-sm text-gray-700">{claim.verificationData.howHeard}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Review Notes (if already reviewed) */}
                  {claim.reviewNotes && (
                    <div className="mt-4 bg-white rounded-lg p-4 border-l-4 border-gray-300">
                      <p className="text-xs font-medium text-gray-500 mb-1">Review Notes:</p>
                      <p className="text-sm text-gray-700">{claim.reviewNotes}</p>
                    </div>
                  )}

                  {/* Action Buttons (only for pending) */}
                  {['PENDING', 'VERIFICATION_SENT', 'UNDER_REVIEW'].includes(claim.status) && (
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReviewModal({ id: claim.id, action: 'approve' });
                        }}
                        disabled={processingId === claim.id}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReviewModal({ id: claim.id, action: 'reject' });
                        }}
                        disabled={processingId === claim.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {showReviewModal.action === 'approve' ? 'Approve Request' : 'Reject Request'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {showReviewModal.action === 'approve'
                  ? 'Optionally add notes for this approval. The shelter will be activated and the user notified.'
                  : 'Please provide a reason for rejection. This will be sent to the requester.'}
              </p>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  showReviewModal.action === 'approve'
                    ? 'Optional notes...'
                    : 'Reason for rejection (required)...'
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                rows={4}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowReviewModal(null);
                    setReviewNotes('');
                  }}
                  disabled={processingId}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                {showReviewModal.action === 'approve' ? (
                  <button
                    onClick={() => handleApprove(showReviewModal.id)}
                    disabled={processingId}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {processingId ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve
                  </button>
                ) : (
                  <button
                    onClick={() => handleReject(showReviewModal.id)}
                    disabled={processingId || !reviewNotes.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {processingId ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Reject
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
