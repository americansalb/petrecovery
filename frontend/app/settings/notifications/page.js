'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Smartphone,
  Mail,
  MessageSquare,
  ArrowLeft,
  Check,
  AlertCircle,
  Send,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';

export default function NotificationSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Phone verification state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // SMS preferences
  const [smsPrefs, setSmsPrefs] = useState({
    urgentAlerts: true,
    sightingAlerts: false,
    caseUpdates: false,
  });

  // Email preferences
  const [emailPrefs, setEmailPrefs] = useState({
    caseUpdates: true,
    sightingAlerts: true,
    squadMessages: true,
    weeklyDigest: false,
    marketingEmails: false,
    systemAnnouncements: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session?.user?.id) {
      loadPreferences();
    }
  }, [session, status]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      // Load user profile for phone
      const profileRes = await fetch('/api/profile');
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.phone) {
          setPhoneNumber(profile.phone);
          setPhoneVerified(profile.phoneVerified || false);
        }
      }

      // Load SMS preferences
      const smsRes = await fetch('/api/sms/preferences');
      if (smsRes.ok) {
        const data = await smsRes.json();
        if (data.preferences) {
          setSmsPrefs({
            urgentAlerts: data.preferences.urgentAlerts ?? true,
            sightingAlerts: data.preferences.sightingAlerts ?? false,
            caseUpdates: data.preferences.caseUpdates ?? false,
          });
        }
      }

      // Load email preferences
      const emailRes = await fetch('/api/email/preferences');
      if (emailRes.ok) {
        const data = await emailRes.json();
        if (data.preferences) {
          setEmailPrefs(data.preferences);
        }
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendVerification = async () => {
    if (!phoneNumber) return;

    setVerifying(true);
    try {
      const res = await fetch('/api/sms/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (res.ok) {
        setVerificationSent(true);
        setMessage({ type: 'success', text: 'Verification code sent!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to send code' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send verification' });
    } finally {
      setVerifying(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode) return;

    setVerifying(true);
    try {
      const res = await fetch('/api/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code: verificationCode }),
      });

      if (res.ok) {
        setPhoneVerified(true);
        setVerificationSent(false);
        setVerificationCode('');
        setMessage({ type: 'success', text: 'Phone verified successfully!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Invalid code' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const saveSmsPrefs = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/sms/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smsPrefs),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'SMS preferences saved!' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const saveEmailPrefs = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/email/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPrefs),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Email preferences saved!' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}>
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/profile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '0.9rem',
              marginBottom: '1rem',
            }}
          >
            <ArrowLeft size={16} />
            Back to Profile
          </Link>

          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#0f172a',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <Bell size={28} color="#4f46e5" />
            Notification Settings
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
            Manage how and when you receive notifications about your pets and rescue activities.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
          }}>
            {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        {/* SMS Section */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Smartphone size={20} color="#4f46e5" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>SMS Alerts</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Get urgent alerts via text message
              </p>
            </div>
          </div>

          {/* Phone Number */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: 500,
              marginBottom: '0.5rem',
              color: '#374151',
            }}>
              Phone Number
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={phoneVerified}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  background: phoneVerified ? '#f1f5f9' : 'white',
                }}
              />
              {!phoneVerified && !verificationSent && (
                <button
                  onClick={sendVerification}
                  disabled={verifying || !phoneNumber}
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: verifying || !phoneNumber ? 0.5 : 1,
                  }}
                >
                  <Send size={16} />
                  Verify
                </button>
              )}
            </div>

            {phoneVerified && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem',
                color: '#059669',
                fontSize: '0.85rem',
              }}>
                <Shield size={14} />
                Phone verified
              </div>
            )}

            {verificationSent && !phoneVerified && (
              <div style={{ marginTop: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem',
                  color: '#374151',
                }}>
                  Enter verification code
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1.25rem',
                      textAlign: 'center',
                      letterSpacing: '0.25em',
                    }}
                  />
                  <button
                    onClick={verifyCode}
                    disabled={verifying || verificationCode.length !== 6}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      opacity: verifying || verificationCode.length !== 6 ? 0.5 : 1,
                    }}
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SMS Toggles */}
          {phoneVerified && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
              <ToggleRow
                label="Urgent Alerts"
                description="Critical updates about your lost pets"
                icon={<AlertCircle size={18} color="#ef4444" />}
                checked={smsPrefs.urgentAlerts}
                onChange={(checked) => setSmsPrefs({ ...smsPrefs, urgentAlerts: checked })}
              />
              <ToggleRow
                label="Sighting Alerts"
                description="When someone reports seeing your pet"
                icon={<Volume2 size={18} color="#10b981" />}
                checked={smsPrefs.sightingAlerts}
                onChange={(checked) => setSmsPrefs({ ...smsPrefs, sightingAlerts: checked })}
              />
              <ToggleRow
                label="Case Updates"
                description="Status changes and important updates"
                icon={<MessageSquare size={18} color="#f59e0b" />}
                checked={smsPrefs.caseUpdates}
                onChange={(checked) => setSmsPrefs({ ...smsPrefs, caseUpdates: checked })}
              />

              <button
                onClick={saveSmsPrefs}
                disabled={saving}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1.5rem',
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save SMS Preferences'}
              </button>
            </div>
          )}
        </div>

        {/* Email Section */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Mail size={20} color="#f59e0b" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Email Notifications</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Manage your email notification preferences
              </p>
            </div>
          </div>

          <ToggleRow
            label="Case Updates"
            description="Status changes and progress on your cases"
            icon={<AlertCircle size={18} color="#f59e0b" />}
            checked={emailPrefs.caseUpdates}
            onChange={(checked) => setEmailPrefs({ ...emailPrefs, caseUpdates: checked })}
          />
          <ToggleRow
            label="Sighting Alerts"
            description="When someone reports a possible sighting"
            icon={<Volume2 size={18} color="#10b981" />}
            checked={emailPrefs.sightingAlerts}
            onChange={(checked) => setEmailPrefs({ ...emailPrefs, sightingAlerts: checked })}
          />
          <ToggleRow
            label="Force Messages"
            description="Messages from your rescue force"
            icon={<MessageSquare size={18} color="#4f46e5" />}
            checked={emailPrefs.squadMessages}
            onChange={(checked) => setEmailPrefs({ ...emailPrefs, squadMessages: checked })}
          />
          <ToggleRow
            label="Weekly Digest"
            description="Summary of activity in your area"
            icon={<Mail size={18} color="#6b7280" />}
            checked={emailPrefs.weeklyDigest}
            onChange={(checked) => setEmailPrefs({ ...emailPrefs, weeklyDigest: checked })}
          />
          <ToggleRow
            label="System Announcements"
            description="Important platform updates and news"
            icon={<Bell size={18} color="#64748b" />}
            checked={emailPrefs.systemAnnouncements}
            onChange={(checked) => setEmailPrefs({ ...emailPrefs, systemAnnouncements: checked })}
          />

          <button
            onClick={saveEmailPrefs}
            disabled={saving}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Email Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, icon, checked, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {icon}
        <div>
          <p style={{ margin: 0, fontWeight: 500, color: '#1e293b' }}>{label}</p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: '48px',
          height: '28px',
          borderRadius: '14px',
          border: 'none',
          background: checked ? '#4f46e5' : '#e2e8f0',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
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
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}
