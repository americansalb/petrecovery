'use client';

/**
 * Admin Case Detail Page
 * Phase 13-14: Lost Pet Cases MVP (TASK-C03-A)
 *
 * Shows complete case details with notes timeline and status update controls
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdmin } from '@/app/lib/permissions';

export default function CaseDetailPage({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Case data
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [legalError, setLegalError] = useState(null);

  // Status update state
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Note state
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Assignment state (Phase 22-24: TASK-R05)
  const [availableCoordinators, setAvailableCoordinators] = useState([]);
  const [availableSquads, setAvailableSquads] = useState([]);
  const [assigningCoordinator, setAssigningCoordinator] = useState(false);
  const [assigningSquad, setAssigningSquad] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState(null);

  // Auth check and redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent('/admin/cases/' + params.id));
    } else if (status === 'authenticated' && !isAdmin(session)) {
      router.push('/dashboard');
    }
  }, [status, session, router, params.id]);

  // Fetch case data
  useEffect(() => {
    if (status === 'authenticated' && isAdmin(session)) {
      fetchCase();
      fetchAssignmentOptions();
    }
  }, [status, session, params.id]);

  const fetchAssignmentOptions = async () => {
    try {
      // Fetch available coordinators (ADMIN/MODERATOR users)
      const usersResponse = await fetch('/api/users');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        const staffUsers = usersData.users.filter(u =>
          u.role === 'ADMIN' || u.role === 'MODERATOR'
        );
        setAvailableCoordinators(staffUsers);
      }

      // Fetch active squads
      const squadsResponse = await fetch('/api/squads');
      if (squadsResponse.ok) {
        const squadsData = await squadsResponse.json();
        const activeSquads = squadsData.squads.filter(s => s.isActive);
        setAvailableSquads(activeSquads);
      }
    } catch (err) {
      console.error('Failed to fetch assignment options:', err);
    }
  };

  const fetchCase = async () => {
    setLoading(true);
    setError(null);
    setLegalError(null);

    try {
      const response = await fetch('/api/cases/' + params.id);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          return;
        }
        if (response.status === 404) {
          setError('Case not found');
          return;
        }
        throw new Error(data.error || 'Failed to fetch case');
      }

      setCaseData(data.case);
      setNewStatus(data.case.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === caseData.status) return;

    setUpdatingStatus(true);
    try {
      const response = await fetch('/api/cases/' + params.id + '/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          statusReason: statusReason.trim() || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          return;
        }
        throw new Error(data.error || 'Failed to update status');
      }

      setStatusReason('');
      await fetchCase();
    } catch (err) {
      alert('Error updating status: ' + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setAddingNote(true);
    try {
      const response = await fetch('/api/cases/' + params.id + '/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          return;
        }
        throw new Error(data.error || 'Failed to add note');
      }

      setNoteContent('');
      await fetchCase();
    } catch (err) {
      alert('Error adding note: ' + err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleCoordinatorAssignment = async (coordinatorId) => {
    setAssigningCoordinator(true);
    setAssignmentMessage(null);

    try {
      const response = await fetch('/api/cases/' + params.id + '/assign-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinatorId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to assign coordinator');
      }

      setAssignmentMessage({ type: 'success', text: data.message });
      await fetchCase();
      setTimeout(() => setAssignmentMessage(null), 3000);
    } catch (err) {
      setAssignmentMessage({ type: 'error', text: err.message });
      setTimeout(() => setAssignmentMessage(null), 5000);
    } finally {
      setAssigningCoordinator(false);
    }
  };

  const handleSquadAssignment = async (squadId) => {
    setAssigningSquad(true);
    setAssignmentMessage(null);

    try {
      const response = await fetch('/api/cases/' + params.id + '/assign-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to assign squad');
      }

      setAssignmentMessage({ type: 'success', text: data.message });
      await fetchCase();
      setTimeout(() => setAssignmentMessage(null), 3000);
    } catch (err) {
      setAssignmentMessage({ type: 'error', text: err.message });
      setTimeout(() => setAssignmentMessage(null), 5000);
    } finally {
      setAssigningSquad(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">📋</div>
          <div className="text-gray-500">Loading case...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/admin/cases"
            className="inline-block px-4 py-2 bg-white border border-gray-300 rounded-lg mb-4 hover:bg-gray-50"
          >
            ← Back to Cases
          </Link>
          <div className="p-8 bg-red-50 border border-red-200 rounded-xl text-red-800">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    'OPEN': 'bg-blue-100 text-blue-800',
    'ACTIVE_SEARCH': 'bg-yellow-100 text-yellow-800',
    'RESOLVED': 'bg-green-100 text-green-800',
    'CLOSED_OTHER': 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/admin/cases"
          className="inline-block px-4 py-2 bg-white border border-gray-300 rounded-lg mb-4 hover:bg-gray-50"
        >
          ← Back to Cases
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">
              {caseData.caseNumber}
              <span className="ml-2 text-xs px-2 py-1 bg-red-100 text-red-800 rounded font-semibold">
                🔒 ADMIN ONLY
              </span>
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[caseData.status] || 'bg-gray-100 text-gray-800'}`}>
              {caseData.status.replace(/_/g, ' ')}
            </span>
            {caseData.isUrgent && (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                ⚠️ URGENT
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {caseData.city}, {caseData.state}
          </p>
        </div>

        {/* Legal Error Banner */}
        {legalError && (
          <div className="p-6 bg-yellow-50 border-2 border-yellow-400 rounded-xl mb-8">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <div className="font-bold text-yellow-900 mb-1">
                  Legal Agreement Required
                </div>
                <div className="text-yellow-800 text-sm">
                  {legalError.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(legalError.redirectTo)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
            >
              Review & Accept Now →
            </button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pet Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pet Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Name" value={caseData.petName || '—'} />
                <Field label="Species" value={caseData.petSpecies} />
                <Field label="Breed" value={caseData.petBreed || '—'} />
                <Field label="Color" value={caseData.petColor || '—'} />
                <div className="md:col-span-2">
                  <Field label="Description" value={caseData.petDescription || '—'} />
                </div>
              </div>
            </div>

            {/* Last Seen Location */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Last Seen Location</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="City" value={caseData.city} />
                <Field label="State" value={caseData.state} />
                <Field label="ZIP Code" value={caseData.zipCode || '—'} />
                <Field label="Landmark" value={caseData.lastSeenLandmark || '—'} />
                <div className="md:col-span-2">
                  <Field
                    label="Last Seen At"
                    value={caseData.lastSeenAt ? new Date(caseData.lastSeenAt).toLocaleString() : '—'}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Name" value={caseData.contactName || '—'} />
                <Field label="Phone" value={caseData.contactPhone || '—'} />
                <Field label="Email" value={caseData.contactEmail || '—'} />
              </div>
            </div>

            {/* Case Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Notes</h2>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="mb-6">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add a note to this case..."
                  rows={3}
                  disabled={addingNote}
                  className="w-full p-3 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={addingNote || !noteContent.trim()}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 ${(addingNote || !noteContent.trim()) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  {addingNote ? 'Adding...' : 'Add Note'}
                </button>
              </form>

              {/* Notes List */}
              <div className="space-y-4">
                {caseData.notes && caseData.notes.length > 0 ? (
                  caseData.notes.map((note) => {
                    const typeColors = {
                      'STATUS_CHANGE': 'bg-yellow-50 border-yellow-200 text-yellow-800',
                      'NOTE': 'bg-gray-50 border-gray-200 text-gray-800'
                    };
                    const typeColor = typeColors[note.type] || typeColors['NOTE'];

                    return (
                      <div key={note.id} className={`p-4 rounded-lg border ${typeColor}`}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-bold uppercase px-2 py-0.5 bg-white bg-opacity-50 rounded">
                            {note.type.replace('_', ' ')}
                          </span>
                          <span className="text-sm font-medium">
                            {note.author.firstName} {note.author.lastName || ''}
                          </span>
                          <span className="text-sm opacity-75">
                            • {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">
                          {note.content}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    No notes yet. Add the first note above.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-8">
            {/* Status Update Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Status</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  disabled={updatingStatus}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="OPEN">Open</option>
                  <option value="ACTIVE_SEARCH">Active Search</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED_OTHER">Closed (Other)</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Reason for status change..."
                  rows={3}
                  disabled={updatingStatus}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleStatusUpdate}
                disabled={updatingStatus || newStatus === caseData.status}
                className={`w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 ${(updatingStatus || newStatus === caseData.status) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                {updatingStatus ? 'Updating...' : 'Update Status'}
              </button>
            </div>

            {/* Case Assignment */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Assignment</h2>

              {/* Success/Error Messages */}
              {assignmentMessage && (
                <div className={`p-3 rounded-lg mb-4 text-sm ${assignmentMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}>
                  {assignmentMessage.text}
                </div>
              )}

              {/* Coordinator Assignment */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coordinator
                </label>
                <select
                  value={caseData.coordinatorId || ''}
                  onChange={(e) => handleCoordinatorAssignment(e.target.value || null)}
                  disabled={assigningCoordinator}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Unassigned</option>
                  {availableCoordinators.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName || ''} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Squad Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rescue Squad
                </label>
                <select
                  value={caseData.squadId || ''}
                  onChange={(e) => handleSquadAssignment(e.target.value || null)}
                  disabled={assigningSquad}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Unassigned</option>
                  {availableSquads.map(squad => (
                    <option key={squad.id} value={squad.id}>
                      {squad.name} ({squad.city}, {squad.state})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900 font-medium">
        {value}
      </dd>
    </div>
  );
}
