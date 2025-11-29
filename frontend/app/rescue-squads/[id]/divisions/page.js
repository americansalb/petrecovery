'use client';

/**
 * Division Management Page
 *
 * Allows squad founders/leaders to:
 * - Create new divisions
 * - Assign division leaders
 * - View division stats
 * - Manage division members
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function DivisionsManagementPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const squadId = params.id;

  const [squad, setSquad] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create division modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDivision, setNewDivision] = useState({
    name: '',
    description: '',
    coverageArea: '',
  });
  const [creating, setCreating] = useState(false);

  // Edit division modal
  const [editingDivision, setEditingDivision] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadSquadAndDivisions();
  }, [squadId, session]);

  const loadSquadAndDivisions = async () => {
    try {
      // Load squad details
      const squadRes = await fetch(`/api/rescue-squads/${squadId}`);
      const squadData = await squadRes.json();

      if (!squadRes.ok) {
        throw new Error(squadData.error || 'Failed to load squad');
      }

      setSquad(squadData.squad);

      // Check user role
      if (session?.user?.id && squadData.squad.members) {
        const membership = squadData.squad.members.find(
          m => m.userId === session.user.id && m.isActive
        );
        if (membership) {
          setUserRole(membership.role);
        }
      }

      // Load divisions
      const divRes = await fetch(`/api/rescue-squads/${squadId}/divisions`);
      if (divRes.ok) {
        const divData = await divRes.json();
        setDivisions(divData.divisions || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDivision = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/divisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDivision),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create division');
      }

      setDivisions(prev => [...prev, data.division]);
      setShowCreateModal(false);
      setNewDivision({ name: '', description: '', coverageArea: '' });
      setSuccess('Division created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateDivision = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError('');

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/divisions/${editingDivision.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingDivision.name,
          description: editingDivision.description,
          coverageArea: editingDivision.coverageArea,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update division');
      }

      setDivisions(prev =>
        prev.map(d => d.id === editingDivision.id ? data.division : d)
      );
      setEditingDivision(null);
      setSuccess('Division updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteDivision = async (divisionId) => {
    if (!confirm('Are you sure you want to delete this division? Members will be moved to general squad membership.')) {
      return;
    }

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete division');
      }

      setDivisions(prev => prev.filter(d => d.id !== divisionId));
      setSuccess('Division deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Check if user can manage divisions
  const canManage = ['FOUNDER', 'LEADER'].includes(userRole);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Loading divisions...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h2>Access Denied</h2>
          <p>Only squad founders and leaders can manage divisions.</p>
          <Link href={`/rescue-squads/${squadId}`} style={styles.backLink}>
            ← Back to Squad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <Link href={`/rescue-squads/${squadId}`} style={styles.backLink}>
            ← Back to {squad?.name}
          </Link>
          <h1 style={styles.title}>Division Management</h1>
          <p style={styles.subtitle}>
            Organize your squad into specialized neighborhood divisions
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={styles.createButton}>
          + Create Division
        </button>
      </div>

      {/* Messages */}
      {error && <div style={styles.errorMessage}>{error}</div>}
      {success && <div style={styles.successMessage}>{success}</div>}

      {/* Divisions Grid */}
      {divisions.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>🗺️</span>
          <h3>No Divisions Yet</h3>
          <p>
            Create divisions to organize your squad by neighborhood or specialization.
            This helps with targeted coordination during searches.
          </p>
          <button onClick={() => setShowCreateModal(true)} style={styles.createButtonLarge}>
            Create Your First Division
          </button>
        </div>
      ) : (
        <div style={styles.divisionsGrid}>
          {divisions.map(division => (
            <div key={division.id} style={styles.divisionCard}>
              <div style={styles.divisionHeader}>
                <h3 style={styles.divisionName}>{division.name}</h3>
                <div style={styles.divisionActions}>
                  <button
                    onClick={() => setEditingDivision(division)}
                    style={styles.editButton}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteDivision(division.id)}
                    style={styles.deleteButton}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {division.description && (
                <p style={styles.divisionDesc}>{division.description}</p>
              )}

              {division.coverageArea && (
                <p style={styles.coverageArea}>
                  📍 {division.coverageArea}
                </p>
              )}

              <div style={styles.divisionStats}>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{division.memberCount || 0}</span>
                  <span style={styles.statLabel}>Members</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{division.activeCases || 0}</span>
                  <span style={styles.statLabel}>Active Cases</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{division.leaders?.length || 0}</span>
                  <span style={styles.statLabel}>Leaders</span>
                </div>
              </div>

              {division.leaders && division.leaders.length > 0 && (
                <div style={styles.leadersSection}>
                  <span style={styles.leadersLabel}>Division Leaders:</span>
                  <div style={styles.leadersList}>
                    {division.leaders.map(leader => (
                      <span key={leader.id} style={styles.leaderBadge}>
                        {leader.user?.firstName || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/rescue-squads/${squadId}/divisions/${division.id}`}
                style={styles.manageLink}
              >
                Manage Division →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Create Division Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create New Division</h2>
            <form onSubmit={handleCreateDivision}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Division Name *</label>
                <input
                  type="text"
                  value={newDivision.name}
                  onChange={e => setNewDivision(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Downtown District, North Side"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={newDivision.description}
                  onChange={e => setNewDivision(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What area or specialty does this division cover?"
                  style={styles.textarea}
                  rows={3}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Coverage Area</label>
                <input
                  type="text"
                  value={newDivision.coverageArea}
                  onChange={e => setNewDivision(prev => ({ ...prev, coverageArea: e.target.value }))}
                  placeholder="e.g., ZIP codes 10001-10010"
                  style={styles.input}
                />
              </div>

              <div style={styles.modalButtons}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDivision.name.trim()}
                  style={styles.submitButton}
                >
                  {creating ? 'Creating...' : 'Create Division'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Division Modal */}
      {editingDivision && (
        <div style={styles.modalOverlay} onClick={() => setEditingDivision(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Edit Division</h2>
            <form onSubmit={handleUpdateDivision}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Division Name *</label>
                <input
                  type="text"
                  value={editingDivision.name}
                  onChange={e => setEditingDivision(prev => ({ ...prev, name: e.target.value }))}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={editingDivision.description || ''}
                  onChange={e => setEditingDivision(prev => ({ ...prev, description: e.target.value }))}
                  style={styles.textarea}
                  rows={3}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Coverage Area</label>
                <input
                  type="text"
                  value={editingDivision.coverageArea || ''}
                  onChange={e => setEditingDivision(prev => ({ ...prev, coverageArea: e.target.value }))}
                  style={styles.input}
                />
              </div>

              <div style={styles.modalButtons}>
                <button
                  type="button"
                  onClick={() => setEditingDivision(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !editingDivision.name.trim()}
                  style={styles.submitButton}
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '2rem',
  },

  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    color: '#64748b',
  },

  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem',
  },

  header: {
    maxWidth: '1200px',
    margin: '0 auto 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
  },

  backLink: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.9rem',
    marginBottom: '0.5rem',
    display: 'inline-block',
  },

  title: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 0.5rem 0',
  },

  subtitle: {
    fontSize: '1rem',
    color: '#64748b',
    margin: 0,
  },

  createButton: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '1rem',
  },

  errorMessage: {
    maxWidth: '1200px',
    margin: '0 auto 1rem',
    padding: '1rem',
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
  },

  successMessage: {
    maxWidth: '1200px',
    margin: '0 auto 1rem',
    padding: '1rem',
    backgroundColor: '#d1fae5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    color: '#059669',
  },

  emptyState: {
    maxWidth: '500px',
    margin: '4rem auto',
    textAlign: 'center',
    padding: '3rem',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  },

  emptyIcon: {
    fontSize: '4rem',
    display: 'block',
    marginBottom: '1rem',
  },

  createButtonLarge: {
    marginTop: '1.5rem',
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '1rem',
  },

  divisionsGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
  },

  divisionCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  },

  divisionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },

  divisionName: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },

  divisionActions: {
    display: 'flex',
    gap: '0.5rem',
  },

  editButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.25rem',
  },

  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.25rem',
  },

  divisionDesc: {
    fontSize: '0.9rem',
    color: '#64748b',
    marginBottom: '0.75rem',
    lineHeight: 1.5,
  },

  coverageArea: {
    fontSize: '0.85rem',
    color: '#2196F3',
    marginBottom: '1rem',
  },

  divisionStats: {
    display: 'flex',
    gap: '1.5rem',
    marginBottom: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
  },

  stat: {
    textAlign: 'center',
  },

  statValue: {
    display: 'block',
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#0f172a',
  },

  statLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
  },

  leadersSection: {
    marginBottom: '1rem',
  },

  leadersLabel: {
    fontSize: '0.8rem',
    color: '#64748b',
    display: 'block',
    marginBottom: '0.5rem',
  },

  leadersList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },

  leaderBadge: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#ede9fe',
    color: '#7c3aed',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },

  manageLink: {
    display: 'block',
    textAlign: 'center',
    padding: '0.75rem',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.9rem',
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },

  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '2rem',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
  },

  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '1.5rem',
  },

  formGroup: {
    marginBottom: '1rem',
  },

  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },

  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
  },

  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
    resize: 'vertical',
  },

  modalButtons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem',
  },

  cancelButton: {
    flex: 1,
    padding: '0.75rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  submitButton: {
    flex: 1,
    padding: '0.75rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  errorCard: {
    maxWidth: '400px',
    margin: '4rem auto',
    textAlign: 'center',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  },
};
