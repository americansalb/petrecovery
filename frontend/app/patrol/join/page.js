'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function JoinPatrol() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    radiusMiles: 5,
    availability: [],
    transportation: [],
    searchesDogs: true,
    searchesCats: true,
    searchesBirds: false,
    searchesOther: false,
    alertMethod: 'EMAIL',
    instantAlerts: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const toggleArrayItem = (array, item) => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    }
    return [...array, item];
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Get actual userId from auth session
      const userId = 'temp-user-id';

      const response = await fetch('/api/patrol/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join patrol');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(to bottom, #dbeafe, #bfdbfe)',
      }}>
        <div style={{
          maxWidth: '500px',
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e40af' }}>
            Welcome to Recovery Patrol!
          </h1>
          <p style={{ marginBottom: '2rem', color: '#4b5563', lineHeight: '1.6' }}>
            You're now part of a community of pet lovers helping reunite lost pets with their families.
            You'll receive alerts when pets go missing in your area.
          </p>
          <Link href="/patrol/dashboard" style={{
            display: 'inline-block',
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '1rem 2rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: '600',
          }}>
            Go to Patrol Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem 1rem',
      background: 'linear-gradient(to bottom, #dbeafe, #bfdbfe)',
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '0.5rem',
          }}>
            Join Recovery Patrol
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#4b5563',
          }}>
            Help find lost pets in your community
          </p>
        </div>

        {/* Progress Bar */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
        }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                backgroundColor: step >= s ? '#2563eb' : '#e5e7eb',
                borderRadius: '2px',
              }}
            />
          ))}
        </div>

        {/* Form */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}>
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

          {/* Step 1: Coverage Area */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                Coverage Area
              </h2>

              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Search Radius: {formData.radiusMiles} miles
              </label>
              <input
                type="range"
                min="1"
                max="25"
                value={formData.radiusMiles}
                onChange={(e) => setFormData({ ...formData, radiusMiles: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  marginBottom: '1.5rem',
                }}
              />

              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Pet Types You Can Help With
              </label>
              <div style={{ marginBottom: '1.5rem' }}>
                {[
                  { key: 'searchesDogs', label: '🐕 Dogs' },
                  { key: 'searchesCats', label: '🐈 Cats' },
                  { key: 'searchesBirds', label: '🦜 Birds' },
                  { key: 'searchesOther', label: '🐰 Other Pets' },
                ].map((option) => (
                  <label
                    key={option.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      backgroundColor: formData[option.key] ? '#eff6ff' : 'white',
                      borderColor: formData[option.key] ? '#3b82f6' : '#e5e7eb',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData[option.key]}
                      onChange={(e) => setFormData({ ...formData, [option.key]: e.target.checked })}
                      style={{ marginRight: '0.75rem', width: '20px', height: '20px' }}
                    />
                    <span style={{ fontSize: '1.125rem' }}>{option.label}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Availability */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                When Can You Search?
              </h2>

              <div style={{ marginBottom: '1.5rem' }}>
                {[
                  { key: 'weekday_morning', label: 'Weekday Mornings' },
                  { key: 'weekday_afternoon', label: 'Weekday Afternoons' },
                  { key: 'weekday_evening', label: 'Weekday Evenings' },
                  { key: 'weekend_morning', label: 'Weekend Mornings' },
                  { key: 'weekend_afternoon', label: 'Weekend Afternoons' },
                  { key: 'weekend_evening', label: 'Weekend Evenings' },
                ].map((option) => (
                  <label
                    key={option.key}
                    style={{
                      display: 'block',
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      backgroundColor: formData.availability.includes(option.key) ? '#eff6ff' : 'white',
                      borderColor: formData.availability.includes(option.key) ? '#3b82f6' : '#e5e7eb',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.availability.includes(option.key)}
                      onChange={() => setFormData({
                        ...formData,
                        availability: toggleArrayItem(formData.availability, option.key)
                      })}
                      style={{ marginRight: '0.75rem', width: '20px', height: '20px' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>

              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Transportation
              </label>
              <div style={{ marginBottom: '1.5rem' }}>
                {[
                  { key: 'foot', label: '🚶 On Foot' },
                  { key: 'bike', label: '🚲 Bike' },
                  { key: 'car', label: '🚗 Car' },
                ].map((option) => (
                  <label
                    key={option.key}
                    style={{
                      display: 'inline-block',
                      padding: '0.75rem 1.5rem',
                      marginRight: '0.5rem',
                      marginBottom: '0.5rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '2rem',
                      cursor: 'pointer',
                      backgroundColor: formData.transportation.includes(option.key) ? '#eff6ff' : 'white',
                      borderColor: formData.transportation.includes(option.key) ? '#3b82f6' : '#e5e7eb',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.transportation.includes(option.key)}
                      onChange={() => setFormData({
                        ...formData,
                        transportation: toggleArrayItem(formData.transportation, option.key)
                      })}
                      style={{ marginRight: '0.5rem' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: '#e5e7eb',
                    color: '#1f2937',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={formData.availability.length === 0 || formData.transportation.length === 0}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: formData.availability.length === 0 || formData.transportation.length === 0 ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    cursor: formData.availability.length === 0 || formData.transportation.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Notifications */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                Notification Preferences
              </h2>

              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                How Should We Alert You?
              </label>
              <select
                value={formData.alertMethod}
                onChange={(e) => setFormData({ ...formData, alertMethod: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  marginBottom: '1.5rem',
                  fontSize: '1rem',
                }}
              >
                <option value="EMAIL">Email Only</option>
                <option value="SMS">SMS Only</option>
                <option value="ALL">Email + SMS</option>
              </select>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={formData.instantAlerts}
                  onChange={(e) => setFormData({ ...formData, instantAlerts: e.target.checked })}
                  style={{ marginRight: '0.75rem', width: '20px', height: '20px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Instant Alerts</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Get notified immediately when a pet goes missing nearby
                  </div>
                </div>
              </label>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: '#e5e7eb',
                    color: '#1f2937',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: isSubmitting ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? 'Joining...' : 'Join Patrol'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
