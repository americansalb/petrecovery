'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCreateRescueSquadPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [legalError, setLegalError] = useState(null); // { message, redirectTo }

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    centerLatitude: '',
    centerLongitude: '',
    radiusMiles: 5,
    coverageType: 'CITYWIDE',
    specializesInDogs: true,
    specializesInCats: true,
    specializesInBirds: true,
    specializesInOther: true,
    availableWeekdays: true,
    availableWeekends: true,
    availableDay: true,
    availableNight: false,
    hasTrackingDogs: false,
    hasDrones: false
  });

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLegalError(null);
    setLoading(true);

    try {
      const payload = {
        ...formData,
        radiusMiles: parseInt(formData.radiusMiles),
        centerLatitude: formData.centerLatitude ? parseFloat(formData.centerLatitude) : null,
        centerLongitude: formData.centerLongitude ? parseFloat(formData.centerLongitude) : null,
        // Always enable all pet types - we help ALL pets
        specializesInDogs: true,
        specializesInCats: true,
        specializesInBirds: true,
        specializesInOther: true
      };

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for legal consent requirement (Phase 0: Legal Baseline)
        if (res.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          return;
        }

        throw new Error(data.error || 'Failed to create rescue squad');
      }

      setSuccess(`Rescue Squad "${data.squad.name}" created successfully!`);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/rescue-squads');
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Create Rescue Squad
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Set up a new city-level volunteer rescue squad
            </p>
          </div>
          <Link
            href="/rescue-squads"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#64748b',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700'
            }}
          >
            ← Back
          </Link>
        </div>

        {/* Legal Consent Required Banner */}
        {legalError && (
          <div style={{
            padding: '1.5rem',
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: '#92400e', marginBottom: '0.25rem' }}>
                  Legal Agreement Required
                </div>
                <div style={{ color: '#b45309', fontSize: '0.95rem' }}>
                  {legalError.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(legalError.redirectTo)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Review & Accept Now →
            </button>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div style={{
            padding: '1rem',
            background: '#d1fae5',
            border: '2px solid #6ee7b7',
            borderRadius: '8px',
            color: '#065f46',
            marginBottom: '2rem',
            fontWeight: '600'
          }}>
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
            marginBottom: '2rem',
            fontWeight: '600'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Basic Information */}
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '2px solid #f1f5f9'
          }}>
            Basic Information
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              Squad Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Chicago Rescue Squad"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
            <p style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              Use the city or town name (e.g., "Denver Rescue Squad")
            </p>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of this rescue squad..."
              rows="3"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Geographic Coverage */}
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '2px solid #f1f5f9'
          }}>
            Geographic Coverage
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              Coverage Type
            </label>
            <select
              name="coverageType"
              value={formData.coverageType}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            >
              <option value="CITYWIDE">Citywide</option>
              <option value="RADIUS">Radius (from center point)</option>
              <option value="NEIGHBORHOOD">Specific Neighborhoods</option>
              <option value="CUSTOM">Custom Boundary</option>
            </select>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                color: '#0f172a'
              }}>
                Center Latitude *
              </label>
              <input
                type="number"
                step="any"
                name="centerLatitude"
                value={formData.centerLatitude}
                onChange={handleChange}
                placeholder="41.8781"
                required
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
                fontWeight: '700',
                color: '#0f172a'
              }}>
                Center Longitude *
              </label>
              <input
                type="number"
                step="any"
                name="centerLongitude"
                value={formData.centerLongitude}
                onChange={handleChange}
                placeholder="-87.6298"
                required
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
                fontWeight: '700',
                color: '#0f172a'
              }}>
                Radius (miles)
              </label>
              <input
                type="number"
                name="radiusMiles"
                value={formData.radiusMiles}
                onChange={handleChange}
                min="1"
                max="100"
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

          {/* Specializations */}
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '2px solid #f1f5f9'
          }}>
            Specializations
          </h2>

          {/* Equipment & Resources */}
          <div style={{ marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#0f172a',
                marginBottom: '0.75rem'
              }}>
                Equipment & Resources
              </h3>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="hasTrackingDogs"
                  checked={formData.hasTrackingDogs}
                  onChange={handleChange}
                  style={{ width: '1.2rem', height: '1.2rem' }}
                />
                <span>🦮 Tracking Dogs</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="hasDrones"
                  checked={formData.hasDrones}
                  onChange={handleChange}
                  style={{ width: '1.2rem', height: '1.2rem' }}
                />
                <span>🚁 Drones</span>
              </label>
            </div>

          {/* Availability */}
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '2px solid #f1f5f9'
          }}>
            Availability
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                name="availableWeekdays"
                checked={formData.availableWeekdays}
                onChange={handleChange}
                style={{ width: '1.2rem', height: '1.2rem' }}
              />
              <span>Available Weekdays</span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                name="availableWeekends"
                checked={formData.availableWeekends}
                onChange={handleChange}
                style={{ width: '1.2rem', height: '1.2rem' }}
              />
              <span>Available Weekends</span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                name="availableDay"
                checked={formData.availableDay}
                onChange={handleChange}
                style={{ width: '1.2rem', height: '1.2rem' }}
              />
              <span>Available Daytime</span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                name="availableNight"
                checked={formData.availableNight}
                onChange={handleChange}
                style={{ width: '1.2rem', height: '1.2rem' }}
              />
              <span>Available Nighttime</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? '#cbd5e1' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Creating Rescue Squad...' : 'Create Rescue Squad'}
          </button>
        </form>
      </div>
    </div>
  );
}
