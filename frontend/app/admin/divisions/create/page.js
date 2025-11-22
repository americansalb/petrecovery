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
  const [squads, setSquads] = useState([]);
  const [loadingSquads, setLoadingSquads] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);

  const [formData, setFormData] = useState({
    rescueSquadId: '',
    name: '',
  });

  const [polygon, setPolygon] = useState(null);

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      loadSquads();
      loadMap();
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

  const loadMap = async () => {
    if (typeof window === 'undefined') return;

    // Load Leaflet and Leaflet Draw
    const L = (await import('leaflet')).default;
    await import('leaflet-draw');
    await import('leaflet-draw/dist/leaflet.draw.css');

    // Initialize map
    const map = L.map(mapRef.current).setView([41.8781, -87.6298], 11); // Chicago center

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

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

      // Clear previous drawings
      drawnItems.clearLayers();

      // Add new polygon
      drawnItems.addLayer(layer);

      // Get coordinates
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
      if (!formData.rescueSquadId || !formData.name) {
        throw new Error('Rescue Squad and Neighborhood Name are required');
      }

      // Auto-append " Division" if not already present
      let divisionName = formData.name.trim();
      if (!divisionName.toLowerCase().includes('division')) {
        divisionName = divisionName + ' Division';
      }

      // Calculate center point from polygon
      let centerLatitude = null;
      let centerLongitude = null;
      let boundaries = null;

      if (polygon && polygon.length > 0) {
        let sumLat = 0, sumLng = 0;
        polygon.forEach(coord => {
          sumLng += coord[0];
          sumLat += coord[1];
        });
        centerLongitude = sumLng / polygon.length;
        centerLatitude = sumLat / polygon.length;
        boundaries = polygon;
      }

      const payload = {
        rescueSquadId: formData.rescueSquadId,
        name: divisionName,
        description: null,
        boundaries,
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
      });
      setPolygon(null);
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }

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
        maxWidth: '1400px',
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
              Draw the neighborhood boundary on the map
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
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: '2rem',
            alignItems: 'start'
          }}>
            {/* Left Column - Form Fields */}
            <div style={{
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
                      {squad.name}
                    </option>
                  ))}
                </select>
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
                  Neighborhood Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
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
                  {polygon ? '✓ Polygon Drawn' : '⚠ No Polygon Yet'}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: polygon ? '#047857' : '#78350f'
                }}>
                  {polygon
                    ? `${polygon.length} points • Center auto-calculated`
                    : 'Use the drawing tools on the map to draw the neighborhood boundary'
                  }
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                flexDirection: 'column'
              }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '1rem',
                    background: loading ? '#cbd5e1' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '1rem',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Creating...' : 'Create Division'}
                </button>
                <Link
                  href="/admin/divisions"
                  style={{
                    padding: '1rem',
                    background: 'white',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '700',
                    textAlign: 'center'
                  }}
                >
                  Cancel
                </Link>
              </div>
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
              <p style={{
                fontSize: '0.875rem',
                color: '#64748b',
                marginBottom: '1rem'
              }}>
                Click the polygon icon (◇) in the top right, then click on the map to draw the boundary.
                Click the first point again to close the polygon.
              </p>
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
      </div>
    </div>
  );
}
