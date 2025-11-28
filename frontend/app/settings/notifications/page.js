'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Email Preferences Settings Page
 *
 * Allows users to manage their email notification preferences.
 */
export default function NotificationSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preferences, setPreferences] = useState({
    caseUpdates: true,
    sightingAlerts: true,
    squadMessages: true,
    weeklyDigest: false,
    marketingEmails: false,
    systemAnnouncements: true,
    digestFrequency: 'IMMEDIATE',
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: 'America/Chicago'
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/settings/notifications');
    } else if (status === 'authenticated') {
      loadPreferences();
    }
  }, [status, router]);

  const loadPreferences = async () => {
    try {
      const res = await fetch('/api/user/email-preferences');
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
      }
    } catch (err) {
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/user/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (res.ok) {
        setSuccess('Preferences saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save preferences');
      }
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' }
  ];

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F9FAFB'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E5E7EB',
            borderTop: '4px solid #667EEA',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#6B7280' }}>Loading preferences...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      padding: '2rem 1rem'
    }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/settings"
            style={{
              color: '#667EEA',
              textDecoration: 'none',
              fontWeight: '600',
              marginBottom: '1rem',
              display: 'inline-block'
            }}
          >
            ← Back to Settings
          </Link>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '800',
            color: '#1F2937',
            marginBottom: '0.5rem'
          }}>
            Notification Preferences
          </h1>
          <p style={{ color: '#6B7280' }}>
            Control which emails you receive from PetRecovery.org
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div style={{
            padding: '1rem',
            background: '#D1FAE5',
            border: '1px solid #10B981',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            color: '#065F46'
          }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            background: '#FEE2E2',
            border: '1px solid #EF4444',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            color: '#991B1B'
          }}>
            {error}
          </div>
        )}

        {/* Email Notifications */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #E5E7EB',
            background: '#F9FAFB'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '700',
              color: '#1F2937'
            }}>
              Email Notifications
            </h2>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {/* Case Updates */}
            <NotificationToggle
              label="Case Updates"
              description="Receive updates about your lost pet cases"
              checked={preferences.caseUpdates}
              onChange={() => handleToggle('caseUpdates')}
            />

            {/* Sighting Alerts */}
            <NotificationToggle
              label="Sighting Alerts"
              description="Get notified when someone reports a sighting"
              checked={preferences.sightingAlerts}
              onChange={() => handleToggle('sightingAlerts')}
              important
            />

            {/* Squad Messages */}
            <NotificationToggle
              label="Squad Messages"
              description="Messages from your rescue squad"
              checked={preferences.squadMessages}
              onChange={() => handleToggle('squadMessages')}
            />

            {/* Weekly Digest */}
            <NotificationToggle
              label="Weekly Digest"
              description="Weekly summary of cases in your area"
              checked={preferences.weeklyDigest}
              onChange={() => handleToggle('weeklyDigest')}
            />

            {/* Marketing */}
            <NotificationToggle
              label="Marketing Emails"
              description="News, tips, and updates about PetRecovery"
              checked={preferences.marketingEmails}
              onChange={() => handleToggle('marketingEmails')}
            />

            {/* System Announcements */}
            <NotificationToggle
              label="System Announcements"
              description="Important service updates and security notices"
              checked={preferences.systemAnnouncements}
              onChange={() => handleToggle('systemAnnouncements')}
              disabled
              note="Required for account security"
            />
          </div>
        </div>

        {/* Delivery Preferences */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #E5E7EB',
            background: '#F9FAFB'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '700',
              color: '#1F2937'
            }}>
              Delivery Preferences
            </h2>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {/* Digest Frequency */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#374151'
              }}>
                Notification Frequency
              </label>
              <select
                value={preferences.digestFrequency}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  digestFrequency: e.target.value
                }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: '#374151'
                }}
              >
                <option value="IMMEDIATE">Send immediately</option>
                <option value="DAILY">Daily digest</option>
                <option value="WEEKLY">Weekly digest</option>
              </select>
              <p style={{
                fontSize: '0.85rem',
                color: '#6B7280',
                marginTop: '0.5rem'
              }}>
                Urgent sighting alerts will always be sent immediately
              </p>
            </div>

            {/* Timezone */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#374151'
              }}>
                Timezone
              </label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  timezone: e.target.value
                }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: '#374151'
                }}
              >
                {timezones.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quiet Hours */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#374151'
              }}>
                Quiet Hours (optional)
              </label>
              <p style={{
                fontSize: '0.85rem',
                color: '#6B7280',
                marginBottom: '0.75rem'
              }}>
                Non-urgent notifications won't be sent during these hours
              </p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <select
                  value={preferences.quietHoursStart ?? ''}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    quietHoursStart: e.target.value ? parseInt(e.target.value) : null
                  }))}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    color: '#374151'
                  }}
                >
                  <option value="">No quiet hours</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                    </option>
                  ))}
                </select>
                <span style={{ color: '#6B7280' }}>to</span>
                <select
                  value={preferences.quietHoursEnd ?? ''}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    quietHoursEnd: e.target.value ? parseInt(e.target.value) : null
                  }))}
                  disabled={preferences.quietHoursStart === null}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    color: '#374151',
                    opacity: preferences.quietHoursStart === null ? 0.5 : 1
                  }}
                >
                  <option value="">Select end time</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem'
        }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'white',
              color: '#374151',
              border: '2px solid #E5E7EB',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={savePreferences}
            disabled={saving}
            style={{
              padding: '0.875rem 2rem',
              background: saving ? '#9CA3AF' : '#667EEA',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * NotificationToggle Component
 */
function NotificationToggle({ label, description, checked, onChange, disabled, important, note }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '1rem 0',
      borderBottom: '1px solid #F3F4F6'
    }}>
      <div style={{ flex: 1, paddingRight: '1rem' }}>
        <div style={{
          fontWeight: '600',
          color: '#374151',
          marginBottom: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {label}
          {important && (
            <span style={{
              background: '#FEF3C7',
              color: '#92400E',
              fontSize: '0.7rem',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              IMPORTANT
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
          {description}
        </div>
        {note && (
          <div style={{
            fontSize: '0.8rem',
            color: '#9CA3AF',
            fontStyle: 'italic',
            marginTop: '0.25rem'
          }}>
            {note}
          </div>
        )}
      </div>

      <button
        onClick={onChange}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        style={{
          width: '48px',
          height: '28px',
          borderRadius: '14px',
          background: checked ? '#667EEA' : '#E5E7EB',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0
        }}
      >
        <span style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s'
        }} />
      </button>
    </div>
  );
}
