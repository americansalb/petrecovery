'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { theme } from '../../lib/theme';

export default function ReportLostPet() {
  const [step, setStep] = useState(1);
  const [petType, setPetType] = useState('');

  // Location and map data
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [center, setCenter] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(2); // Smaller default for lost pets
  const [timeElapsed, setTimeElapsed] = useState('');

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Report submission data
  const [reportData, setReportData] = useState({
    // User info
    email: '',
    phone: '',
    firstName: '',
    // Pet info
    petName: '',
    breed: '',
    color: '',
    size: 'MEDIUM',
    age: '',
    sex: 'UNKNOWN',
    distinctiveMarks: '',
    microchipId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportId, setReportId] = useState(null);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || !center || step !== 3) {
      if (step !== 3 && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
      return;
    }

    if (mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      const map = L.map(mapRef.current).setView(center, 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(center, { draggable: true }).addTo(map);
      markerRef.current = marker;

      const circle = L.circle(center, {
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.2,
        radius: radiusMiles * 1609.34,
      }).addTo(map);
      circleRef.current = circle;

      marker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [step]);

  useEffect(() => {
    if (markerRef.current && circleRef.current && center) {
      markerRef.current.setLatLng(center);
      circleRef.current.setLatLng(center);
    }
  }, [center]);

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radiusMiles * 1609.34);
    }
  }, [radiusMiles]);

  const geocodeAddress = async () => {
    if (!lastSeenAddress || lastSeenAddress.length < 3) {
      setError('Please enter a valid address or zip code');
      return;
    }

    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(lastSeenAddress)}&format=json&limit=1&countrycodes=us`,
        {
          headers: {
            'User-Agent': 'PetRecovery.org'
          }
        }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setCenter([lat, lon]);
        setStep(3);
      } else {
        setError('Could not find that address. Please try again or be more specific.');
      }
    } catch (err) {
      setError('Error finding address. Please try again.');
      console.error('Geocoding error:', err);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Submit to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setReportId('temp-report-id');
      setStep(6);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      fontFamily: theme.fonts.sans,
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '1.5rem 2rem',
        boxShadow: theme.shadows.sm,
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Link
            href="/"
            style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#1e293b',
              textDecoration: 'none',
            }}
          >
            ← PetRecovery
          </Link>
        </div>
      </div>

      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '3rem 2rem',
      }}>
        {/* Progress Bar */}
        {step > 1 && step < 6 && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '2rem',
          }}>
            {[2, 3, 4, 5].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: step >= s ? '#dc2626' : '#e5e7eb',
                  borderRadius: '3px',
                }}
              />
            ))}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '2px solid #fca5a5',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: theme.radius.lg,
            marginBottom: '1.5rem',
            fontWeight: '600',
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Pet Type */}
        {step === 1 && (
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚨</div>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: '900',
              marginBottom: '1rem',
              color: '#dc2626',
              lineHeight: '1.1',
            }}>
              Report Lost Pet
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: theme.colors.gray[600],
              marginBottom: '3rem',
            }}>
              Alert your community and get help finding your pet
            </p>

            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1.5rem',
              color: theme.colors.gray[900],
            }}>
              What type of pet is missing?
            </h2>

            <div style={{
              display: 'grid',
              gap: '1rem',
              maxWidth: '400px',
              margin: '0 auto',
            }}>
              {[
                { type: 'dog', label: '🐕 Dog', color: '#3b82f6' },
                { type: 'cat', label: '🐈 Cat', color: '#8b5cf6' },
                { type: 'bird', label: '🦜 Bird', color: '#10b981' },
                { type: 'other', label: '🐰 Other Pet', color: '#f59e0b' },
              ].map((pet) => (
                <button
                  key={pet.type}
                  onClick={() => {
                    setPetType(pet.type);
                    setStep(2);
                  }}
                  style={{
                    padding: '1.5rem',
                    background: pet.color,
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.radius.lg,
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: theme.shadows.md,
                  }}
                >
                  {pet.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Last Seen Location & Time */}
        {step === 2 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            maxWidth: '600px',
            margin: '0 auto',
            boxShadow: theme.shadows.lg,
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              marginBottom: '1rem',
              color: theme.colors.gray[900],
            }}>
              Where was your pet last seen?
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              Enter the address or zip code where your pet went missing
            </p>

            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: theme.colors.gray[700],
            }}>
              Last Seen Address or Zip Code
            </label>
            <input
              type="text"
              value={lastSeenAddress}
              onChange={(e) => setLastSeenAddress(e.target.value)}
              placeholder="123 Main St, City, State or 60601"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e5e7eb',
                borderRadius: theme.radius.lg,
                fontSize: '1rem',
                marginBottom: '2rem',
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && lastSeenAddress && timeElapsed) {
                  geocodeAddress();
                }
              }}
            />

            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: theme.colors.gray[700],
            }}>
              When did they go missing?
            </label>
            <select
              value={timeElapsed}
              onChange={(e) => setTimeElapsed(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e5e7eb',
                borderRadius: theme.radius.lg,
                fontSize: '1rem',
                marginBottom: '2rem',
              }}
            >
              <option value="">Select time...</option>
              <option value="less_than_hour">Less than 1 hour ago</option>
              <option value="1_to_6_hours">1-6 hours ago</option>
              <option value="6_to_24_hours">6-24 hours ago</option>
              <option value="1_to_3_days">1-3 days ago</option>
              <option value="3_to_7_days">3-7 days ago</option>
              <option value="1_to_2_weeks">1-2 weeks ago</option>
              <option value="more_than_2_weeks">More than 2 weeks ago</option>
            </select>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#f1f5f9',
                  color: theme.colors.gray[700],
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={geocodeAddress}
                disabled={!lastSeenAddress || !timeElapsed}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: lastSeenAddress && timeElapsed ? '#dc2626' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: lastSeenAddress && timeElapsed ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Map with Search Radius */}
        {step === 3 && center && (
          <div style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '2rem',
            boxShadow: theme.shadows.lg,
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              marginBottom: '1rem',
              color: theme.colors.gray[900],
            }}>
              Set Your Search Area
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              Drag the marker to adjust the exact location. Set the search radius to alert community members in that area.
            </p>

            {/* Map */}
            <div style={{
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              marginBottom: '2rem',
              height: '450px',
              boxShadow: theme.shadows.md,
            }}>
              <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
            </div>

            {/* Radius Slider */}
            <div style={{
              background: '#fef2f2',
              padding: '1.5rem',
              borderRadius: theme.radius.lg,
              marginBottom: '2rem',
            }}>
              <label style={{
                display: 'block',
                marginBottom: '1rem',
                fontWeight: '700',
                fontSize: '1.1rem',
                color: theme.colors.gray[900],
              }}>
                Search Radius: <span style={{ color: '#dc2626' }}>{radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '8px',
                  cursor: 'pointer',
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.5rem',
                fontSize: '0.9rem',
                color: theme.colors.gray[500],
              }}>
                <span>1 mile</span>
                <span>10 miles</span>
              </div>
            </div>

            <div style={{
              background: '#dbeafe',
              border: '2px solid #0ea5e9',
              borderRadius: theme.radius.lg,
              padding: '1rem',
              marginBottom: '2rem',
            }}>
              <p style={{
                margin: 0,
                color: '#075985',
                fontSize: '0.95rem',
                fontWeight: '600',
              }}>
                💡 Tip: Most pets stay within 1-2 miles of where they went missing. Adjust based on how long they've been gone.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setStep(2);
                  setCenter(null);
                }}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#f1f5f9',
                  color: theme.colors.gray[700],
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Contact Info */}
        {step === 4 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            maxWidth: '600px',
            margin: '0 auto',
            boxShadow: theme.shadows.lg,
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              marginBottom: '0.5rem',
              color: theme.colors.gray[900],
            }}>
              Your Contact Information
            </h2>
            <p style={{
              color: theme.colors.gray[600],
              marginBottom: '2rem',
              fontSize: '1.05rem',
            }}>
              So community members can reach you if they spot your pet
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Your Name
              </label>
              <input
                type="text"
                value={reportData.firstName}
                onChange={(e) => setReportData({ ...reportData, firstName: e.target.value })}
                placeholder="John"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Email
              </label>
              <input
                type="email"
                value={reportData.email}
                onChange={(e) => setReportData({ ...reportData, email: e.target.value })}
                placeholder="john@example.com"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={reportData.phone}
                onChange={(e) => setReportData({ ...reportData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#f1f5f9',
                  color: theme.colors.gray[700],
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={!reportData.firstName || !reportData.email || !reportData.phone}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: (reportData.firstName && reportData.email && reportData.phone) ? '#dc2626' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: (reportData.firstName && reportData.email && reportData.phone) ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Pet Details */}
        {step === 5 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            maxWidth: '700px',
            margin: '0 auto',
            boxShadow: theme.shadows.lg,
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              marginBottom: '0.5rem',
              color: theme.colors.gray[900],
            }}>
              Tell us about your pet
            </h2>
            <p style={{
              color: theme.colors.gray[600],
              marginBottom: '2rem',
              fontSize: '1.05rem',
            }}>
              Help people identify your pet
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Pet's Name
              </label>
              <input
                type="text"
                value={reportData.petName}
                onChange={(e) => setReportData({ ...reportData, petName: e.target.value })}
                placeholder="Max"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Breed
              </label>
              <input
                type="text"
                value={reportData.breed}
                onChange={(e) => setReportData({ ...reportData, breed: e.target.value })}
                placeholder="Golden Retriever, Tabby Cat, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Primary Color/Pattern
              </label>
              <input
                type="text"
                value={reportData.color}
                onChange={(e) => setReportData({ ...reportData, color: e.target.value })}
                placeholder="Brown, White and Black, Orange Tabby, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Size
              </label>
              <select
                value={reportData.size}
                onChange={(e) => setReportData({ ...reportData, size: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
              >
                {petType === 'bird' ? (
                  <>
                    <option value="TINY">Small (Parakeet, Finch)</option>
                    <option value="SMALL">Medium (Cockatiel, Conure)</option>
                    <option value="MEDIUM">Large (African Grey, Amazon)</option>
                    <option value="LARGE">Very Large (Macaw, Cockatoo)</option>
                  </>
                ) : petType === 'cat' ? (
                  <>
                    <option value="TINY">Small (&lt; 8 lbs)</option>
                    <option value="SMALL">Medium (8-12 lbs)</option>
                    <option value="MEDIUM">Large (12-18 lbs)</option>
                    <option value="LARGE">Very Large (&gt; 18 lbs)</option>
                  </>
                ) : (
                  <>
                    <option value="TINY">Tiny (&lt; 10 lbs)</option>
                    <option value="SMALL">Small (10-25 lbs)</option>
                    <option value="MEDIUM">Medium (25-60 lbs)</option>
                    <option value="LARGE">Large (60-90 lbs)</option>
                    <option value="GIANT">Giant (&gt; 90 lbs)</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Distinctive Marks or Features
              </label>
              <textarea
                value={reportData.distinctiveMarks}
                onChange={(e) => setReportData({ ...reportData, distinctiveMarks: e.target.value })}
                placeholder="Black spot on left ear, scar on right paw, collar color, very friendly, scared of strangers..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setStep(4)}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#f1f5f9',
                  color: theme.colors.gray[700],
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reportData.petName || !reportData.color || isSubmitting}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: (reportData.petName && reportData.color && !isSubmitting) ? '#10b981' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: (reportData.petName && reportData.color && !isSubmitting) ? 'pointer' : 'not-allowed',
                }}
              >
                {isSubmitting ? 'Creating Alert...' : '🚨 Create Community Alert'}
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Success */}
        {step === 6 && reportId && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            maxWidth: '600px',
            margin: '0 auto',
            boxShadow: theme.shadows.lg,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>✅</div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              marginBottom: '1rem',
              color: theme.colors.gray[900],
            }}>
              Alert Created!
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: theme.colors.gray[700],
              marginBottom: '2rem',
              lineHeight: '1.6',
            }}>
              Your community has been notified. {radiusMiles === 1 ? '1 patrol member' : `${radiusMiles * 10} patrol members`} within {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'} will receive alerts to help find {reportData.petName}.
            </p>

            <div style={{
              background: '#f0fdf4',
              border: '2px solid #10b981',
              borderRadius: theme.radius.lg,
              padding: '2rem',
              marginBottom: '2rem',
              textAlign: 'left',
            }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                marginBottom: '1rem',
                color: '#065f46',
              }}>
                What happens next:
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: '1.5rem',
                color: theme.colors.gray[700],
                lineHeight: '1.8',
              }}>
                <li>Community patrol members in your area will be notified</li>
                <li>They'll keep an eye out for {reportData.petName} during their daily activities</li>
                <li>You'll receive updates via email and phone when there are sightings</li>
                <li>Check your dashboard to see any reported sightings on the map</li>
              </ul>
            </div>

            <div style={{
              background: '#dbeafe',
              border: '2px solid #0ea5e9',
              borderRadius: theme.radius.lg,
              padding: '1.5rem',
              marginBottom: '2rem',
              textAlign: 'left',
            }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                marginBottom: '0.75rem',
                color: '#075985',
              }}>
                💡 Additional Tips:
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: '1.5rem',
                color: '#075985',
                lineHeight: '1.7',
                fontSize: '0.95rem',
              }}>
                <li>Leave food and water where they were last seen</li>
                <li>Put out an item with your scent (worn clothing)</li>
                <li>Contact local shelters and veterinary clinics</li>
                <li>Post on social media and neighborhood groups</li>
              </ul>
            </div>

            <Link
              href="/dashboard"
              style={{
                display: 'inline-block',
                padding: '1.25rem 2.5rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: theme.radius.lg,
                fontSize: '1.1rem',
                fontWeight: '700',
                textDecoration: 'none',
                boxShadow: theme.shadows.md,
              }}
            >
              Go to Dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
