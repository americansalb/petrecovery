'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCreateDivisionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);

  // Multi-step state
  const [step, setStep] = useState(1); // 1: ZIP, 2: Draw & Name
  const [zipCode, setZipCode] = useState('');
  const [rescueSquad, setRescueSquad] = useState(null);
  const [zipLocation, setZipLocation] = useState(null);

  const [divisionName, setDivisionName] = useState('');
  const [polygon, setPolygon] = useState(null);

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session]);

  const handleZipSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get ZIP code location
      const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      if (!geoRes.ok) throw new Error('Invalid ZIP code');

      const geoData = await geoRes.json();
      const lat = parseFloat(geoData.places[0].latitude);
      const lng = parseFloat(geoData.places[0].longitude);
      const city = geoData.places[0]['place name'];
      const state = geoData.places[0]['state abbreviation'];

      setZipLocation({ lat, lng, city, state });

      // Find rescue force for this ZIP
      const squadRes = await fetch(`/api/rescue-forces?zipCode=${zipCode}&radius=50`);
      const squadData = await squadRes.json();

      // Find the city that matches or is closest
      const citySquad = squadData.cities?.find(c => c.exists && c.city === city);

      if (!citySquad || !citySquad.squad) {
        throw new Error(`No rescue force found for ${city}, ${state}. Please create the rescue force first.`);
      }

      setRescueSquad(citySquad.squad);

      // Move to step 2 and load the map
      setStep(2);

      // Load map after a short delay to ensure DOM is ready
      setTimeout(() => {
        loadMap(lat, lng);
      }, 100);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMap = async (centerLat, centerLng) => {
    if (typeof window === 'undefined') return;
    if (mapInstanceRef.current) return; // Already loaded

    // Inject CSS manually for reliable loading
    if (!document.getElementById('leaflet-css')) {
      const leafletCSS = document.createElement('link');
      leafletCSS.id = 'leaflet-css';
      leafletCSS.rel = 'stylesheet';
      leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(leafletCSS);
    }

    if (!document.getElementById('leaflet-draw-css')) {
      const drawCSS = document.createElement('link');
      drawCSS.id = 'leaflet-draw-css';
      drawCSS.rel = 'stylesheet';
      drawCSS.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
      document.head.appendChild(drawCSS);
    }

    // Load Leaflet and Leaflet Draw
    const L = (await import('leaflet')).default;

    // Fix Leaflet icon paths for webpack
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    await import('leaflet-draw');

    // Wait a bit for CSS to load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize map centered on the ZIP location
    const map = L.map(mapRef.current).setView([centerLat, centerLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add a marker at the ZIP code center
    L.marker([centerLat, centerLng]).addTo(map)
      .bindPopup(`<b>${zipLocation.city}</b><br/>${zipCode}`)
      .openPopup();

    // Create feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Add drawing controls
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.3,
            weight: 3
          }
        },
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });
    map.addControl(drawControl);

    // Handle polygon creation
    map.on(L.Draw.Event.CREATED, function (event) {
      const layer = event.layer;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);
      const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
      setPolygon(coords);
    });

    // Handle polygon edit
    map.on(L.Draw.Event.EDITED, function (event) {
      const layers = event.layers;
      layers.eachLayer(function (layer) {
        const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
        setPolygon(coords);
      });
    });

    // Handle polygon delete
    map.on(L.Draw.Event.DELETED, function () {
      setPolygon(null);
    });

    mapInstanceRef.current = map;
    setMapLoaded(true);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleDivisionSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate required fields
      if (!divisionName.trim()) {
        throw new Error('Neighborhood name is required');
      }

      if (!polygon || polygon.length < 3) {
        throw new Error('Please draw a polygon boundary on the map');
      }

      // Auto-append " Division" if not already present
      let finalDivisionName = divisionName.trim();
      if (!finalDivisionName.toLowerCase().includes('division')) {
        finalDivisionName = finalDivisionName + ' Division';
      }

      // Calculate center point from polygon
      let sumLat = 0, sumLng = 0;
      polygon.forEach(coord => {
        sumLng += coord[0];
        sumLat += coord[1];
      });
      const centerLongitude = sumLng / polygon.length;
      const centerLatitude = sumLat / polygon.length;

      // Validate polygon is within reasonable distance of the rescue force's area
      const distanceFromZip = calculateDistance(
        zipLocation.lat,
        zipLocation.lng,
        centerLatitude,
        centerLongitude
      );

      if (distanceFromZip > 25) {
        throw new Error(
          `The division boundary is too far (${distanceFromZip.toFixed(1)} miles) from ${zipLocation.city}. ` +
          `Please draw a boundary within the ${rescueSquad.name} service area.`
        );
      }

      const payload = {
        rescueSquadId: rescueSquad.id,
        name: finalDivisionName,
        description: null,
        boundaries: polygon,
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

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/admin/divisions`);
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
        maxWidth: step === 1 ? '600px' : '1400px',
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
              {step === 1 ? 'Step 1: Enter ZIP code' : `Step 2: Draw ${zipLocation?.city} neighborhood boundary`}
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

        {/* Step 1: ZIP Code */}
        {step === 1 && (
          <form onSubmit={handleZipSubmit}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2.5rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '0.5rem'
                }}>
                  ZIP Code <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="Enter ZIP code (e.g., 60614)"
                  required
                  pattern="[0-9]{5}"
                  maxLength={5}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1.1rem'
                  }}
                />
                <p style={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                  marginTop: '0.5rem'
                }}>
                  This will determine which Rescue Force this division belongs to
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || zipCode.length !== 5}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: loading || zipCode.length !== 5 ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem',
                  cursor: loading || zipCode.length !== 5 ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Finding Rescue Force...' : 'Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Draw Map & Name Division */}
        {step === 2 && rescueSquad && (
          <form onSubmit={handleDivisionSubmit}>
            {/* Squad Info Banner */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1rem 1.5rem',
              marginBottom: '1.5rem',
              border: '2px solid #667eea',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Creating division for
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                  {rescueSquad.name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {zipLocation.city}, {zipLocation.state} • ZIP {zipCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setStep(1); setPolygon(null); }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                ← Change ZIP
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: '2rem',
              alignItems: 'start'
            }}>
              {/* Left Column - Division Name */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '0.5rem'
                  }}>
                    Neighborhood Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={divisionName}
                    onChange={(e) => setDivisionName(e.target.value)}
                    placeholder="e.g., Lakeview, Lincoln Park"
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
                    We'll automatically add "Division"
                  </p>
                </div>

                {/* Polygon Status */}
                <div style={{
                  padding: '1rem',
                  background: polygon ? '#d1fae5' : '#fef3c7',
                  border: `2px solid ${polygon ? '#10b981' : '#f59e0b'}`,
                  borderRadius: '8px',
                  marginBottom: '2rem'
                }}>
                  <div style={{
                    fontWeight: '600',
                    color: polygon ? '#065f46' : '#92400e',
                    marginBottom: '0.25rem'
                  }}>
                    {polygon ? '✓ Boundary Drawn' : '⚠ Draw Boundary'}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: polygon ? '#047857' : '#78350f'
                  }}>
                    {polygon
                      ? `${polygon.length} points defined`
                      : 'Click the polygon tool (◇) then click points on the map'
                    }
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !polygon}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: loading || !polygon ? '#cbd5e1' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '1rem',
                    cursor: loading || !polygon ? 'not-allowed' : 'pointer',
                    marginBottom: '1rem'
                  }}
                >
                  {loading ? 'Creating...' : 'Create Division'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setPolygon(null); }}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: 'white',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ← Start Over
                </button>
              </div>

              {/* Right Column - Map */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '1rem'
                }}>
                  Draw Neighborhood Boundary
                </h3>
                <div style={{
                  background: '#eff6ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                    📍 How to draw:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '1.5rem', color: '#1e40af', fontSize: '0.875rem', lineHeight: '1.6' }}>
                    <li>Click the <strong>polygon tool (◇)</strong> in the top-right corner</li>
                    <li>Click points on the map to outline the neighborhood</li>
                    <li>Click the <strong>first point</strong> again to close the shape</li>
                    <li>Use edit/delete tools to adjust if needed</li>
                  </ol>
                </div>
                <div
                  ref={mapRef}
                  style={{
                    height: '600px',
                    width: '100%',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0'
                  }}
                />
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
