'use client';

/**
 * Division Management Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
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
import {
  Plus, ChevronLeft, MapPin, Users, Briefcase, Crown,
  Pencil, Trash2, X, Loader2, AlertCircle, CheckCircle, Map
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';

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
    if (!confirm('Are you sure you want to delete this division? Members will be moved to general force membership.')) {
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-midnight-100 to-midnight-200">
        <Loader2 className="w-10 h-10 text-flash-400 animate-spin mb-4" />
        <p className="text-midnight-500 font-medium">Loading divisions...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 p-4">
        <Card className="max-w-md mx-auto mt-16 text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-midnight-900 mb-2">Access Denied</h2>
          <p className="text-midnight-500 mb-6">Only squad founders and leaders can manage divisions.</p>
          <Link href={`/rescue-squads/${squadId}`}>
            <Button leftIcon={ChevronLeft}>
              Back to Squad
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <Link
              href={`/rescue-squads/${squadId}`}
              className="inline-flex items-center gap-1 text-flash-600 hover:text-flash-500 font-semibold text-sm mb-3 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back to {squad?.name}
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-midnight-900">
              Division Management
            </h1>
            <p className="text-midnight-500 mt-1">
              Organize your squad into specialized neighborhood divisions
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={Plus}>
            Create Division
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="max-w-6xl mx-auto mb-6">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        </div>
      )}
      {success && (
        <div className="max-w-6xl mx-auto mb-6">
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        </div>
      )}

      {/* Divisions Grid */}
      {divisions.length === 0 ? (
        <Card className="max-w-lg mx-auto text-center p-10">
          <Map className="w-16 h-16 text-midnight-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-midnight-900 mb-2">No Divisions Yet</h3>
          <p className="text-midnight-500 mb-6">
            Create divisions to organize your squad by neighborhood or specialization.
            This helps with targeted coordination during searches.
          </p>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={Plus} size="lg">
            Create Your First Division
          </Button>
        </Card>
      ) : (
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {divisions.map(division => (
            <Card key={division.id} className="hover:shadow-card-hover transition">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-midnight-900">{division.name}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingDivision(division)}
                    className="p-2 text-midnight-400 hover:text-flash-600 hover:bg-midnight-100 rounded-lg transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDivision(division.id)}
                    className="p-2 text-midnight-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {division.description && (
                <p className="text-sm text-midnight-500 mb-3 line-clamp-2">
                  {division.description}
                </p>
              )}

              {division.coverageArea && (
                <div className="flex items-center gap-2 text-sm text-flash-600 mb-4">
                  <MapPin className="w-4 h-4" />
                  <span>{division.coverageArea}</span>
                </div>
              )}

              <div className="flex gap-6 py-4 border-t border-midnight-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-midnight-900">
                    {division.memberCount || 0}
                  </div>
                  <div className="text-xs text-midnight-400">Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-midnight-900">
                    {division.activeMissions || 0}
                  </div>
                  <div className="text-xs text-midnight-400">Active Cases</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-midnight-900">
                    {division.leaders?.length || 0}
                  </div>
                  <div className="text-xs text-midnight-400">Leaders</div>
                </div>
              </div>

              {division.leaders && division.leaders.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-midnight-400 mb-2">Division Leaders:</p>
                  <div className="flex flex-wrap gap-2">
                    {division.leaders.map(leader => (
                      <Badge key={leader.id} variant="default" className="bg-purple-100 text-purple-700">
                        <Crown className="w-3 h-3 mr-1" />
                        {leader.user?.firstName || 'Unknown'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/rescue-squads/${squadId}/divisions/${division.id}`}
                className="block text-center py-3 bg-midnight-50 hover:bg-midnight-100 rounded-xl text-flash-600 font-semibold text-sm transition"
              >
                Manage Division →
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Create Division Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-midnight-900/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <Card
            className="max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-midnight-900">Create New Division</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-midnight-400 hover:text-midnight-600 hover:bg-midnight-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDivision}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Division Name *
                  </label>
                  <input
                    type="text"
                    value={newDivision.name}
                    onChange={e => setNewDivision(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Downtown District, North Side"
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newDivision.description}
                    onChange={e => setNewDivision(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What area or specialty does this division cover?"
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400 resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Coverage Area
                  </label>
                  <input
                    type="text"
                    value={newDivision.coverageArea}
                    onChange={e => setNewDivision(prev => ({ ...prev, coverageArea: e.target.value }))}
                    placeholder="e.g., ZIP codes 10001-10010"
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={creating}
                  disabled={!newDivision.name.trim()}
                  className="flex-1"
                >
                  {creating ? 'Creating...' : 'Create Division'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Division Modal */}
      {editingDivision && (
        <div
          className="fixed inset-0 bg-midnight-900/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingDivision(null)}
        >
          <Card
            className="max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-midnight-900">Edit Division</h2>
              <button
                onClick={() => setEditingDivision(null)}
                className="p-2 text-midnight-400 hover:text-midnight-600 hover:bg-midnight-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateDivision}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Division Name *
                  </label>
                  <input
                    type="text"
                    value={editingDivision.name}
                    onChange={e => setEditingDivision(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingDivision.description || ''}
                    onChange={e => setEditingDivision(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Coverage Area
                  </label>
                  <input
                    type="text"
                    value={editingDivision.coverageArea || ''}
                    onChange={e => setEditingDivision(prev => ({ ...prev, coverageArea: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingDivision(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={updating}
                  disabled={!editingDivision.name.trim()}
                  className="flex-1"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
