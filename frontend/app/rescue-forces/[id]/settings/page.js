'use client';

/**
 * Rescue Force Settings Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Users, Settings, Shield, ChevronLeft, Save, Trash2,
  Clock, Target, Star, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle, Loader2, Crown, UserMinus
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';

const ROLES = {
  FOUNDER: { label: 'Founder', color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200', canEdit: false },
  LEADER: { label: 'Leader', color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200', canEdit: true },
  COORDINATOR: { label: 'Coordinator', color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200', canEdit: true },
  MEMBER: { label: 'Member', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', canEdit: true },
};

const EDITABLE_ROLES = ['MEMBER', 'COORDINATOR', 'LEADER'];

export default function SquadSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const squadId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [squad, setSquad] = useState(null);
  const [members, setMembers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Settings state
  const [settings, setSettings] = useState({
    description: '',
    specializesInDogs: true,
    specializesInCats: true,
    specializesInBirds: false,
    specializesInOther: false,
    availableWeekdays: true,
    availableWeekends: true,
    availableDay: true,
    availableNight: false,
    hasTrackingDogs: false,
    hasDrones: false,
    isAcceptingCases: true,
  });

  // Member management state
  const [expandedMember, setExpandedMember] = useState(null);
  const [memberAction, setMemberAction] = useState({ loading: null, error: null });

  // Fetch squad data
  const fetchSquadData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/rescue-forces/${squadId}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('Rescue Force not found');
          return;
        }
        throw new Error('Failed to fetch force');
      }

      const data = await res.json();
      setSquad(data.squad);
      setMembers(data.squad.members || []);
      setDivisions(data.squad.divisions || []);

      // Find user's role
      const userMembership = data.squad.members?.find(m => m.userId === session.user.id);
      setUserRole(userMembership?.role);

      // Check if user is allowed to access settings
      if (!['FOUNDER', 'LEADER'].includes(userMembership?.role)) {
        setError('Only founders and leaders can access rescue force settings');
        return;
      }

      // Initialize settings
      setSettings({
        description: data.squad.description || '',
        specializesInDogs: data.squad.specializesInDogs,
        specializesInCats: data.squad.specializesInCats,
        specializesInBirds: data.squad.specializesInBirds,
        specializesInOther: data.squad.specializesInOther,
        availableWeekdays: data.squad.availableWeekdays,
        availableWeekends: data.squad.availableWeekends,
        availableDay: data.squad.availableDay,
        availableNight: data.squad.availableNight,
        hasTrackingDogs: data.squad.hasTrackingDogs,
        hasDrones: data.squad.hasDrones,
        isAcceptingCases: data.squad.isAcceptingCases,
      });
    } catch (err) {
      console.error('Error fetching squad:', err);
      setError('Failed to load rescue force settings');
    } finally {
      setLoading(false);
    }
  }, [squadId, session?.user?.id]);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/login?callbackUrl=/rescue-forces/${squadId}/settings`);
      return;
    }

    if (sessionStatus === 'authenticated') {
      fetchSquadData();
    }
  }, [sessionStatus, fetchSquadData, router, squadId]);

  // Save settings
  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/rescue-forces/${squadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Update member role
  const handleUpdateMemberRole = async (memberId, newRole) => {
    setMemberAction({ loading: memberId, error: null });

    try {
      const res = await fetch(`/api/rescue-forces/${squadId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update member');
      }

      await fetchSquadData();
      setSuccess('Member role updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setMemberAction({ loading: null, error: err.message });
    } finally {
      setMemberAction(prev => ({ ...prev, loading: null }));
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the rescue force?`)) {
      return;
    }

    setMemberAction({ loading: memberId, error: null });

    try {
      const res = await fetch(`/api/rescue-forces/${squadId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      await fetchSquadData();
      setSuccess('Member removed from rescue force');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setMemberAction({ loading: null, error: err.message });
    } finally {
      setMemberAction(prev => ({ ...prev, loading: null }));
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-midnight-100 to-midnight-200">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-flash-400 animate-spin mx-auto mb-4" />
          <p className="text-midnight-500 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error && !squad) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 p-4">
        <Card className="max-w-md mx-auto mt-16 text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-midnight-900 mb-2">Access Denied</h1>
          <p className="text-midnight-500 mb-6">{error}</p>
          <Link href={`/rescue-forces/${squadId}`}>
            <Button leftIcon={ChevronLeft}>
              Back to Rescue Force
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200">
      {/* Header */}
      <div className="bg-white border-b border-midnight-200 px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/rescue-forces/${squadId}`}
            className="inline-flex items-center gap-1 text-flash-600 hover:text-flash-500 text-sm font-semibold mb-3 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Rescue Force
          </Link>
          <h1 className="text-2xl font-bold text-midnight-900 flex items-center gap-3">
            <Settings className="w-7 h-7 text-flash-500" />
            Rescue Force Settings
          </h1>
          <p className="text-midnight-500 mt-1">{squad?.name}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {/* Notifications */}
        {success && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 mb-6">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-6">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Settings */}
          <div className="space-y-6">
            {/* General Settings */}
            <Card>
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-midnight-100">
                <Settings className="w-5 h-5 text-flash-500" />
                <h2 className="text-lg font-bold text-midnight-900">General Settings</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-700 mb-2">
                    Rescue Force Description
                  </label>
                  <textarea
                    value={settings.description}
                    onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your rescue force's mission and coverage area..."
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400 resize-none"
                    rows={4}
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-midnight-50 transition">
                  <input
                    type="checkbox"
                    checked={settings.isAcceptingCases}
                    onChange={(e) => setSettings(prev => ({ ...prev, isAcceptingCases: e.target.checked }))}
                    className="w-5 h-5 mt-0.5 rounded border-midnight-300 text-flash-500 focus:ring-flash-400"
                  />
                  <div>
                    <span className="font-semibold text-midnight-900">Accepting New Cases</span>
                    <p className="text-xs text-midnight-500 mt-0.5">Turn off when squad is at capacity</p>
                  </div>
                </label>
              </div>
            </Card>

            {/* Specializations */}
            <Card>
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-midnight-100">
                <Target className="w-5 h-5 text-flash-500" />
                <h2 className="text-lg font-bold text-midnight-900">Specializations</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'specializesInDogs', label: 'Dogs', icon: '🐕' },
                  { key: 'specializesInCats', label: 'Cats', icon: '🐈' },
                  { key: 'specializesInBirds', label: 'Birds', icon: '🐦' },
                  { key: 'specializesInOther', label: 'Other Pets', icon: '🐾' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                      settings[item.key]
                        ? 'bg-green-50 border-green-200'
                        : 'bg-midnight-50 border-midnight-200 hover:border-midnight-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-midnight-300 text-flash-500 focus:ring-flash-400"
                    />
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium text-midnight-900">{item.label}</span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Availability */}
            <Card>
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-midnight-100">
                <Clock className="w-5 h-5 text-flash-500" />
                <h2 className="text-lg font-bold text-midnight-900">Availability</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'availableWeekdays', label: 'Weekdays' },
                  { key: 'availableWeekends', label: 'Weekends' },
                  { key: 'availableDay', label: 'Daytime' },
                  { key: 'availableNight', label: 'Nighttime' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                      settings[item.key]
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-midnight-50 border-midnight-200 hover:border-midnight-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-midnight-300 text-flash-500 focus:ring-flash-400"
                    />
                    <span className="font-medium text-midnight-900">{item.label}</span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Equipment */}
            <Card>
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-midnight-100">
                <Star className="w-5 h-5 text-flash-500" />
                <h2 className="text-lg font-bold text-midnight-900">Special Equipment</h2>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'hasTrackingDogs', label: 'Tracking Dogs', desc: 'Trained scent tracking dogs available' },
                  { key: 'hasDrones', label: 'Drones', desc: 'Aerial surveillance capability' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
                      settings[item.key]
                        ? 'bg-flash-100 border-flash-200'
                        : 'bg-midnight-50 border-midnight-200 hover:border-midnight-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded border-midnight-300 text-flash-500 focus:ring-flash-400"
                    />
                    <div>
                      <span className="font-semibold text-midnight-900">{item.label}</span>
                      <p className="text-xs text-midnight-500 mt-0.5">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSaveSettings}
              loading={saving}
              leftIcon={Save}
              fullWidth
              size="lg"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>

          {/* Right Column - Member Management */}
          <Card className="h-fit">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-midnight-100">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-flash-500" />
                <h2 className="text-lg font-bold text-midnight-900">
                  Members ({members.filter(m => m.isActive).length})
                </h2>
              </div>
            </div>

            {memberAction.error && (
              <div className="px-3 py-2 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {memberAction.error}
              </div>
            )}

            <div className="max-h-[600px] overflow-y-auto -mx-6 px-6">
              {members.filter(m => m.isActive).map((member) => {
                const roleConfig = ROLES[member.role] || ROLES.MEMBER;
                const isExpanded = expandedMember === member.id;
                const canManage = userRole === 'FOUNDER' ||
                  (userRole === 'LEADER' && !['FOUNDER', 'LEADER'].includes(member.role));
                const isLoading = memberAction.loading === member.id;

                return (
                  <div
                    key={member.id}
                    className="border-b border-midnight-100 last:border-b-0"
                  >
                    <div
                      className={`py-3 flex justify-between items-center transition ${
                        canManage ? 'cursor-pointer hover:bg-midnight-50' : ''
                      } ${isExpanded ? 'bg-midnight-50' : ''} ${isLoading ? 'opacity-60' : ''}`}
                      onClick={() => canManage && setExpandedMember(isExpanded ? null : member.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleConfig.bg} border-2 ${roleConfig.border}`}>
                          {member.role === 'FOUNDER' ? (
                            <Crown className={`w-5 h-5 ${roleConfig.color}`} />
                          ) : (
                            <Shield className={`w-5 h-5 ${roleConfig.color}`} />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-midnight-900">
                            {member.user?.firstName} {member.user?.lastName}
                          </div>
                          <Badge variant="default" size="sm" className={`mt-1 ${roleConfig.bg} ${roleConfig.color}`}>
                            {roleConfig.label}
                          </Badge>
                        </div>
                      </div>
                      {canManage && (
                        isExpanded
                          ? <ChevronUp className="w-5 h-5 text-midnight-400" />
                          : <ChevronDown className="w-5 h-5 text-midnight-400" />
                      )}
                    </div>

                    {/* Expanded management options */}
                    {isExpanded && canManage && (
                      <div className="pb-4 bg-midnight-50 px-3 rounded-b-lg -mx-3">
                        <p className="text-xs text-midnight-500 mb-3 pt-2">
                          Change role:
                        </p>
                        <div className="flex gap-2 flex-wrap mb-3">
                          {EDITABLE_ROLES.map((role) => {
                            if (role === 'LEADER' && userRole !== 'FOUNDER') return null;
                            const config = ROLES[role];

                            return (
                              <button
                                key={role}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateMemberRole(member.id, role);
                                }}
                                disabled={member.role === role || isLoading}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
                                  member.role === role
                                    ? `${config.bg} ${config.color} ${config.border}`
                                    : `bg-white ${config.border} ${config.color} hover:${config.bg}`
                                } ${member.role === role || isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {config.label}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(member.id, `${member.user?.firstName} ${member.user?.lastName}`);
                          }}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition disabled:cursor-not-allowed"
                        >
                          <UserMinus className="w-3 h-3" />
                          Remove from Squad
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
