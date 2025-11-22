'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCreateDivisionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [squads, setSquads] = useState([]);
  const [loadingSquads, setLoadingSquads] = useState(true);

  const [formData, setFormData] = useState({
    rescueSquadId: '',
    name: '',
    zipCode: ''
  });

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      loadSquads();
    }
  }, [session]);

  const loadSquads = async () => {
    try {
      const res = await fetch('/api/admin/rescue-squads');
      if (res.ok) {
        const data = await res.json();
        setSquads(data.squads || []);
      }
    } catch (error) {
      console.error('Error loading squads:', error);
    } finally {
      setLoadingSquads(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.rescueSquadId || !formData.name || !formData.zipCode) {
        throw new Error('All fields are required');
      }

      // Geocode the ZIP to get coordinates
      const geoRes = await fetch(`https://api.zippopotam.us/us/${formData.zipCode}`);
      if (!geoRes.ok) {
        throw new Error('Invalid ZIP code');
      }

      const geoData = await geoRes.json();
      const place = geoData.places[0];
      const centerLatitude = parseFloat(place['latitude']);
      const centerLongitude = parseFloat(place['longitude']);

      const payload = {
        rescueSquadId: formData.rescueSquadId,
        name: formData.name.trim(),
        description: null,
        boundaries: null,
        centerLatitude,
        centerLongitude
      };

      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create division');
      }

      setSuccess(`Division "${data.division.name}" created successfully!`);

      // Clear form
      setFormData({
        rescueSquadId: '',
        name: '',
        zipCode: ''
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/rescue-squads/${data.division.rescueSquadId}`);
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
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Create Division
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Manually create a neighborhood division within a rescue squad
            </p>
          </div>
          <Link
            href="/admin/divisions"
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

        {/* Success Message */}
        {success && (
          <div style={{
            padding: '1rem',
            background: '#d1fae5',
            color: '#065f46',
            borderRadius: '8px',
            marginBottom: '2rem',
            fontWeight: '600',
            border: '2px solid #10b981'
          }}>
            ✓ {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '8px',
            marginBottom: '2rem',
            fontWeight: '600',
            border: '2px solid #ef4444'
          }}>
            ✗ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Rescue Squad Selection */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Rescue Squad <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              name="rescueSquadId"
              value={formData.rescueSquadId}
              onChange={handleChange}
              required
              disabled={loadingSquads}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            >
              <option value="">Select a Rescue Squad...</option>
              {squads.map(squad => (
                <option key={squad.id} value={squad.id}>
                  {squad.name} ({squad.city}, {squad.state})
                </option>
              ))}
            </select>
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              Choose the parent rescue squad for this division
            </p>
          </div>

          {/* Division Name */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Division Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Lakeview Division, Lincoln Park Division"
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
              fontSize: '0.875rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              Name should include "Division" suffix for clarity
            </p>
          </div>

          {/* ZIP Code */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              ZIP Code <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleChange}
              placeholder="60613"
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
              fontSize: '0.875rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              We'll use this to automatically set the division's center coordinates
            </p>
          </div>

          {/* Submit Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <Link
              href="/admin/divisions"
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
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#cbd5e1' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Division'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
