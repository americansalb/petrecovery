'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { theme } from '../../lib/theme';

export default function JoinPatrol() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [zipCode, setZipCode] = useState('');
  const [center, setCenter] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [notifications, setNotifications] = useState({
    text: true,
    email: true,
    push: true,
  });
  const [agreedToWaiver, setAgreedToWaiver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Check if user is already a patrol member
  useEffect(() => {
    async function checkPatrolStatus() {
      if (status === 'authenticated' && session?.user) {
        try {
          const res = await fetch('/api/profile');
          if (res.ok) {
            const data = await res.json();
            if (data.patrolProfile) {
              setAlreadyMember(true);
            }
          }
        } catch (err) {
          console.error('Error checking patrol status:', err);
        }
      }
      setCheckingStatus(false);
    }

    if (status !== 'loading') {
      checkPatrolStatus();
    }
  }, [status, session]);

  // Initialize map only once when we first reach step 3 with a center
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || !center || step !== 3) {
      // Clean up map if we're leaving step 3
      if (step !== 3 && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
      return;
    }

    // Don't recreate if map already exists
    if (mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      // Create map
      const map = L.map(mapRef.current).setView(center, 12);
      mapInstanceRef.current = map;

      // Add tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Create draggable marker
      const marker = L.marker(center, { draggable: true }).addTo(map);
      markerRef.current = marker;

      // Create radius circle
      const circle = L.circle(center, {
        color: '#0ea5e9',
        fillColor: '#0ea5e9',
        fillOpacity: 0.2,
        radius: radiusMiles * 1609.34, // Convert miles to meters
      }).addTo(map);
      circleRef.current = circle;

      // Handle marker drag
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

  // Update marker and circle position when center changes
  useEffect(() => {
    if (markerRef.current && circleRef.current && center) {
      markerRef.current.setLatLng(center);
      circleRef.current.setLatLng(center);
    }
  }, [center]);

  // Update circle radius when slider changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radiusMiles * 1609.34);
    }
  }, [radiusMiles]);

  const geocodeZipCode = async () => {
    setError(null);

    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&limit=1`,
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
        setError('Could not find that zip code. Please try again.');
      }
    } catch (err) {
      setError('Error finding zip code. Please try again.');
      console.error('Geocoding error:', err);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/patrol/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zipCode,
          centerLat: center[0],
          centerLng: center[1],
          radiusMiles,
          notifications,
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

  if (checkingStatus) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #0ea5e9',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite',
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: theme.colors.gray[600] }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      }}>
        <div style={{
          maxWidth: '600px',
          backgroundColor: 'white',
          borderRadius: theme.radius.xl,
          padding: '3rem 2rem',
          textAlign: 'center',
          boxShadow: theme.shadows.lg,
        }}>
          <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🦸</div>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: theme.colors.gray[900],
          }}>
            You're Already a Patrol Member!
          </h1>
          <p style={{
            fontSize: '1.2rem',
            color: theme.colors.gray[600],
            marginBottom: '2rem',
          }}>
            You're already part of the community helping reunite lost pets with their families.
          </p>
          <div style={{
            background: '#dbeafe',
            border: '2px solid #0ea5e9',
            borderRadius: theme.radius.lg,
            padding: '1.5rem',
            marginBottom: '2rem',
          }}>
            <p style={{
              margin: 0,
              color: '#075985',
              fontSize: '1rem',
              fontWeight: '600',
            }}>
              💡 Manage your patrol settings or view the full pet database from your dashboard
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard"
              style={{
                padding: '1rem 2rem',
                background: '#0ea5e9',
                color: 'white',
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                fontWeight: '700',
                boxShadow: theme.shadows.sm,
              }}
            >
              Go to Dashboard
            </Link>
            <Link
              href="/database"
              style={{
                padding: '1rem 2rem',
                background: '#10b981',
                color: 'white',
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                fontWeight: '700',
                boxShadow: theme.shadows.sm,
              }}
            >
              View Database
            </Link>
            <Link
              href="/profile"
              style={{
                padding: '1rem 2rem',
                background: '#f1f5f9',
                color: theme.colors.gray[700],
                borderRadius: theme.radius.lg,
                textDecoration: 'none',
                fontWeight: '700',
              }}
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: theme.gradients.hope,
      }}>
        <div style={{
          maxWidth: '600px',
          backgroundColor: 'white',
          borderRadius: theme.radius.xl,
          padding: '3rem 2rem',
          textAlign: 'center',
          boxShadow: theme.shadows.lg,
        }}>
          <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🎉</div>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: theme.colors.gray[900]
          }}>
            Welcome to Pet Patrol!
          </h1>
          <p style={{
            marginBottom: '1rem',
            color: theme.colors.gray[700],
            lineHeight: '1.6',
            fontSize: '1.1rem',
          }}>
            You're now part of a community of heroes helping reunite lost pets with their families.
          </p>
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #10b981',
            borderRadius: theme.radius.lg,
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'left',
          }}>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '700',
              marginBottom: '0.75rem',
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
              <li>You'll receive alerts when pets go missing in your {radiusMiles}-mile patrol zone</li>
              <li>Watch for lost pets during your daily routine</li>
              <li>If you spot a lost pet, report the sighting to help reunite families</li>
            </ul>
          </div>
          <Link href="/dashboard" style={{
            display: 'inline-block',
            background: theme.gradients.ocean,
            color: 'white',
            padding: '1.25rem 2.5rem',
            borderRadius: theme.radius.lg,
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '1.1rem',
            boxShadow: theme.shadows.md,
          }}>
            Go to Dashboard →
          </Link>
        </div>
      </div>
    );
  }

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
                  backgroundColor: step >= s ? '#0ea5e9' : '#e5e7eb',
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

        {/* Step 1: Hero / Intro */}
        {step === 1 && (
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto', position: 'relative' }}>
            {/* 100% FREE Badge */}
            <div style={{
              position: 'absolute',
              top: '-1rem',
              right: '0',
              padding: '0.5rem 1rem',
              background: '#10b981',
              color: 'white',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: '800',
              letterSpacing: '0.5px',
            }}>
              100% FREE
            </div>

            <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🦸</div>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: '900',
              marginBottom: '1rem',
              color: theme.colors.gray[900],
              lineHeight: '1.1',
            }}>
              Become a Patrol Hero
            </h1>
            <p style={{
              fontSize: '1.3rem',
              color: theme.colors.gray[600],
              marginBottom: '2.5rem',
              lineHeight: '1.6',
            }}>
              Help reunite lost pets with their families in your neighborhood
            </p>

            <div style={{
              background: 'white',
              borderRadius: theme.radius.xl,
              padding: '2.5rem',
              marginBottom: '2rem',
              textAlign: 'left',
              boxShadow: theme.shadows.md,
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                marginBottom: '1.5rem',
                color: theme.colors.gray[900],
              }}>
                How It Works:
              </h2>
              <div style={{ marginBottom: '1.5rem' }}>
                {[
                  { emoji: '📍', title: 'Set Your Patrol Zone', desc: 'Choose your area with a customizable radius on the map' },
                  { emoji: '🔔', title: 'Receive Instant Alerts', desc: 'Get notified when pets go missing in your zone' },
                  { emoji: '👀', title: 'Keep an Eye Out', desc: 'Watch during your daily walks, commutes, and errands' },
                  { emoji: '❤️', title: 'Help Reunite Families', desc: 'Report sightings to bring lost pets home' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    alignItems: 'flex-start',
                  }}>
                    <div style={{
                      fontSize: '2rem',
                      flexShrink: 0,
                    }}>
                      {item.emoji}
                    </div>
                    <div>
                      <div style={{
                        fontWeight: '700',
                        fontSize: '1.1rem',
                        marginBottom: '0.25rem',
                        color: theme.colors.gray[900],
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        color: theme.colors.gray[600],
                        lineHeight: '1.5',
                      }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              style={{
                padding: '1.5rem 3rem',
                background: theme.gradients.ocean,
                color: 'white',
                border: 'none',
                borderRadius: theme.radius.lg,
                fontSize: '1.25rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: theme.shadows.md,
              }}
            >
              Get Started →
            </button>

            <p style={{
              marginTop: '1.5rem',
              color: theme.colors.gray[500],
              fontSize: '0.95rem',
            }}>
              Takes less than 2 minutes • 100% FREE
            </p>
          </div>
        )}

        {/* Step 2: Zip Code */}
        {step === 2 && (
          <div style={{
            background: 'white',
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
              Where's Your Patrol Zone?
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              Enter your zip code to set the center of your patrol area
            </p>

            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: theme.colors.gray[700],
            }}>
              Zip Code
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="60601"
              maxLength={5}
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e5e7eb',
                borderRadius: theme.radius.lg,
                fontSize: '1.25rem',
                marginBottom: '2rem',
                fontWeight: '600',
                textAlign: 'center',
                letterSpacing: '0.1em',
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  geocodeZipCode();
                }
              }}
            />

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
                onClick={geocodeZipCode}
                disabled={zipCode.length !== 5}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: zipCode.length === 5 ? theme.gradients.ocean : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: zipCode.length === 5 ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Map with Draggable Center & Radius */}
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
              Customize Your Patrol Zone
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              Drag the marker to adjust your patrol zone center, and use the slider to change the radius
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
              background: '#f8fafc',
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
                Patrol Radius: <span style={{ color: '#0ea5e9' }}>{radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}</span>
              </label>
              <input
                type="range"
                min="0.25"
                max="25"
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
                <span>25 miles</span>
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
                💡 Tip: You can drag the blue marker anywhere on the map to change your patrol zone center
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
                  background: theme.gradients.ocean,
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

        {/* Step 4: Notifications */}
        {step === 4 && (
          <div style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            maxWidth: '700px',
            margin: '0 auto',
            boxShadow: theme.shadows.lg,
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              marginBottom: '1rem',
              color: theme.colors.gray[900],
            }}>
              How Should We Alert You?
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              Choose how you want to receive alerts for lost pets in your patrol zone
            </p>

            <div style={{ marginBottom: '2rem' }}>
              {[
                { key: 'text', emoji: '💬', label: 'Text Messages (SMS)', desc: 'Get instant SMS alerts on your phone' },
                { key: 'email', emoji: '📧', label: 'Email', desc: 'Receive detailed alerts in your inbox' },
                { key: 'push', emoji: '🔔', label: 'Push Notifications', desc: 'Get browser/app notifications' },
              ].map((option) => (
                <label
                  key={option.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '1.5rem',
                    marginBottom: '1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: theme.radius.lg,
                    cursor: 'pointer',
                    backgroundColor: notifications[option.key] ? '#eff6ff' : 'white',
                    borderColor: notifications[option.key] ? '#0ea5e9' : '#e5e7eb',
                    gap: '1rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={notifications[option.key]}
                    onChange={(e) => setNotifications({
                      ...notifications,
                      [option.key]: e.target.checked
                    })}
                    style={{
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ fontSize: '2rem', flexShrink: 0 }}>
                    {option.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '700',
                      fontSize: '1.1rem',
                      marginBottom: '0.25rem',
                      color: theme.colors.gray[900],
                    }}>
                      {option.label}
                    </div>
                    <div style={{
                      fontSize: '0.95rem',
                      color: theme.colors.gray[600]
                    }}>
                      {option.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{
              background: '#f0fdf4',
              border: '2px solid #10b981',
              borderRadius: theme.radius.lg,
              padding: '1rem',
              marginBottom: '2rem',
            }}>
              <p style={{
                margin: 0,
                color: '#065f46',
                fontSize: '0.95rem',
                fontWeight: '600',
              }}>
                ✓ All notification methods are enabled by default for the fastest alerts
              </p>
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
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: theme.gradients.ocean,
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

        {/* Step 5: Liability Waiver */}
        {step === 5 && (
          <div style={{
            background: 'white',
            borderRadius: theme.radius.xl,
            padding: '3rem 2rem',
            maxWidth: '800px',
            margin: '0 auto',
            boxShadow: theme.shadows.lg,
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              marginBottom: '1rem',
              color: theme.colors.gray[900],
            }}>
              Safety Guidelines & Agreement
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: theme.colors.gray[600],
              marginBottom: '2rem',
            }}>
              Please review and agree to these important safety guidelines
            </p>

            <div style={{
              background: '#fef3c7',
              border: '2px solid #fbbf24',
              borderRadius: theme.radius.lg,
              padding: '1.5rem',
              marginBottom: '2rem',
            }}>
              <h3 style={{
                fontSize: '1.3rem',
                fontWeight: '800',
                marginBottom: '1rem',
                color: '#92400e',
              }}>
                ⚠️ Safety First
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: '1.5rem',
                color: '#78350f',
                lineHeight: '1.8',
                fontWeight: '500',
              }}>
                <li><strong>Do not approach</strong> animals that may attack humans or harbor disease</li>
                <li><strong>Contact animal control or owners</strong> when appropriate—never take direct action with aggressive animals</li>
                <li><strong>Never enter private property</strong> without permission</li>
                <li><strong>Report sightings only</strong>—you are not expected to capture or chase animals</li>
                <li><strong>Your safety comes first</strong>—if you feel unsafe, do not engage</li>
              </ul>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '2px solid #cbd5e1',
              borderRadius: theme.radius.lg,
              padding: '1.5rem',
              marginBottom: '2rem',
              maxHeight: '300px',
              overflowY: 'auto',
            }}>
              <h4 style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                marginBottom: '1rem',
                color: theme.colors.gray[900],
              }}>
                Liability Waiver
              </h4>
              <p style={{
                fontSize: '0.9rem',
                color: theme.colors.gray[700],
                lineHeight: '1.7',
                margin: 0,
              }}>
                By joining the PetRecovery Patrol, you acknowledge and agree that:
                <br/><br/>
                <strong>1. Voluntary Participation:</strong> Your participation in the PetRecovery Patrol program is entirely voluntary. You are not required to take any action beyond reporting sightings of lost pets.
                <br/><br/>
                <strong>2. No Guarantee of Safety:</strong> PetRecovery.org makes no guarantees regarding your safety while participating in patrol activities. You assume all risks associated with looking for, observing, or reporting lost pets.
                <br/><br/>
                <strong>3. Release of Liability:</strong> You release, waive, discharge, and covenant not to sue PetRecovery.org, its officers, employees, and agents from any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to any loss, damage, or injury that may be sustained by you while participating in the patrol program.
                <br/><br/>
                <strong>4. Assumption of Risk:</strong> You acknowledge that participation in the patrol program involves inherent risks including, but not limited to, animal bites, scratches, disease transmission, property disputes, and traffic hazards. You expressly assume all such risks.
                <br/><br/>
                <strong>5. Compliance with Laws:</strong> You agree to comply with all local, state, and federal laws while participating in the patrol program, including trespassing and animal control laws.
                <br/><br/>
                <strong>6. Indemnification:</strong> You agree to indemnify and hold harmless PetRecovery.org from any claims, damages, or expenses arising from your participation in the patrol program.
              </p>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '1.5rem',
                border: '2px solid #e5e7eb',
                borderRadius: theme.radius.lg,
                marginBottom: '2rem',
                cursor: 'pointer',
                backgroundColor: agreedToWaiver ? '#eff6ff' : 'white',
                borderColor: agreedToWaiver ? '#0ea5e9' : '#e5e7eb',
                gap: '1rem',
              }}
            >
              <input
                type="checkbox"
                checked={agreedToWaiver}
                onChange={(e) => setAgreedToWaiver(e.target.checked)}
                style={{
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginTop: '0.25rem',
                }}
              />
              <div style={{
                fontSize: '1rem',
                color: theme.colors.gray[800],
                lineHeight: '1.6',
                fontWeight: '600',
              }}>
                I have read and agree to the safety guidelines and liability waiver. I understand that I will not approach animals that may attack humans or harbor disease, and I will notify animal control or owners when appropriate.
              </div>
            </label>

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
                disabled={!agreedToWaiver || isSubmitting}
                style={{
                  flex: 2,
                  padding: '1rem',
                  background: agreedToWaiver && !isSubmitting ? theme.gradients.forest : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.radius.lg,
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: agreedToWaiver && !isSubmitting ? 'pointer' : 'not-allowed',
                }}
              >
                {isSubmitting ? 'Joining Patrol...' : 'Join Patrol 🎉'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
