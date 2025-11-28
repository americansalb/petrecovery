'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Users, Settings, Shield, ChevronLeft, Save, Trash2,
  MapPin, Clock, Dog, Cat, Bird, Wifi, Target, Star,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle
} from 'lucide-react';

const ROLES = {
  FOUNDER: { label: 'Founder', color: '#dc2626', canEdit: false },
  LEADER: { label: 'Leader', color: '#f59e0b', canEdit: true },
  COORDINATOR: { label: 'Coordinator', color: '#8b5cf6', canEdit: true },
  MEMBER: { label: 'Member', color: '#3b82f6', canEdit: true },
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
      const res = await fetch(`/api/rescue-squads/${squadId}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('Squad not found');
          return;
        }
        throw new Error('Failed to fetch squad');
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
        setError('Only founders and leaders can access squad settings');
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
      setError('Failed to load squad settings');
    } finally {
      setLoading(false);
    }
  }, [squadId, session?.user?.id]);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/login?callbackUrl=/rescue-squads/${squadId}/settings`);
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
      const res = await fetch(`/api/rescue-squads/${squadId}`, {
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
      const res = await fetch(`/api/rescue-squads/${squadId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update member');
      }

      // Refresh data
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
    if (!confirm(`Are you sure you want to remove ${memberName} from the squad?`)) {
      return;
    }

    setMemberAction({ loading: memberId, error: null });

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      // Refresh data
      await fetchSquadData();
      setSuccess('Member removed from squad');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setMemberAction({ loading: null, error: err.message });
    } finally {
      setMemberAction(prev => ({ ...prev, loading: null }));
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #4f46e5',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite',
          }} />
          <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#64748b' }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error && !squad) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '500px',
          margin: '4rem auto',
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <AlertCircle size={48} style={{ color: '#dc2626', marginBottom: '1rem' }} />
          <h1 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Access Denied</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{error}</p>
          <Link
            href={`/rescue-squads/${squadId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#4f46e5',
              color: 'white',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '600',
            }}
          >
            <ChevronLeft size={18} /> Back to Squad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1.5rem 2rem',
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Link
            href={`/rescue-squads/${squadId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#4f46e5',
              textDecoration: 'none',
              fontSize: '0.875rem',
              marginBottom: '0.75rem',
            }}
          >
            <ChevronLeft size={16} /> Back to Squad
          </Link>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            color: '#0f172a',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <Settings size={28} />
            Squad Settings
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0' }}>
            {squad?.name}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        {/* Notifications */}
        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.75rem',
            color: '#16a34a',
            marginBottom: '1.5rem',
          }}>
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.75rem',
            color: '#dc2626',
            marginBottom: '1.5rem',
          }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Left Column - Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* General Settings */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <Settings size={20} style={{ color: '#4f46e5' }} />
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                  General Settings
                </h2>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}>
                    Squad Description
                  </label>
                  <textarea
                    value={settings.description}
                    onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your squad's mission and coverage area..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      fontSize: '0.9rem',
                      minHeight: '100px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.isAcceptingCases}
                      onChange={(e) => setSettings(prev => ({ ...prev, isAcceptingCases: e.target.checked }))}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>Accepting New Cases</span>
                      <p style={{ margin: '0.125rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        Turn off when squad is at capacity
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Specializations */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <Target size={20} style={{ color: '#4f46e5' }} />
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                  Specializations
                </h2>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { key: 'specializesInDogs', label: 'Dogs', icon: '🐕' },
                  { key: 'specializesInCats', label: 'Cats', icon: '🐈' },
                  { key: 'specializesInBirds', label: 'Birds', icon: '🐦' },
                  { key: 'specializesInOther', label: 'Other Pets', icon: '🐾' },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: settings[item.key] ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${settings[item.key] ? '#bbf7d0' : '#e2e8f0'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                    <span style={{ fontWeight: '500', color: '#0f172a' }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <Clock size={20} style={{ color: '#4f46e5' }} />
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                  Availability
                </h2>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { key: 'availableWeekdays', label: 'Weekdays' },
                  { key: 'availableWeekends', label: 'Weekends' },
                  { key: 'availableDay', label: 'Daytime' },
                  { key: 'availableNight', label: 'Nighttime' },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: settings[item.key] ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${settings[item.key] ? '#bfdbfe' : '#e2e8f0'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500', color: '#0f172a' }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <Star size={20} style={{ color: '#4f46e5' }} />
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                  Special Equipment
                </h2>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { key: 'hasTrackingDogs', label: 'Tracking Dogs', desc: 'Trained scent tracking dogs available' },
                  { key: 'hasDrones', label: 'Drones', desc: 'Aerial surveillance capability' },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: settings[item.key] ? '#fef3c7' : '#f8fafc',
                      border: `1px solid ${settings[item.key] ? '#fde68a' : '#e2e8f0'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>{item.label}</span>
                      <p style={{ margin: '0.125rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        {item.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '1rem',
                background: saving ? '#94a3b8' : '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Right Column - Member Management */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            height: 'fit-content',
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={20} style={{ color: '#4f46e5' }} />
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                  Members ({members.filter(m => m.isActive).length})
                </h2>
              </div>
            </div>

            {memberAction.error && (
              <div style={{
                padding: '0.75rem 1.5rem',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: '0.875rem',
              }}>
                {memberAction.error}
              </div>
            )}

            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {members.filter(m => m.isActive).map((member) => {
                const roleConfig = ROLES[member.role] || ROLES.MEMBER;
                const isExpanded = expandedMember === member.id;
                const canManage = userRole === 'FOUNDER' ||
                  (userRole === 'LEADER' && !['FOUNDER', 'LEADER'].includes(member.role));
                const isLoading = memberAction.loading === member.id;

                return (
                  <div
                    key={member.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: canManage ? 'pointer' : 'default',
                        background: isExpanded ? '#f8fafc' : 'white',
                        opacity: isLoading ? 0.6 : 1,
                      }}
                      onClick={() => canManage && setExpandedMember(isExpanded ? null : member.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          background: `${roleConfig.color}20`,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `2px solid ${roleConfig.color}`,
                        }}>
                          <Shield size={18} style={{ color: roleConfig.color }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>
                            {member.user?.firstName} {member.user?.lastName}
                          </div>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.125rem 0.5rem',
                            background: `${roleConfig.color}15`,
                            color: roleConfig.color,
                            borderRadius: '0.25rem',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            marginTop: '0.25rem',
                          }}>
                            {roleConfig.label}
                          </span>
                        </div>
                      </div>
                      {canManage && (
                        isExpanded ? <ChevronUp size={18} style={{ color: '#94a3b8' }} />
                          : <ChevronDown size={18} style={{ color: '#94a3b8' }} />
                      )}
                    </div>

                    {/* Expanded management options */}
                    {isExpanded && canManage && (
                      <div style={{
                        padding: '0 1.5rem 1rem',
                        background: '#f8fafc',
                      }}>
                        <p style={{
                          fontSize: '0.8rem',
                          color: '#64748b',
                          margin: '0 0 0.75rem',
                        }}>
                          Change role:
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                          {EDITABLE_ROLES.map((role) => {
                            // Leaders can't promote to LEADER
                            if (role === 'LEADER' && userRole !== 'FOUNDER') return null;

                            return (
                              <button
                                key={role}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateMemberRole(member.id, role);
                                }}
                                disabled={member.role === role || isLoading}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: member.role === role ? ROLES[role].color : 'white',
                                  color: member.role === role ? 'white' : ROLES[role].color,
                                  border: `1px solid ${ROLES[role].color}`,
                                  borderRadius: '0.375rem',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  cursor: member.role === role || isLoading ? 'not-allowed' : 'pointer',
                                  opacity: member.role === role ? 1 : 0.8,
                                }}
                              >
                                {ROLES[role].label}
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
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '0.375rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                          Remove from Squad
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
