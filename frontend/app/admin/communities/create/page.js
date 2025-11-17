'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { US_LOCATIONS, searchLocations, isValidLocation } from '@/lib/us-locations';

export default function AdminCreateCommunityPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [parentCommunities, setParentCommunities] = useState([]);

  // Location search state
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState(US_LOCATIONS.slice(0, 50));

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'METRO_AREA',
    geographicScope: '',
    zipCodes: '',
    parentCommunityId: '',
    centerLatitude: '',
    centerLongitude: ''
  });

  useEffect(() => {
    // Check if admin
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }

    // Fetch parent communities for subcommunity option
    fetchParentCommunities();
  }, [session]);

  const fetchParentCommunities = async () => {
    try {
      const res = await fetch('/api/communities?type=METRO_AREA,COUNTY');
      if (res.ok) {
        const data = await res.json();
        setParentCommunities(data.communities || []);
      }
    } catch (err) {
      console.error('Error fetching parent communities:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle location search
  const handleLocationSearch = (query) => {
    setLocationSearch(query);
    setShowLocationDropdown(true);
    const results = searchLocations(query);
    const typeFiltered = formData.type === 'SUBCOMMUNITY'
      ? results
      : results.filter(loc => loc.type === formData.type || loc.type === 'COUNTY' || (loc.type === 'CITY' && formData.type !== 'COUNTY'));
    setFilteredLocations(typeFiltered.slice(0, 30));
  };

  // Select location from dropdown
  const selectLocation = (location) => {
    setFormData(prev => ({
      ...prev,
      geographicScope: location.value,
      name: location.label,
      type: location.type
    }));
    setLocationSearch(location.label);
    setShowLocationDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Parse zip codes
      const zipCodesArray = formData.zipCodes
        ? formData.zipCodes.split(',').map(z => z.trim()).filter(Boolean)
        : [];

      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        geographicScope: formData.geographicScope,
        zipCodes: zipCodesArray,
        parentCommunityId: formData.type === 'SUBCOMMUNITY' ? formData.parentCommunityId : null,
        centerLatitude: formData.centerLatitude ? parseFloat(formData.centerLatitude) : null,
        centerLongitude: formData.centerLongitude ? parseFloat(formData.centerLongitude) : null
      };

      const res = await fetch('/api/admin/communities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create community');
      }

      setSuccess(`Community "${data.community.name}" created successfully!`);

      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'METRO_AREA',
        geographicScope: '',
        zipCodes: '',
        parentCommunityId: '',
        centerLatitude: '',
        centerLongitude: ''
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/admin/communities');
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
        maxWidth: '800px',
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
              Create New Community
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Admin direct creation - bypasses approval workflow
            </p>
          </div>
          <Link
            href="/admin/communities"
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
          {/* Community Type */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              Community Type *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            >
              <option value="METRO_AREA">Metro Area</option>
              <option value="COUNTY">County</option>
              <option value="SUBCOMMUNITY">Subcommunity</option>
            </select>
          </div>

          {/* Parent Community (for subcommunities) */}
          {formData.type === 'SUBCOMMUNITY' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                color: '#0f172a'
              }}>
                Parent Community *
              </label>
              <select
                name="parentCommunityId"
                value={formData.parentCommunityId}
                onChange={handleChange}
                required={formData.type === 'SUBCOMMUNITY'}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Select parent community...</option>
                {parentCommunities.map(community => (
                  <option key={community.id} value={community.id}>
                    {community.name} ({community.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Community Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              Community Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Chicago Metro Area"
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

          {/* Description */}
          <div style={{ marginBottom: '1.5rem' }}>
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
              placeholder="Brief description of this community..."
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

          {/* Geographic Scope */}
          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              {formData.type === 'SUBCOMMUNITY' ? 'Neighborhood/Area Name *' : 'Select Location *'}
            </label>
            {formData.type === 'SUBCOMMUNITY' ? (
              // Free text for subcommunities
              <input
                type="text"
                name="geographicScope"
                value={formData.geographicScope}
                onChange={handleChange}
                placeholder="e.g., Lincoln Park, Downtown..."
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            ) : (
              // Searchable dropdown for metros/counties/cities
              <>
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                  onFocus={() => setShowLocationDropdown(true)}
                  placeholder="Search for city, metro, or county..."
                  required={!formData.geographicScope}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
                {showLocationDropdown && filteredLocations.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    marginTop: '0.5rem',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    zIndex: 10
                  }}>
                    {filteredLocations.map((location) => (
                      <div
                        key={location.value}
                        onClick={() => selectLocation(location)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>
                          {location.label}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                          {location.type === 'METRO_AREA' ? '🌆 Metro Area' : location.type === 'COUNTY' ? '🏞️ County' : '🏙️ City'} • {location.state}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {formData.geographicScope && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#10b981', fontWeight: '600' }}>
                    ✓ Selected: {locationSearch || formData.geographicScope}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Zip Codes */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              Zip Codes (comma-separated)
            </label>
            <input
              type="text"
              name="zipCodes"
              value={formData.zipCodes}
              onChange={handleChange}
              placeholder="e.g., 60601, 60602, 60603"
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
              Optional: List zip codes covered by this community
            </p>
          </div>

          {/* Center Coordinates */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                color: '#0f172a'
              }}>
                Center Latitude
              </label>
              <input
                type="number"
                step="any"
                name="centerLatitude"
                value={formData.centerLatitude}
                onChange={handleChange}
                placeholder="41.8781"
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
                Center Longitude
              </label>
              <input
                type="number"
                step="any"
                name="centerLongitude"
                value={formData.centerLongitude}
                onChange={handleChange}
                placeholder="-87.6298"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? '#cbd5e1' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating Community...' : 'Create Community'}
          </button>
        </form>
      </div>
    </div>
  );
}
