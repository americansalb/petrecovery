'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import map component (client-side only)
const PolygonDrawMap = dynamic(
  () => import('@/app/components/PolygonDrawMap'),
  { ssr: false, loading: () => <div style={{ height: '500px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map...</div> }
);

export default function AdminCreateDivisionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allSquads, setAllSquads] = useState([]);
  const [loadingSquads, setLoadingSquads] = useState(true);

  const [formData, setFormData] = useState({
    rescueSquadId: '',
    name: '',
    description: '',
    boundaries: null,
    centerLatitude: null,
    centerLongitude: null,
    zipCodes: ''
  });

  useEffect(() => {
    if (!session) {
      router.push('/login?callbackUrl=/admin/divisions/create');
    } else if (session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      fetchAllSquads();
    }
  }, [session]);

  const fetchAllSquads = async () => {
    try {
      setLoadingSquads(true);
      const res = await fetch('/api/admin/rescue-squads');
      if (res.ok) {
        const data = await res.json();
        setAllSquads(data.squads || []);
      }
    } catch (err) {
      console.error('Error fetching squads:', err);
    } finally {
      setLoadingSquads(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePolygonComplete = (coordinates, center) => {
    setFormData({
      ...formData,
      boundaries: coordinates,
      centerLatitude: center.lat,
      centerLongitude: center.lng
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (!formData.rescueSquadId) {
        throw new Error('Please select a rescue squad');
      }
      if (!formData.name.trim()) {
        throw new Error('Please enter a division name');
      }
      if (!formData.boundaries || formData.boundaries.length < 3) {
        throw new Error('Please draw the division boundaries on the map');
      }

      const res = await fetch('/api/admin/divisions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create division');
      }

      // Success! Redirect to the squad detail page
      router.push(`/rescue-squads/${formData.rescueSquadId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  const selectedSquad = allSquads.find(s => s.id === formData.rescueSquadId);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
              ⚙️ Create Division
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Create a new division within a rescue squad
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
            ← Back to Divisions
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #dc2626',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '2rem',
            color: '#991b1b',
            fontWeight: '600'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Basic Info Card */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Division Details
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Select Squad */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '700',
                  color: '#0f172a'
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
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="">
                    {loadingSquads ? 'Loading squads...' : 'Select a rescue squad...'}
                  </option>
                  {allSquads.map(squad => (
                    <option key={squad.id} value={squad.id}>
                      {squad.name} - {squad.city}, {squad.state}
                    </option>
                  ))}
                </select>
                <p style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  marginTop: '0.5rem'
                }}>
                  Select which rescue squad this division belongs to
                </p>
              </div>

              {/* Division Name */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '700',
                  color: '#0f172a'
                }}>
                  Division Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="North Side, Downtown, Lincoln Park, etc."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
                <p style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  marginTop: '0.5rem'
                }}>
                  A clear, descriptive name for the division
                </p>
              </div>

              {/* Description */}
              <div>
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
                  placeholder="Brief description of this division's coverage area and purpose"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* ZIP Codes */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '700',
                  color: '#0f172a'
                }}>
                  ZIP Codes (Optional)
                </label>
                <input
                  type="text"
                  name="zipCodes"
                  value={formData.zipCodes}
                  onChange={handleChange}
                  placeholder="60601, 60602, 60603"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
                <p style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  marginTop: '0.5rem'
                }}>
                  Comma-separated list of ZIP codes covered by this division
                </p>
              </div>
            </div>
          </div>

          {/* Map Card */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1rem'
            }}>
              Draw Division Boundaries <span style={{ color: '#ef4444' }}>*</span>
            </h2>
            <p style={{
              fontSize: '0.95rem',
              color: '#64748b',
              marginBottom: '1.5rem'
            }}>
              Use the drawing tools to outline the geographic area this division will cover.
              {selectedSquad && ` Centered on ${selectedSquad.city}, ${selectedSquad.state}.`}
            </p>

            <PolygonDrawMap
              initialCenter={
                selectedSquad
                  ? {
                      lat: selectedSquad.centerLatitude || 41.8781,
                      lng: selectedSquad.centerLongitude || -87.6298
                    }
                  : { lat: 41.8781, lng: -87.6298 }
              }
              onPolygonComplete={handlePolygonComplete}
              initialZoom={12}
            />

            {formData.boundaries && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#f0fdf4',
                border: '2px solid #86efac',
                borderRadius: '8px',
                color: '#166534',
                fontWeight: '600'
              }}>
                ✓ Boundaries drawn ({formData.boundaries.length} points)
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <Link
              href="/admin/divisions"
              style={{
                padding: '0.75rem 2rem',
                background: 'white',
                color: '#64748b',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '1rem'
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 2rem',
                background: loading ? '#cbd5e1' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'
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
