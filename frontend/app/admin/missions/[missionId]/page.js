'use client';

/**
 * Admin Case Detail Page
 * Phase 13-14: Lost Pet Missions MVP (TASK-C03-A)
 *
 * Shows complete case details with notes timeline and status update controls
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { isAdmin } from '@/app/lib/permissions';

export default function CaseDetailPage({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Case data
  const [missionData, setMissionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [legalError, setLegalError] = useState(null);

  // Status update state
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState(null);

  // Note state
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);

  // Assignment state (Phase 22-24: TASK-R05)
  const [availableCoordinators, setAvailableCoordinators] = useState([]);
  const [availableSquads, setAvailableSquads] = useState([]);
  const [assigningCoordinator, setAssigningCoordinator] = useState(false);
  const [assigningSquad, setAssigningSquad] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState(null); // { type: 'success' | 'error', text: '...' }

  // Auth check and redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent('/admin/missions/' + params.id));
    } else if (status === 'authenticated' && !isAdmin(session)) {
      router.push('/dashboard');
    }
  }, [status, session, router, params.id]);

  // Fetch case data
  useEffect(() => {
    if (status === 'authenticated' && isAdmin(session)) {
      fetchMission();
    }
  }, [status, session, params.id]);

  // Fetch assignment options (Phase 22-24: TASK-R05)
  useEffect(() => {
    if (status === 'authenticated' && isAdmin(session)) {
      fetchAssignmentOptions();
    }
  }, [status, session]);

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

  const fetchMission = async () => {
    setLoading(true);
    setError(null);
    setLegalError(null);

    try {
      const response = await fetch('/api/missions/' + params.id);
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
          setError('Mission not found');
          return;
        }
        throw new Error(data.error || 'Failed to fetch case');
      }

      setMissionData(data.case);
      setNewStatus(data.case.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === missionData.status) return;

    setUpdatingStatus(true);
    setStatusUpdateError(null);
    try {
      const response = await fetch('/api/missions/' + params.id + '/status', {
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
      await fetchMission();
    } catch (err) {
      setStatusUpdateError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setAddingNote(true);
    setNoteError(null);
    try {
      const response = await fetch('/api/missions/' + params.id + '/notes', {
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
      await fetchMission();
    } catch (err) {
      setNoteError(err.message);
    } finally {
      setAddingNote(false);
    }
  };

  // Phase 22-24: TASK-R05 - Assignment handlers
  const handleCoordinatorAssignment = async (coordinatorId) => {
    setAssigningCoordinator(true);
    setAssignmentMessage(null);

    try {
      const response = await fetch('/api/missions/' + params.id + '/assign-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinatorId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to assign coordinator');
      }

      setAssignmentMessage({ type: 'success', text: data.message });
      await fetchMission();
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
      const response = await fetch('/api/missions/' + params.id + '/assign-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to assign rescue force');
      }

      setAssignmentMessage({ type: 'success', text: data.message });
      await fetchMission();
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
          <div style={{ color: '#64748b' }}>Loading case...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <button
            onClick={() => router.push('/admin/missions')}
            style={{
              padding: '0.5rem 1rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            ← Back to Cases
          </button>
          <div style={{
            padding: '2rem',
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            color: '#991b1b'
          }}>
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!missionData) {
    return null;
  }

  const statusColors = {
    'OPEN': { bg: '#dbeafe', color: '#1e40af' },
    'ACTIVE_SEARCH': { bg: '#fef3c7', color: '#92400e' },
    'RESOLVED': { bg: '#d1fae5', color: '#065f46' },
    'CLOSED_OTHER': { bg: '#e5e7eb', color: '#374151' }
  };
  const statusColor = statusColors[missionData.status] || statusColors['OPEN'];

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Back Button */}
        <button
          onClick={() => router.push('/admin/missions')}
          style={{
            padding: '0.5rem 1rem',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '1rem'
          }}
        >
          ← Back to Cases
        </button>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', margin: 0 }}>
              {missionData.missionNumber}
              <span style={{
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                borderRadius: '0.25rem',
                fontWeight: '600',
                marginLeft: '0.5rem'
              }}>
                🔒 ADMIN ONLY
              </span>
            </h1>
            <span style={{
              padding: '0.5rem 1rem',
              background: statusColor.bg,
              color: statusColor.color,
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {missionData.status.replace('_', ' ')}
            </span>
            {missionData.isUrgent && (
              <span style={{
                padding: '0.5rem 1rem',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}>
                ⚠️ URGENT
              </span>
            )}
          </div>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {missionData.city}, {missionData.state}
          </p>
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

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Left Column */}
          <div>
            {/* Pet Information */}
            <Section title="Pet Information">
              <Field label="Name" value={missionData.petName || '-'} />
              <Field label="Species" value={missionData.petSpecies} />
              <Field label="Breed" value={missionData.petBreed || '-'} />
              <Field label="Color" value={missionData.petColor || '-'} />
              <Field label="Description" value={missionData.petDescription || '-'} />
            </Section>

            {/* Last Seen Location */}
            <Section title="Last Seen Location">
              <Field label="City" value={missionData.city} />
              <Field label="State" value={missionData.state} />
              <Field label="ZIP Code" value={missionData.zipCode || '-'} />
              <Field label="Landmark" value={missionData.lastSeenLandmark || '-'} />
              <Field
                label="Last Seen At"
                value={missionData.lastSeenAt ? new Date(missionData.lastSeenAt).toLocaleString() : '-'}
              />
            </Section>

            {/* Contact Information */}
            <Section title="Contact Information">
              <Field label="Name" value={missionData.contactName || '-'} />
              <Field label="Phone" value={missionData.contactPhone || '-'} />
              <Field label="Email" value={missionData.contactEmail || '-'} />
            </Section>

            {/* Case Notes */}
            <Section title="Case Notes">
              {/* Add Note Form */}
              <form onSubmit={handleAddNote} style={{ marginBottom: '1.5rem' }}>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add a note to this case..."
                  rows={3}
                  disabled={addingNote}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                    resize: 'vertical'
                  }}
                />
                {noteError && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem'
                  }}>
                    Error: {noteError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={addingNote || !noteContent.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    opacity: (addingNote || !noteContent.trim()) ? 0.5 : 1
                  }}
                >
                  {addingNote ? 'Adding...' : 'Add Note'}
                </button>
              </form>

              {/* Notes List */}
              <div>
                {missionData.notes && missionData.notes.length > 0 ? (
                  missionData.notes.map((note) => {
                    const typeColors = {
                      'STATUS_CHANGE': { bg: '#fef3c7', color: '#92400e', label: 'Status Change' },
                      'NOTE': { bg: '#e0e7ff', color: '#3730a3', label: 'Note' }
                    };
                    const typeColor = typeColors[note.type] || typeColors['NOTE'];

                    return (
                      <div key={note.id} style={{
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        borderLeft: '3px solid ' + typeColor.color,
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            background: typeColor.bg,
                            color: typeColor.color,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {typeColor.label}
                          </span>
                          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {note.author.firstName} {note.author.lastName || ''}
                          </span>
                          <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                            • {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                          {note.content}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    color: '#9ca3af',
                    textAlign: 'center',
                    padding: '2rem 1rem',
                    background: '#f9fafb',
                    borderRadius: '8px'
                  }}>
                    No notes yet. Add the first note above.
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* Right Column */}
          <div>
            {/* Status Update Controls */}
            <Section title="Update Status">
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  disabled={updatingStatus}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="OPEN">Open</option>
                  <option value="ACTIVE_SEARCH">Active Search</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED_OTHER">Closed (Other)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Reason (optional)
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Reason for status change..."
                  rows={3}
                  disabled={updatingStatus}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {statusUpdateError && (
                <div style={{
                  padding: '0.75rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#dc2626',
                  fontSize: '0.875rem',
                  marginBottom: '1rem'
                }}>
                  Error: {statusUpdateError}
                </div>
              )}

              <button
                onClick={handleStatusUpdate}
                disabled={updatingStatus || newStatus === missionData.status}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: (updatingStatus || newStatus === missionData.status) ? 0.5 : 1
                }}
              >
                {updatingStatus ? 'Updating...' : 'Update Status'}
              </button>
            </Section>

            {/* Phase 22-24: TASK-R05 - Assignment Controls */}
            <Section title="Case Assignment">
              {/* Success/Error Messages */}
              {assignmentMessage && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  background: assignmentMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
                  color: assignmentMessage.type === 'success' ? '#065f46' : '#991b1b',
                  fontSize: '0.875rem'
                }}>
                  {assignmentMessage.text}
                </div>
              )}

              {/* Coordinator Assignment */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Coordinator
                </label>
                <select
                  value={missionData.coordinatorId || ''}
                  onChange={(e) => handleCoordinatorAssignment(e.target.value || null)}
                  disabled={assigningCoordinator}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    opacity: assigningCoordinator ? 0.5 : 1
                  }}
                >
                  <option value="">Unassigned</option>
                  {availableCoordinators.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName || ''} ({user.role})
                    </option>
                  ))}
                </select>
                {assigningCoordinator && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Updating...
                  </div>
                )}
              </div>

              {/* Squad Assignment */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Owning Squad
                </label>
                <select
                  value={missionData.squadId || ''}
                  onChange={(e) => handleSquadAssignment(e.target.value || null)}
                  disabled={assigningSquad}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    opacity: assigningSquad ? 0.5 : 1
                  }}
                >
                  <option value="">No rescue force</option>
                  {availableSquads.map(squad => (
                    <option key={squad.id} value={squad.id}>
                      {squad.name} ({squad.city}, {squad.state})
                    </option>
                  ))}
                </select>
                {assigningSquad && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Updating...
                  </div>
                )}
              </div>
            </Section>

            {/* Case Metadata */}
            <Section title="Case Details">
              <Field label="Created" value={new Date(missionData.createdAt).toLocaleString()} />
              <Field label="Updated" value={new Date(missionData.updatedAt).toLocaleString()} />
              <Field
                label="Created By"
                value={(missionData.createdBy.firstName || '') + ' ' + (missionData.createdBy.lastName || '')}
              />
              {missionData.createdBy.email && (
                <Field label="Email" value={missionData.createdBy.email} />
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function Section({ title, children }) {
  return (
    <div style={{
      background: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '1.5rem'
    }}>
      <h2 style={{
        fontSize: '1.125rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '1rem',
        marginTop: 0
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.25rem'
      }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#111827' }}>
        {value}
      </div>
    </div>
  );
}
