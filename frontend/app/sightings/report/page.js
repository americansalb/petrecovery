'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ReportSightingForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const alertId = searchParams.get('alertId');

  const [formData, setFormData] = useState({
    alertId: alertId || '',
    location: '',
    details: '',
    timeOfSighting: '',
    behavior: '',
    direction: '',
    contactForFollowUp: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // TODO: Replace with actual API call
      // const res = await fetch('/api/sightings', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });
      //
      // if (!res.ok) {
      //   throw new Error('Failed to submit sighting');
      // }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        if (alertId) {
          router.push(`/alerts/${alertId}`);
        } else {
          router.push('/dashboard');
        }
      }, 2000);
    } catch (err) {
      setError('Failed to submit sighting. Please try again.');
    } finally {
      setLoading(false);
    }
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

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '1rem',
      }}>
        <div style={{
          maxWidth: '500px',
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#10b981',
            marginBottom: '1rem',
          }}>
            Sighting Reported!
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Thank you for helping reunite this pet with their family. The owner has been notified.
          </p>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#10b981',
        color: 'white',
        padding: '1rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <Link
            href={alertId ? `/alerts/${alertId}` : '/dashboard'}
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
              Report a Sighting
            </h1>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Help reunite a pet with their family
            </p>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1.5rem 1rem',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          {/* Info Banner */}
          <div style={{
            backgroundColor: '#d1fae5',
            border: '2px solid #10b981',
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '2rem',
          }}>
            <div style={{ fontWeight: '600', color: '#065f46', marginBottom: '0.5rem' }}>
              🎯 Your Report Makes a Difference
            </div>
            <div style={{ fontSize: '0.875rem', color: '#047857' }}>
              Even small details help. Report exactly what you saw, when, and where. The owner will be notified immediately.
            </div>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!alertId && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                }}>
                  Alert ID *
                </label>
                <input
                  type="text"
                  name="alertId"
                  value={formData.alertId}
                  onChange={handleChange}
                  placeholder="Enter alert ID from the poster or alert page"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Exact Location *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="123 Main St or Main St & Oak Ave"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              />
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginTop: '0.5rem',
              }}>
                Be as specific as possible - street corner, landmark, building, etc.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Time of Sighting *
              </label>
              <select
                name="timeOfSighting"
                value={formData.timeOfSighting}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              >
                <option value="">Select time...</option>
                <option value="just_now">Just now (within 15 min)</option>
                <option value="30min">About 30 minutes ago</option>
                <option value="1hour">About 1 hour ago</option>
                <option value="2hours">About 2 hours ago</option>
                <option value="today">Earlier today</option>
                <option value="yesterday">Yesterday</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                What Did You See? *
              </label>
              <textarea
                name="details"
                value={formData.details}
                onChange={handleChange}
                placeholder="Describe what you saw: appearance, behavior, anything distinctive..."
                required
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                }}
              />
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginTop: '0.5rem',
              }}>
                Include: What was the pet doing? Did it seem scared/friendly? Any collar/tags?
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Behavior
              </label>
              <select
                name="behavior"
                value={formData.behavior}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              >
                <option value="">Select behavior...</option>
                <option value="friendly">Friendly/Approachable</option>
                <option value="scared">Scared/Timid</option>
                <option value="running">Running/Moving Fast</option>
                <option value="hiding">Hiding</option>
                <option value="stationary">Staying in one area</option>
                <option value="injured">Appears injured</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Direction of Travel
              </label>
              <input
                type="text"
                name="direction"
                value={formData.direction}
                onChange={handleChange}
                placeholder="e.g., Heading north toward the park, went into alley behind shops..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  name="contactForFollowUp"
                  checked={formData.contactForFollowUp}
                  onChange={handleChange}
                  style={{
                    width: '20px',
                    height: '20px',
                    marginTop: '0.25rem',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                  Owner can contact me for follow-up questions
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1.125rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Submitting...' : '👁️ Submit Sighting Report'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ReportSightingPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
      }}>
        <div>Loading...</div>
      </div>
    }>
      <ReportSightingForm />
    </Suspense>
  );
}
