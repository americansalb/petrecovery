'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getCitySuggestions, getCityByName, isValidCity } from '@/app/lib/cities';

function CreateRescueSquadForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);

  const [formData, setFormData] = useState({
    city: '',
    state: '',
    zipCode: ''
  });

  // Pre-populate form from URL params
  useEffect(() => {
    const cityParam = searchParams.get('city');
    const stateParam = searchParams.get('state');
    const zipParam = searchParams.get('zipCode');

    console.log('📝 [CREATE] URL params:', { city: cityParam, state: stateParam, zip: zipParam });

    if (cityParam || stateParam || zipParam) {
      setFormData({
        city: cityParam || '',
        state: stateParam || '',
        zipCode: zipParam || ''
      });

      // If we have city and state, try to find the full city data
      if (cityParam && stateParam) {
        const cityData = getCityByName(cityParam, stateParam);
        if (cityData) {
          setSelectedCity(cityData);
          console.log('✅ [CREATE] Found city data:', cityData);
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'city') {
      setFormData(prev => ({ ...prev, city: value }));

      // Show suggestions for city names
      if (value.trim().length >= 2) {
        const citySuggestions = getCitySuggestions(value.trim(), 10);
        setSuggestions(citySuggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
      setSelectedCity(null);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const selectCity = (cityData) => {
    console.log('🎯 [CREATE] Selected city:', cityData);
    setFormData({
      city: cityData.city,
      state: cityData.state_id,
      zipCode: cityData.zips[0] || ''
    });
    setSelectedCity(cityData);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    console.log('🚀 [CREATE] Submitting rescue squad creation...', formData);

    try {
      if (!formData.city || !formData.state || !formData.zipCode) {
        throw new Error('Please fill in all required fields');
      }

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      console.log('📥 [CREATE] Response:', data);

      if (!res.ok) {
        console.error('❌ [CREATE] Failed:', data.error);
        throw new Error(data.error || 'Failed to create rescue squad');
      }

      console.log('✅ [CREATE] Rescue squad created successfully!', data.squad);
      setSuccess(`Rescue Squad "${data.squad.name}" created successfully!`);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/admin/rescue-squads');
      }, 2000);

    } catch (err) {
      console.error('❌ [CREATE] Error:', err.message);
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

        {/* Preview Box */}
        {(formData.city || formData.state) && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            color: 'white'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', opacity: 0.9 }}>
              Creating Rescue Squad For:
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '900' }}>
              {formData.city || '(City not selected)'}
              {formData.state && `, ${formData.state}`}
            </div>
            {formData.zipCode && (
              <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.9 }}>
                ZIP Code: {formData.zipCode}
              </div>
            )}
            {selectedCity && (
              <div style={{ fontSize: '0.85rem', marginTop: '0.75rem', opacity: 0.85 }}>
                ✓ Verified in database: {selectedCity.state_name}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '0.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '2px solid #f1f5f9'
          }}>
            Rescue Squad Location
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>
            Start typing a city name to see suggestions from our database of 29,000+ US cities
          </p>

          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              City * <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>(Search by name)</span>
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder="e.g., Springfield, Chicago, Los Angeles..."
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: selectedCity ? '2px solid #10b981' : '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                background: selectedCity ? '#f0fdf4' : 'white'
              }}
            />

            {/* City Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                marginTop: '0.5rem',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {suggestions.map((city, idx) => (
                  <div
                    key={`${city.city}-${city.state_id}-${idx}`}
                    onMouseDown={() => selectCity(city)}
                    style={{
                      padding: '0.875rem 1rem',
                      cursor: 'pointer',
                      borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: 'white'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.25rem' }}>
                      {city.city}, {city.state_id}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {city.state_name} • ZIP: {city.zips[0] || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              State * <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>(Auto-filled when you select a city)</span>
            </label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              placeholder="e.g., IL"
              maxLength="2"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                textTransform: 'uppercase',
                background: selectedCity ? '#f8fafc' : 'white'
              }}
            />
            <p style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              {selectedCity ? `✓ ${selectedCity.state_name}` : 'Two-letter state code (e.g., IL, NY, CA)'}
            </p>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              ZIP Code * <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>(Auto-filled when you select a city)</span>
            </label>
            <input
              type="text"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleChange}
              placeholder="e.g., 60601"
              pattern="[0-9]{5}"
              maxLength="5"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem',
                background: selectedCity ? '#f8fafc' : 'white'
              }}
            />
            <p style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              {selectedCity && selectedCity.zips.length > 1
                ? `This city has ${selectedCity.zips.length} ZIP codes. First one selected.`
                : '5-digit ZIP code for the squad\'s primary location'}
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? '#cbd5e1' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1.1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Creating Rescue Squad...' : 'Create Rescue Squad'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminCreateRescueSquadPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#64748b' }}>
            Loading...
          </div>
        </div>
      </div>
    }>
      <CreateRescueSquadForm />
    </Suspense>
  );
}
