'use client';

/**
 * Sighting Form Component - Phase 1.2
 *
 * Allows participants to report pet sightings.
 * Includes map pin placement and confidence level.
 *
 * Features:
 * - Map for sighting location selection
 * - Confidence level selector (1-10)
 * - Notes field for additional details
 * - Display existing sightings on map
 */

import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';

export default function SightingForm({
  assignmentId,
  isParticipant,
  missionData,
  currentUserId,
}) {
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReporting, setIsReporting] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [confidenceLevel, setConfidenceLevel] = useState(5);
  const [spottedAt, setSpottedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const sightingsLayerRef = useRef(null);

  // Fetch sightings
  const fetchSightings = useCallback(async () => {
    if (!assignmentId) return;

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/sightings`);

      if (!res.ok) {
        throw new Error('Failed to fetch sightings');
      }

      const data = await res.json();
      setSightings(data.sightings || []);
      setError(null);
    } catch (err) {
      console.error('[SIGHTING] Error fetching sightings:', err);
      setError('Failed to load sightings');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    import('leaflet').then((L) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Default center
      const center = missionData?.lastSeenLatitude && missionData?.lastSeenLongitude
        ? [missionData.lastSeenLatitude, missionData.lastSeenLongitude]
        : [41.8781, -87.6298];

      // Create map
      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView(center, 14);

      // Add tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Add last seen marker
      if (missionData?.lastSeenLatitude && missionData?.lastSeenLongitude) {
        const lastSeenIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background: #dc2626;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          ">🐕</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        L.marker(center, { icon: lastSeenIcon })
          .addTo(map)
          .bindPopup('<b>Last Seen Location</b>');
      }

      // Create layer for sightings
      sightingsLayerRef.current = L.layerGroup().addTo(map);

      // Handle map clicks for new sighting
      map.on('click', (e) => {
        if (isReporting) {
          const location = [e.latlng.lat, e.latlng.lng];
          setSelectedLocation(location);

          // Update or create marker
          if (markerRef.current) {
            markerRef.current.setLatLng(e.latlng);
          } else {
            const sightingIcon = L.divIcon({
              className: 'custom-marker',
              html: `<div style="
                background: #10b981;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                animation: pulse 1s ease-in-out infinite;
              ">👁️</div>`,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            });

            markerRef.current = L.marker(e.latlng, { icon: sightingIcon })
              .addTo(map)
              .bindPopup('Your sighting location');
          }
        }
      });

      mapInstanceRef.current = map;
      fetchSightings();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [missionData, fetchSightings, isReporting]);

  // Render sightings on map
  useEffect(() => {
    if (!sightingsLayerRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      sightingsLayerRef.current.clearLayers();

      sightings.forEach((sighting) => {
        const confidenceColor = sighting.confidenceLevel >= 7 ? '#22c55e'
          : sighting.confidenceLevel >= 4 ? '#f59e0b'
          : '#ef4444';

        const sightingIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background: ${confidenceColor};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            font-weight: bold;
          ">${sighting.confidenceLevel}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon });

        const popupContent = `
          <div style="min-width: 150px;">
            <b>${sighting.reportedBy?.firstName || 'Unknown'}</b>
            <br/>
            <span style="color: #64748b;">Confidence: ${sighting.confidenceLevel}/10</span>
            <br/>
            <span style="color: #64748b;">${new Date(sighting.spottedAt).toLocaleString()}</span>
            ${sighting.notes ? `<br/><em>"${sighting.notes}"</em>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(sightingsLayerRef.current);
      });
    });
  }, [sightings]);

  // Start reporting mode
  const startReporting = () => {
    setIsReporting(true);
    setSelectedLocation(null);
    setConfidenceLevel(5);
    setNotes('');
    setImages([]);

    // Set default time to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setSpottedAt(now.toISOString().slice(0, 16));
  };

  // Cancel reporting
  const cancelReporting = () => {
    setIsReporting(false);
    setSelectedLocation(null);

    // Remove marker
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  };

  // Submit sighting
  const submitSighting = async () => {
    if (!selectedLocation) {
      setValidationError('Please click on the map to mark the sighting location');
      return;
    }

    if (!spottedAt) {
      setValidationError('Please enter when you spotted the pet');
      return;
    }
    setValidationError(null);

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: selectedLocation[0],
          longitude: selectedLocation[1],
          spottedAt: new Date(spottedAt).toISOString(),
          confidenceLevel,
          notes: notes.trim() || null,
          photoUrls: images.map(img => img.url),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit sighting');
      }

      // Reset state
      cancelReporting();

      // Refresh sightings
      fetchSightings();
    } catch (err) {
      console.error('[SIGHTING] Error submitting sighting:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Get confidence label
  const getConfidenceLabel = (level) => {
    if (level >= 9) return '🎯 Very confident - Definitely the pet';
    if (level >= 7) return '✅ Confident - Looks very similar';
    if (level >= 5) return '🤔 Moderate - Could be the pet';
    if (level >= 3) return '❓ Low - Might be the pet';
    return '⚠️ Uncertain - Just a glimpse';
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
      }}>
        <LoadingSpinner text="Loading sightings..." />
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '1rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#0f172a',
          }}>
            👁️ Pet Sightings
          </h2>
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.8rem',
            color: '#64748b',
          }}>
            {sightings.length} reported sightings
          </p>
        </div>

        {isParticipant && (
          <div>
            {!isReporting ? (
              <button
                onClick={startReporting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                📍 Report Sighting
              </button>
            ) : (
              <button
                onClick={cancelReporting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                ✕ Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reporting instructions */}
      {isReporting && (
        <div style={{
          padding: '1rem 1.5rem',
          background: '#eff6ff',
          borderBottom: '1px solid #2563eb',
        }}>
          <p style={{
            margin: 0,
            color: '#1e40af',
            fontSize: '0.9rem',
          }}>
            <strong>Reporting Mode:</strong> Click on the map to mark where you spotted the pet.
          </p>
          {selectedLocation && (
            <p style={{
              margin: '0.25rem 0 0 0',
              color: '#2563eb',
              fontSize: '0.8rem',
            }}>
              ✓ Location selected. Complete the form below.
            </p>
          )}
        </div>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        style={{
          height: '350px',
          width: '100%',
          cursor: isReporting ? 'crosshair' : 'grab',
        }}
      />

      {/* Reporting form */}
      {isReporting && selectedLocation && (
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#0f172a',
          }}>
            Report Details
          </h3>

          {/* When spotted */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              When did you see the pet? *
            </label>
            <input
              type="datetime-local"
              value={spottedAt}
              onChange={(e) => setSpottedAt(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Confidence level */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              How confident are you? ({confidenceLevel}/10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(parseInt(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
              }}
            />
            <p style={{
              margin: '0.5rem 0 0 0',
              fontSize: '0.85rem',
              color: '#64748b',
            }}>
              {getConfidenceLabel(confidenceLevel)}
            </p>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Additional notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what you saw, direction the pet was heading, etc..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Photo Upload */}
          <div style={{ marginBottom: '1rem' }}>
            <ImageUpload
              images={images}
              onUpload={(newImages) => setImages(prev => [...prev, ...newImages])}
              onRemove={(index) => setImages(prev => prev.filter((_, i) => i !== index))}
              maxImages={3}
              context="sighting"
              label="Photos (optional but helpful)"
              helpText="Add photos of the pet you spotted"
            />
          </div>

          {validationError && (
            <div style={{
              padding: '0.75rem',
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '0.5rem',
              color: '#92400e',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              ⚠️ {validationError}
            </div>
          )}

          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              color: '#dc2626',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={submitSighting}
            disabled={submitting || !spottedAt}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: submitting || !spottedAt ? '#94a3b8' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: submitting || !spottedAt ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Sighting Report'}
          </button>
        </div>
      )}

      {/* Sightings list */}
      {sightings.length > 0 && !isReporting && (
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #e2e8f0',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#0f172a',
          }}>
            Sighting Timeline
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sightings.map((sighting) => {
              const confidenceColor = sighting.confidenceLevel >= 7 ? '#22c55e'
                : sighting.confidenceLevel >= 4 ? '#f59e0b'
                : '#ef4444';

              return (
                <div
                  key={sighting.id}
                  style={{
                    padding: '1rem',
                    background: sighting.reportedById === currentUserId ? '#eff6ff' : 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    borderLeft: `4px solid ${confidenceColor}`,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem',
                  }}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>
                        {sighting.reportedBy?.firstName || 'Unknown'} {sighting.reportedBy?.lastName?.[0] || ''}.
                        {sighting.reportedById === currentUserId && (
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: '#2563eb',
                            color: 'white',
                            borderRadius: '0.25rem',
                            fontSize: '0.7rem',
                          }}>
                            You
                          </span>
                        )}
                      </strong>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.8rem',
                        color: '#64748b',
                      }}>
                        {new Date(sighting.spottedAt).toLocaleString()}
                      </p>
                    </div>
                    <div style={{
                      padding: '0.25rem 0.75rem',
                      background: confidenceColor,
                      color: 'white',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      {sighting.confidenceLevel}/10
                    </div>
                  </div>
                  {sighting.notes && (
                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      color: '#374151',
                      fontStyle: 'italic',
                    }}>
                      "{sighting.notes}"
                    </p>
                  )}
                  {sighting.address && (
                    <p style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.8rem',
                      color: '#64748b',
                    }}>
                      📍 {sighting.address}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sightings.length === 0 && !isReporting && (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#64748b',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👁️</div>
          <p>No sightings reported yet.</p>
          {isParticipant && (
            <p style={{ fontSize: '0.875rem' }}>
              Click "Report Sighting" if you see the pet!
            </p>
          )}
        </div>
      )}

      {/* CSS for pulse animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
