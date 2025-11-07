'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profileData, setProfileData] = useState({
    firstName: '',
    email: '',
    phone: '',
  });
  const [patrolSettings, setPatrolSettings] = useState({
    isPatrolMember: false,
    radiusMiles: 5,
    alertMethod: 'EMAIL',
    instantAlerts: true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user) return;

      try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('Failed to fetch profile');

        const data = await res.json();

        setProfileData({
          firstName: data.user.firstName || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
        });

        if (data.patrolProfile) {
          setPatrolSettings({
            isPatrolMember: true,
            radiusMiles: data.patrolProfile.radiusMiles || 5,
            alertMethod: data.patrolProfile.alertMethod || 'EMAIL',
            instantAlerts: data.patrolProfile.instantAlerts !== undefined ? data.patrolProfile.instantAlerts : true,
          });
        } else {
          setPatrolSettings({
            isPatrolMember: false,
            radiusMiles: 5,
            alertMethod: 'EMAIL',
            instantAlerts: true,
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    }

    if (session) {
      fetchProfile();
    }
  }, [session]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profileData.firstName,
          phone: profileData.phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setMessage('Profile updated successfully!');
    } catch (error) {
      setMessage('Failed to update profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePatrolUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/patrol/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          radiusMiles: patrolSettings.radiusMiles,
          alertMethod: patrolSettings.alertMethod,
          instantAlerts: patrolSettings.instantAlerts,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update patrol settings');
      }

      setMessage('Patrol settings updated successfully!');
    } catch (error) {
      setMessage('Failed to update patrol settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '1rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/dashboard"
              style={{
                color: 'white',
                textDecoration: 'none',
                fontSize: '1.5rem',
              }}
            >
              ←
            </Link>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                Profile Settings
              </h1>
              <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                Manage your account and preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1.5rem 1rem',
      }}>
        {message && (
          <div style={{
            backgroundColor: message.includes('success') ? '#d1fae5' : '#fee2e2',
            border: `2px solid ${message.includes('success') ? '#10b981' : '#dc2626'}`,
            color: message.includes('success') ? '#065f46' : '#991b1b',
            padding: '1rem',
            borderRadius: '0.75rem',
            marginBottom: '1rem',
            fontWeight: '600',
          }}>
            {message}
          </div>
        )}

        {/* Profile Information */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '1rem',
          }}>
            Account Information
          </h2>

          <form onSubmit={handleProfileUpdate}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                First Name
              </label>
              <input
                type="text"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: loading ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Patrol Settings */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '1rem',
          }}>
            Neighborhood Watch Settings
          </h2>

          {patrolSettings.isPatrolMember ? (
            <form onSubmit={handlePatrolUpdate}>
              <div style={{
                backgroundColor: '#d1fae5',
                border: '2px solid #10b981',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}>
                <div style={{ fontWeight: '600', color: '#065f46', marginBottom: '0.25rem' }}>
                  ✓ Active Member
                </div>
                <div style={{ fontSize: '0.875rem', color: '#047857' }}>
                  You're helping reunite lost pets in your community!
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                }}>
                  Alert Radius: {patrolSettings.radiusMiles} miles
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={patrolSettings.radiusMiles}
                  onChange={(e) => setPatrolSettings({ ...patrolSettings, radiusMiles: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                  }}
                />
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginTop: '0.5rem',
                }}>
                  Get alerts for lost pets within this distance
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                }}>
                  Alert Method
                </label>
                <select
                  value={patrolSettings.alertMethod}
                  onChange={(e) => setPatrolSettings({ ...patrolSettings, alertMethod: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                  }}
                >
                  <option value="EMAIL">Email Only</option>
                  <option value="SMS">SMS Only</option>
                  <option value="PUSH">Push Notifications Only</option>
                  <option value="ALL">All Methods</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={patrolSettings.instantAlerts}
                    onChange={(e) => setPatrolSettings({ ...patrolSettings, instantAlerts: e.target.checked })}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontWeight: '600', color: '#1f2937' }}>
                    Instant Alerts
                  </span>
                </label>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginLeft: '1.95rem',
                  marginTop: '0.25rem',
                }}>
                  Receive notifications immediately when pets go missing nearby
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: loading ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Saving...' : 'Update Settings'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👁️</div>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                You're not part of the neighborhood watch yet
              </p>
              <Link
                href="/patrol/join"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                Join Now
              </Link>
            </div>
          )}
        </div>

        {/* Account Stats */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '1rem',
          }}>
            Your Impact
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
          }}>
            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                5
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>
                Sightings Reported
              </div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
                2
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>
                Pets Reunited
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={{
          backgroundColor: 'white',
          border: '2px solid #dc2626',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1rem',
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#dc2626',
            marginBottom: '1rem',
          }}>
            Account Actions
          </h2>

          <button
            onClick={handleSignOut}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
