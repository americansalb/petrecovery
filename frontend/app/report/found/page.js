'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { theme } from '../../lib/theme';

export default function ReportFoundPet() {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [petType, setPetType] = useState('');

  // Location and map data
  const [foundAddress, setFoundAddress] = useState('');
  const [center, setCenter] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(2); // Default 2 miles to search for matches
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
  const [photos, setPhotos] = useState([]);

  // Auto-fill user data from session
  useEffect(() => {
    if (session?.user) {
      setReportData(prev => ({
        ...prev,
        email: session.user.email || '',
        firstName: session.user.name || '',
      }));
    }
  }, [session]);

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

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const maxPhotos = 5;

    if (photos.length + files.length > maxPhotos) {
      setError(`You can only upload up to ${maxPhotos} photos`);
      return;
    }

    // Convert files to data URLs (base64)
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Each photo must be under 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });

    setError(null);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const geocodeAddress = async () => {
    if (!foundAddress || foundAddress.length < 3) {
      setError('Please enter a valid address or zip code');
      return;
    }

    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(foundAddress)}&format=json&limit=1&countrycodes=us`,
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
      // Call found-pet API endpoint
      const response = await fetch('/api/reports/found-pet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: reportData.email,
          phone: reportData.phone,
          firstName: reportData.firstName,
          petName: reportData.petName,
          breed: reportData.breed,
          color: reportData.color,
          size: reportData.size,
          distinctiveMarks: reportData.distinctiveMarks,
          foundAddress,
          center,
          radiusMiles,
          timeElapsed,
          petType,
          photos: photos, // Base64 encoded photos
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create report');
      }

      setReportId(data.reportId);
      setStep(6); // Success step
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
          {session?.user && (
            <div style={{
              padding: '0.5rem 1rem',
              background: '#f0fdf4',
              border: '2px solid #10b981',
              borderRadius: theme.radius.lg,
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#065f46',
            }}>
              ✓ Logged in as {session.user.email}
            </div>
          )}
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
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: '900',
              marginBottom: '1rem',
              color: '#10b981',
              lineHeight: '1.1',
            }}>
              Report Found Pet
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: theme.colors.gray[600],
              marginBottom: '3rem',
            }}>
              Help reunite a lost pet with their family
            </p>

            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1.5rem',
              color: theme.colors.gray[900],
            }}>
              What type of pet did you find?
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

        {/* Step 2: Found Location & Time */}
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
              Where did you find the pet?
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              Enter the address or zip code where you found the pet
            </p>

            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: theme.colors.gray[700],
            }}>
              Found At Address or Zip Code
            </label>
            <input
              type="text"
              value={foundAddress}
              onChange={(e) => setFoundAddress(e.target.value)}
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
                if (e.key === 'Enter' && foundAddress && timeElapsed) {
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
              When did you find them?
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
                disabled={!foundAddress || !timeElapsed}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: foundAddress && timeElapsed ? '#10b981' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: foundAddress && timeElapsed ? 'pointer' : 'not-allowed',
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
              Set Match Radius
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              We'll search for lost pet reports within this distance from where you found the pet. Most pets are found within 2-3 miles of where they went missing.
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
                Match Radius: <span style={{ color: '#dc2626' }}>{radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}</span>
              </label>
              <input
                type="range"
                min="0.25"
                max="10"
                step="0.25"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(parseFloat(e.target.value))}
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
                <span>0.25 miles</span>
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
              marginBottom: '1rem',
              fontSize: '1.05rem',
            }}>
              So the pet owner can contact you if this is their pet
            </p>
            {session?.user && (
              <div style={{
                background: '#dbeafe',
                border: '2px solid #0ea5e9',
                borderRadius: theme.radius.lg,
                padding: '1rem',
                marginBottom: '2rem',
                fontSize: '0.9rem',
                color: '#075985',
              }}>
                <strong>✓ We've pre-filled your info from your account.</strong> Verify your phone number so pet owners can reach you.
              </div>
            )}

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
              Describe the pet you found
            </h2>
            <p style={{
              color: theme.colors.gray[600],
              marginBottom: '2rem',
              fontSize: '1.05rem',
            }}>
              Help us match this pet with their owner
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Name (if visible on collar/tag)
              </label>
              <input
                type="text"
                value={reportData.petName}
                onChange={(e) => setReportData({ ...reportData, petName: e.target.value })}
                placeholder="Unknown (leave blank if no tag)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
              />
              <p style={{ fontSize: '0.85rem', color: theme.colors.gray[500], marginTop: '0.5rem' }}>
                Optional - only if you can see the name on a collar or tag
              </p>
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
                Photos of the Pet You Found
              </label>
              <p style={{ fontSize: '0.9rem', color: theme.colors.gray[600], marginBottom: '0.5rem' }}>
                Upload up to 5 clear photos to help identify the pet (max 5MB each)
              </p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                }}
              />
              {photos.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '1rem',
                  flexWrap: 'wrap',
                }}>
                  {photos.map((photo, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <img
                        src={photo}
                        alt={`Pet photo ${index + 1}`}
                        style={{
                          width: '100px',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: theme.radius.md,
                          border: '2px solid #e5e7eb',
                        }}
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '14px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                Distinctive Marks, Features, or Collar Information
              </label>
              <textarea
                value={reportData.distinctiveMarks}
                onChange={(e) => setReportData({ ...reportData, distinctiveMarks: e.target.value })}
                placeholder="Collar color and type, tags (if any), unique markings, scars, behavior when approached, microchip visible? Very friendly/scared/aggressive?"
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: theme.radius.lg,
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                }}
              />
              <p style={{ fontSize: '0.85rem', color: theme.colors.gray[500], marginTop: '0.5rem' }}>
                Include any collar details, tags, behavior, and identifying features
              </p>
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
                disabled={!reportData.color || isSubmitting}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: (reportData.color && !isSubmitting) ? '#10b981' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: (reportData.color && !isSubmitting) ? 'pointer' : 'not-allowed',
                }}
              >
                {isSubmitting ? 'Creating Alert...' : '🎉 Report Found Pet'}
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
              Thank you for helping! We've notified nearby pet owners who reported a lost pet matching this description.
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
                <li>Pet owners in your area who reported lost pets will be notified</li>
                <li>If a match is found, the owner will contact you directly</li>
                <li>Check your email and phone for messages from potential owners</li>
                <li>Keep the pet safe until the owner contacts you</li>
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
                💡 While You Wait:
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: '1.5rem',
                color: '#075985',
                lineHeight: '1.7',
                fontSize: '0.95rem',
              }}>
                <li>Provide food, water, and a safe place for the pet</li>
                <li>Check for a microchip at a local vet or animal shelter (free service)</li>
                <li>Take additional photos if possible</li>
                <li>Post on local community groups and social media</li>
                <li>If no owner is found, contact local animal shelters about next steps</li>
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
