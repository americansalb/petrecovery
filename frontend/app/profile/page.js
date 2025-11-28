'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Award,
  MapPin,
  Users,
  Heart,
  Trophy,
  Target,
  ChevronRight,
  Settings,
  Bell,
  LogOut,
  Star,
  Zap,
  Shield,
  Crown
} from 'lucide-react';

// Level configuration with thresholds and rewards
const RESCUE_LEVELS = {
  PET_OWNER: {
    name: 'Pet Owner',
    level: 0,
    icon: User,
    color: '#64748b',
    bg: '#f1f5f9',
    description: 'Submitted a lost pet request',
    nextLevel: 'SCOUT',
    requirement: 'Join a rescue squad'
  },
  SCOUT: {
    name: 'Scout',
    level: 1,
    icon: Target,
    color: '#10b981',
    bg: '#d1fae5',
    description: 'Joined a rescue squad',
    nextLevel: 'SENTRY',
    requirement: 'Participate in first case'
  },
  SENTRY: {
    name: 'Sentry',
    level: 2,
    icon: Shield,
    color: '#3b82f6',
    bg: '#dbeafe',
    description: 'Participated in first case',
    nextLevel: 'SHEPHERD',
    requirement: 'Mark 5+ areas, 15+ acres total'
  },
  SHEPHERD: {
    name: 'Shepherd',
    level: 3,
    icon: MapPin,
    color: '#8b5cf6',
    bg: '#ede9fe',
    description: 'Marked 5+ areas, 15+ acres total',
    nextLevel: 'PATHFINDER',
    requirement: '1+ successful reunion'
  },
  PATHFINDER: {
    name: 'Pathfinder',
    level: 4,
    icon: Zap,
    color: '#f59e0b',
    bg: '#fef3c7',
    description: '1+ successful reunion',
    nextLevel: 'PACK_GUARDIAN',
    requirement: '5+ successful reunions'
  },
  PACK_GUARDIAN: {
    name: 'Pack Guardian',
    level: 5,
    icon: Star,
    color: '#ef4444',
    bg: '#fee2e2',
    description: '5+ successful reunions',
    nextLevel: 'PACK_LEGEND',
    requirement: '50+ successful reunions'
  },
  PACK_LEGEND: {
    name: 'Pack Legend',
    level: 6,
    icon: Crown,
    color: '#d97706',
    bg: '#fef3c7',
    description: '50+ successful reunions',
    nextLevel: null,
    requirement: 'Maximum level reached!'
  }
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      loadProfile();
    }
  }, [status]);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setUser(data.user);
      setFormData({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.phone || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setUser(prev => ({ ...prev, ...formData }));
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setEditMode(false);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const getCurrentLevel = () => {
    return RESCUE_LEVELS[user?.rescueLevel] || RESCUE_LEVELS.PET_OWNER;
  };

  const getLevelProgress = () => {
    const level = getCurrentLevel();
    if (!level.nextLevel) return 100;

    // Calculate progress based on next level requirements
    const { successfulReunions = 0, areasMarkedCount = 0, totalAcreageSearched = 0, squadsJoinedCount = 0 } = user || {};

    switch (user?.rescueLevel) {
      case 'PET_OWNER':
        return squadsJoinedCount > 0 ? 100 : 0;
      case 'SCOUT':
        return areasMarkedCount > 0 ? 100 : 0;
      case 'SENTRY':
        const areaProgress = Math.min((areasMarkedCount / 5) * 50, 50);
        const acreProgress = Math.min((totalAcreageSearched / 15) * 50, 50);
        return Math.floor(areaProgress + acreProgress);
      case 'SHEPHERD':
        return successfulReunions >= 1 ? 100 : 0;
      case 'PATHFINDER':
        return Math.min(Math.floor((successfulReunions / 5) * 100), 100);
      case 'PACK_GUARDIAN':
        return Math.min(Math.floor((successfulReunions / 50) * 100), 100);
      default:
        return 0;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
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
          <p style={{ color: '#64748b', fontWeight: '500' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!session || !user) return null;

  const currentLevel = getCurrentLevel();
  const LevelIcon = currentLevel.icon;
  const progress = getLevelProgress();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    }}>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
        padding: '3rem 1rem 6rem',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'rgba(255,255,255,0.8)',
              textDecoration: 'none',
              fontWeight: '600',
              marginBottom: '1.5rem'
            }}
          >
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
            Back to Dashboard
          </Link>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap'
          }}>
            {/* Avatar */}
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid rgba(255,255,255,0.3)'
            }}>
              <User size={48} color="white" />
            </div>

            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '800',
                color: 'white',
                marginBottom: '0.5rem'
              }}>
                {user.firstName} {user.lastName}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '0.75rem' }}>
                {user.email}
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: currentLevel.bg,
                borderRadius: '9999px',
              }}>
                <LevelIcon size={18} color={currentLevel.color} />
                <span style={{
                  fontWeight: '700',
                  color: currentLevel.color,
                  fontSize: '0.9rem'
                }}>
                  {currentLevel.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '900px',
        margin: '-3rem auto 2rem',
        padding: '0 1rem'
      }}>
        {/* Message */}
        {message.text && (
          <div style={{
            padding: '1rem',
            background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            borderRadius: '8px',
            marginBottom: '1.5rem',
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            fontWeight: '600'
          }}>
            {message.text}
          </div>
        )}

        {/* Level Progress Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Award size={24} color="#4f46e5" />
              Rescue Level Progress
            </h2>
            {user.honorsReceived > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                background: '#fef3c7',
                borderRadius: '9999px',
                color: '#92400e',
                fontWeight: '600',
                fontSize: '0.85rem'
              }}>
                <Trophy size={16} />
                {user.honorsReceived} Honors
              </div>
            )}
          </div>

          {/* Current Level Display */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            marginBottom: '1.5rem',
            padding: '1.5rem',
            background: currentLevel.bg,
            borderRadius: '12px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <LevelIcon size={32} color={currentLevel.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                LEVEL {currentLevel.level}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.25rem' }}>
                {currentLevel.name}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                {currentLevel.description}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {currentLevel.nextLevel && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: '0.85rem',
                color: '#64748b'
              }}>
                <span style={{ fontWeight: '600' }}>Progress to {RESCUE_LEVELS[currentLevel.nextLevel].name}</span>
                <span style={{ fontWeight: '700', color: '#4f46e5' }}>{progress}%</span>
              </div>
              <div style={{
                height: '12px',
                background: '#e2e8f0',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  borderRadius: '6px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <p style={{
                marginTop: '0.75rem',
                fontSize: '0.85rem',
                color: '#64748b'
              }}>
                <strong>Next:</strong> {currentLevel.requirement}
              </p>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {[
            { label: 'Squads Joined', value: user.squadsJoinedCount || 0, icon: Users, color: '#4f46e5' },
            { label: 'Areas Marked', value: user.areasMarkedCount || 0, icon: MapPin, color: '#10b981' },
            { label: 'Acreage Searched', value: `${(user.totalAcreageSearched || 0).toFixed(1)} acres`, icon: Target, color: '#f59e0b' },
            { label: 'Successful Reunions', value: user.successfulReunions || 0, icon: Heart, color: '#ef4444' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `${stat.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <stat.icon size={20} color={stat.color} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* All Levels */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1.5rem'
          }}>
            All Rescue Levels
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(RESCUE_LEVELS).map(([key, level]) => {
              const Icon = level.icon;
              const isCurrentLevel = user.rescueLevel === key;
              const isPastLevel = level.level < currentLevel.level;
              const isFutureLevel = level.level > currentLevel.level;

              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    borderRadius: '10px',
                    background: isCurrentLevel ? level.bg : isFutureLevel ? '#f8fafc' : '#fafafa',
                    border: isCurrentLevel ? `2px solid ${level.color}` : '1px solid #e2e8f0',
                    opacity: isFutureLevel ? 0.6 : 1
                  }}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: isPastLevel || isCurrentLevel ? level.bg : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon
                      size={22}
                      color={isPastLevel || isCurrentLevel ? level.color : '#94a3b8'}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '700',
                      color: isCurrentLevel ? level.color : '#0f172a',
                      fontSize: '0.95rem'
                    }}>
                      Level {level.level}: {level.name}
                      {isCurrentLevel && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.5rem',
                          background: level.color,
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: '700'
                        }}>
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {level.description}
                    </div>
                  </div>
                  {isPastLevel && (
                    <div style={{
                      padding: '0.25rem 0.5rem',
                      background: '#d1fae5',
                      color: '#065f46',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      Achieved
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Settings */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Settings size={24} color="#64748b" />
              Account Settings
            </h2>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Edit
              </button>
            )}
          </div>

          {editMode ? (
            <form onSubmit={handleSave}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.9rem'
                  }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.9rem'
                  }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.9rem'
                  }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setFormData({
                      firstName: user.firstName || '',
                      lastName: user.lastName || '',
                      phone: user.phone || '',
                    });
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: saving ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                  First Name
                </div>
                <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '500' }}>
                  {user.firstName || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Last Name
                </div>
                <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '500' }}>
                  {user.lastName || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Email
                </div>
                <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '500' }}>
                  {user.email}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Phone
                </div>
                <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '500' }}>
                  {user.phone || '-'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <Link
            href="/settings/notifications"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.25rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              textDecoration: 'none',
              color: '#0f172a'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bell size={22} color="#4f46e5" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600' }}>Notification Settings</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Manage email preferences</div>
            </div>
            <ChevronRight size={20} color="#94a3b8" />
          </Link>

          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.25rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '2px solid #fee2e2',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <LogOut size={22} color="#ef4444" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', color: '#ef4444' }}>Sign Out</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Log out of your account</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
