'use client';

/**
 * Division Leader Interface
 *
 * Manage division members and coordinate local missions.
 * Division leaders can assign members to cases and manage their local area.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function DivisionPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { id: squadId, divisionId } = params;

  const [loading, setLoading] = useState(true);
  const [division, setDivision] = useState(null);
  const [squad, setSquad] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [activeMissions, setActiveMissions] = useState([]);
  const [error, setError] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditDivision, setShowEditDivision] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', coverageArea: '' });

  useEffect(() => {
    if (squadId && divisionId) {
      fetchDivisionData();
    }
  }, [squadId, divisionId]);

  const fetchDivisionData = async () => {
    try {
      const [divisionRes, squadRes, missionsRes] = await Promise.all([
        fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}`),
        fetch(`/api/rescue-squads/${squadId}`),
        fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}/missions`)
      ]);

      if (!divisionRes.ok) {
        setError('Division not found');
        return;
      }

      const divisionData = await divisionRes.json();
      setDivision(divisionData.division);
      setEditForm({
        name: divisionData.division.name,
        description: divisionData.division.description || '',
        coverageArea: divisionData.division.coverageArea || '',
      });

      if (squadRes.ok) {
        const squadData = await squadRes.json();
        setSquad(squadData.squad);
        setUserRole(squadData.userRole);
      }

      if (missionsRes.ok) {
        const missionsData = await missionsRes.json();
        setActiveMissions(missionsData.missions || []);
      }
    } catch (err) {
      console.error('Error fetching division:', err);
      setError('Failed to load division');
    } finally {
      setLoading(false);
    }
  };

  const updateDivision = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update');
        return;
      }

      const data = await res.json();
      setDivision({ ...division, ...data.division });
      setShowEditDivision(false);
    } catch (err) {
      console.error('Error updating division:', err);
      alert('Failed to update division');
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Remove this member from the division?')) return;

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDivision({
          ...division,
          members: division.members.filter(m => m.id !== memberId),
          memberCount: division.memberCount - 1,
        });
      }
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'LIVE_SEARCH': return 'Live Search';
      case 'CONTAINMENT': return 'Containment';
      case 'TRAP_OPS': return 'Trap Operations';
      default: return mode;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'LIVE_SEARCH': return '#2196F3';
      case 'CONTAINMENT': return '#FF9800';
      case 'TRAP_OPS': return '#9C27B0';
      default: return '#888';
    }
  };

  const canManage = ['FOUNDER', 'LEADER'].includes(userRole);
  const canCoordinate = ['FOUNDER', 'LEADER', 'COORDINATOR'].includes(userRole) ||
    division?.members?.some(m => m.user?.id === session?.user?.id && m.role === 'LEADER');

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading Division...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>⚠️</span>
          <h2 style={styles.errorTitle}>{error}</h2>
          <button onClick={() => router.push(`/rescue-squads/${squadId}`)} style={styles.backButton}>
            Back to Squad
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.breadcrumb}>
          <Link href={`/rescue-squads/${squadId}`} style={styles.breadcrumbLink}>
            {squad?.name || 'Squad'}
          </Link>
          <span style={styles.breadcrumbSeparator}>/</span>
          <Link href={`/rescue-squads/${squadId}/divisions`} style={styles.breadcrumbLink}>
            Divisions
          </Link>
          <span style={styles.breadcrumbSeparator}>/</span>
          <span style={styles.breadcrumbCurrent}>{division?.name}</span>
        </div>

        <div style={styles.headerMain}>
          <div>
            <h1 style={styles.title}>{division?.name}</h1>
            {division?.coverageArea && (
              <p style={styles.coverageArea}>
                <span style={styles.locationIcon}>📍</span>
                {division.coverageArea}
              </p>
            )}
          </div>
          {canManage && (
            <button
              onClick={() => setShowEditDivision(true)}
              style={styles.editButton}
            >
              Edit Division
            </button>
          )}
        </div>

        {division?.description && (
          <p style={styles.description}>{division.description}</p>
        )}
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{division?.memberCount || 0}</span>
          <span style={styles.statLabel}>Members</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{activeMissions.length}</span>
          <span style={styles.statLabel}>Active Missions</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>
            {activeMissions.reduce((sum, m) => sum + (m.activeVolunteers || 0), 0)}
          </span>
          <span style={styles.statLabel}>Volunteers Active</span>
        </div>
      </div>

      {/* Active Missions */}
      {activeMissions.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.liveIndicator}>●</span>
            Active Missions in Your Area
          </h2>
          <div style={styles.missionList}>
            {activeMissions.map(mission => (
              <Link
                key={mission.id}
                href={`/cases/${mission.caseNumber}`}
                style={styles.missionCard}
              >
                <div style={styles.missionInfo}>
                  <div style={styles.missionPet}>
                    {mission.pet?.photoUrl ? (
                      <img src={mission.pet.photoUrl} alt="" style={styles.petPhoto} />
                    ) : (
                      <span style={styles.petEmoji}>
                        {mission.pet?.species === 'DOG' ? '🐕' : '🐈'}
                      </span>
                    )}
                    <div>
                      <div style={styles.petName}>{mission.pet?.name}</div>
                      <div style={styles.missionMeta}>
                        {mission.activeVolunteers} volunteers • {getModeLabel(mission.mode)}
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    ...styles.modeBadge,
                    backgroundColor: getModeColor(mission.mode),
                  }}
                >
                  LIVE
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Members List */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Division Members</h2>
          {canCoordinate && (
            <button onClick={() => setShowAddMember(true)} style={styles.addButton}>
              + Add Member
            </button>
          )}
        </div>

        {division?.members?.length > 0 ? (
          <div style={styles.memberList}>
            {division.members.map(member => (
              <div key={member.id} style={styles.memberCard}>
                <div style={styles.memberInfo}>
                  <div style={styles.avatar}>
                    {member.user?.firstName?.[0] || '?'}
                  </div>
                  <div>
                    <div style={styles.memberName}>
                      {member.user?.firstName} {member.user?.lastName}
                    </div>
                    <div style={styles.memberRole}>{member.role}</div>
                  </div>
                </div>
                <div style={styles.memberActions}>
                  <span style={styles.joinedDate}>
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                  {canManage && member.role !== 'LEADER' && (
                    <button
                      onClick={() => removeMember(member.id)}
                      style={styles.removeButton}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>👥</span>
            <p style={styles.emptyText}>No members in this division yet</p>
            {canCoordinate && (
              <button onClick={() => setShowAddMember(true)} style={styles.addMemberButton}>
                Add First Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Coordinator Actions */}
      {canCoordinate && (
        <div style={styles.quickActions}>
          <Link
            href={`/rescue-squads/${squadId}/command-center`}
            style={styles.quickAction}
          >
            <span>🎯</span> Squad Command Center
          </Link>
          <Link
            href={`/rescue-squads/${squadId}/divisions`}
            style={styles.quickAction}
          >
            <span>👥</span> All Divisions
          </Link>
        </div>
      )}

      {/* Edit Division Modal */}
      {showEditDivision && (
        <div style={styles.modalOverlay} onClick={() => setShowEditDivision(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Edit Division</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Division Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Coverage Area</label>
              <input
                type="text"
                value={editForm.coverageArea}
                onChange={e => setEditForm({ ...editForm, coverageArea: e.target.value })}
                placeholder="e.g., Downtown, West Side, North District"
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Describe the division's focus and responsibilities..."
                style={styles.textarea}
              />
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowEditDivision(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={updateDivision} style={styles.saveButton}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          squadId={squadId}
          divisionId={divisionId}
          onClose={() => setShowAddMember(false)}
          onAdd={() => {
            setShowAddMember(false);
            fetchDivisionData();
          }}
        />
      )}
    </div>
  );
}

function AddMemberModal({ squadId, divisionId, onClose, onAdd }) {
  const [squadMembers, setSquadMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchAvailableMembers();
  }, []);

  const fetchAvailableMembers = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/members?available=true&divisionId=${divisionId}`);
      if (res.ok) {
        const data = await res.json();
        setSquadMembers(data.members || []);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (memberId) => {
    setAdding(true);
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });

      if (res.ok) {
        onAdd();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add member');
      }
    } catch (err) {
      console.error('Error adding member:', err);
      alert('Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Add Member to Division</h3>

        {loading ? (
          <div style={styles.modalLoading}>Loading members...</div>
        ) : squadMembers.length === 0 ? (
          <div style={styles.modalEmpty}>
            <p>All squad members are already assigned to divisions.</p>
          </div>
        ) : (
          <div style={styles.memberSelectList}>
            {squadMembers.map(member => (
              <button
                key={member.id}
                onClick={() => addMember(member.id)}
                disabled={adding}
                style={styles.memberSelectItem}
              >
                <div style={styles.memberSelectInfo}>
                  <div style={styles.avatar}>
                    {member.user?.firstName?.[0] || '?'}
                  </div>
                  <div>
                    <div style={styles.memberName}>
                      {member.user?.firstName} {member.user?.lastName}
                    </div>
                    <div style={styles.memberRole}>{member.role}</div>
                  </div>
                </div>
                <span style={styles.addIcon}>+</span>
              </button>
            ))}
          </div>
        )}

        <button onClick={onClose} style={styles.closeModalButton}>
          Close
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  loading: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
  },

  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#4f46e5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },

  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },

  errorCard: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '400px',
  },

  errorIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },

  errorTitle: {
    fontSize: '20px',
    fontWeight: 600,
    margin: '0 0 20px 0',
    color: '#1e293b',
  },

  backButton: {
    padding: '12px 24px',
    backgroundColor: '#4f46e5',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  header: {
    padding: '24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },

  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    fontSize: '14px',
  },

  breadcrumbLink: {
    color: '#4f46e5',
    textDecoration: 'none',
  },

  breadcrumbSeparator: {
    color: '#94a3b8',
  },

  breadcrumbCurrent: {
    color: '#64748b',
  },

  headerMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  title: {
    fontSize: '28px',
    fontWeight: 700,
    margin: 0,
    color: '#1e293b',
  },

  coverageArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#64748b',
    marginTop: '8px',
  },

  locationIcon: {
    fontSize: '16px',
  },

  description: {
    marginTop: '16px',
    color: '#64748b',
    fontSize: '15px',
    lineHeight: 1.6,
  },

  editButton: {
    padding: '10px 20px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    padding: '24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },

  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
  },

  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#4f46e5',
  },

  statLabel: {
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: '4px',
  },

  section: {
    padding: '24px',
    backgroundColor: '#fff',
    marginBottom: '8px',
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },

  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  liveIndicator: {
    color: '#dc2626',
    animation: 'pulse 2s infinite',
    fontSize: '12px',
  },

  addButton: {
    padding: '8px 16px',
    backgroundColor: '#4f46e5',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  missionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  missionCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '12px',
    textDecoration: 'none',
    color: 'inherit',
  },

  missionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  missionPet: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  petPhoto: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    objectFit: 'cover',
  },

  petEmoji: {
    fontSize: '32px',
  },

  petName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1e293b',
  },

  missionMeta: {
    fontSize: '13px',
    color: '#64748b',
  },

  modeBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#fff',
  },

  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  memberCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
  },

  memberInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 600,
  },

  memberName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
  },

  memberRole: {
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase',
  },

  memberActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  joinedDate: {
    fontSize: '12px',
    color: '#94a3b8',
  },

  removeButton: {
    padding: '6px 12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '12px',
    cursor: 'pointer',
  },

  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
  },

  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '12px',
  },

  emptyText: {
    color: '#64748b',
    margin: '0 0 16px 0',
  },

  addMemberButton: {
    padding: '12px 24px',
    backgroundColor: '#4f46e5',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  quickActions: {
    display: 'flex',
    gap: '12px',
    padding: '24px',
    justifyContent: 'center',
  },

  quickAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#fff',
    color: '#475569',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    border: '1px solid #e2e8f0',
    fontWeight: 500,
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },

  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '80vh',
    overflow: 'auto',
  },

  modalTitle: {
    fontSize: '20px',
    fontWeight: 600,
    margin: '0 0 20px 0',
    color: '#1e293b',
  },

  formGroup: {
    marginBottom: '16px',
  },

  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#475569',
    marginBottom: '6px',
  },

  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },

  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    minHeight: '100px',
    boxSizing: 'border-box',
  },

  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },

  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  saveButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#4f46e5',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  modalLoading: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
  },

  modalEmpty: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
  },

  memberSelectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflow: 'auto',
  },

  memberSelectItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
  },

  memberSelectInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  addIcon: {
    fontSize: '24px',
    color: '#4f46e5',
    fontWeight: 600,
  },

  closeModalButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '16px',
  },
};
