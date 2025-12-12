'use client';

/**
 * Search Area Map Component - Phase 1.2
 *
 * Interactive map for marking and viewing search areas.
 * Uses Leaflet for mapping with polygon drawing.
 *
 * Features:
 * - Display existing search areas with colors
 * - Draw new search areas (polygons)
 * - Show who searched which area
 * - Calculate and display total acreage
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '@/app/components/LoadingSpinner';

export default function SearchAreaMap({
  assignmentId,
  isParticipant,
  missionData,
  currentUserId,
}) {
  const [searchAreas, setSearchAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [notes, setNotes] = useState('');
  const [potentialSpotting, setPotentialSpotting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawingLayerRef = useRef(null);
  const areasLayerRef = useRef(null);

  console.log('[SEARCH-MAP] Component rendering');
  console.log(`[SEARCH-MAP] Assignment ID: ${assignmentId}`);
  console.log(`[SEARCH-MAP] Is participant: ${isParticipant}`);

  // Calculate polygon area in acres
  const calculateAcreage = useCallback((points) => {
    if (points.length < 3) return 0;

    // Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i][0] * points[j][1];
      area -= points[j][0] * points[i][1];
    }
    area = Math.abs(area) / 2;

    // Convert from degrees squared to square meters (approximate)
    // At typical US latitudes, 1 degree ≈ 111,000 meters
    const latMid = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const metersPerDegreeLat = 111000;
    const metersPerDegreeLng = 111000 * Math.cos(latMid * Math.PI / 180);

    const areaSquareMeters = area * metersPerDegreeLat * metersPerDegreeLng;
    const areaAcres = areaSquareMeters * 0.000247105; // Convert to acres

    return Math.round(areaAcres * 100) / 100;
  }, []);

  // Fetch search areas
  const fetchSearchAreas = useCallback(async () => {
    if (!assignmentId) return;

    console.log('[SEARCH-MAP] Fetching search areas...');
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/search-areas`);

      if (!res.ok) {
        throw new Error('Failed to fetch search areas');
      }

      const data = await res.json();
      console.log(`[SEARCH-MAP] Fetched ${data.searchAreas?.length || 0} search areas`);

      setSearchAreas(data.searchAreas || []);
      setError(null);
    } catch (err) {
      console.error('[SEARCH-MAP] Error fetching search areas:', err);
      setError('Failed to load search areas');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    console.log('[SEARCH-MAP] Initializing map...');

    import('leaflet').then((L) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Default center (use case location if available)
      const center = missionData?.lastSeenLatitude && missionData?.lastSeenLongitude
        ? [missionData.lastSeenLatitude, missionData.lastSeenLongitude]
        : [41.8781, -87.6298]; // Chicago default

      console.log(`[SEARCH-MAP] Map center: ${center}`);

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

      // Add marker for last seen location
      if (missionData?.lastSeenLatitude && missionData?.lastSeenLongitude) {
        const lastSeenIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            width: 40px;
            height: 40px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="transform: rotate(45deg); font-size: 18px;">🐕</span>
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        L.marker(center, { icon: lastSeenIcon })
          .addTo(map)
          .bindPopup(`<b>Last Seen Location</b><br/>${missionData.lastSeenAddress || 'Unknown address'}`);
      }

      // Create layer group for search areas
      areasLayerRef.current = L.layerGroup().addTo(map);

      // Create layer group for drawing
      drawingLayerRef.current = L.layerGroup().addTo(map);

      // Handle map clicks for drawing
      map.on('click', (e) => {
        if (isDrawing) {
          const point = [e.latlng.lat, e.latlng.lng];
          console.log(`[SEARCH-MAP] Click at: ${point}`);
          setDrawingPoints((prev) => [...prev, point]);
        }
      });

      mapInstanceRef.current = map;

      // Fetch search areas after map is ready
      fetchSearchAreas();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [missionData, fetchSearchAreas, isDrawing]);

  // Render existing search areas
  useEffect(() => {
    if (!areasLayerRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      areasLayerRef.current.clearLayers();

      // Color palette for different users
      const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#f97316',
      ];

      const userColorMap = {};
      let colorIndex = 0;

      searchAreas.forEach((area) => {
        try {
          const geometry = JSON.parse(area.geometry);

          // Assign color to user
          if (!userColorMap[area.markedById]) {
            userColorMap[area.markedById] = colors[colorIndex % colors.length];
            colorIndex++;
          }

          const color = area.markedById === currentUserId ? '#2563eb' : userColorMap[area.markedById];
          const isOwn = area.markedById === currentUserId;

          // Create polygon
          const polygon = L.polygon(geometry, {
            color: color,
            fillColor: color,
            fillOpacity: area.potentialSpotting ? 0.4 : 0.2,
            weight: isOwn ? 3 : 2,
            dashArray: area.potentialSpotting ? '5, 5' : null,
          });

          // Add popup
          const popupContent = `
            <div style="min-width: 150px;">
              <b>${area.markedBy?.firstName || 'Unknown'} ${area.markedBy?.lastName?.[0] || ''}.</b>
              <br/>
              <span style="color: #64748b; font-size: 0.8rem;">
                ${area.acreage} acres • ${new Date(area.markedAt).toLocaleDateString()}
              </span>
              ${area.potentialSpotting ? '<br/><span style="color: #f59e0b;">⚠️ Potential sighting in area</span>' : ''}
              ${area.notes ? `<br/><em>"${area.notes}"</em>` : ''}
            </div>
          `;
          polygon.bindPopup(popupContent);

          polygon.addTo(areasLayerRef.current);
        } catch (err) {
          console.error('[SEARCH-MAP] Error parsing area geometry:', err);
        }
      });
    });
  }, [searchAreas, currentUserId]);

  // Render drawing polygon
  useEffect(() => {
    if (!drawingLayerRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      drawingLayerRef.current.clearLayers();

      if (drawingPoints.length > 0) {
        // Draw lines connecting points
        const polyline = L.polyline(drawingPoints, {
          color: '#10b981',
          weight: 3,
          dashArray: '10, 5',
        });
        polyline.addTo(drawingLayerRef.current);

        // Draw points
        drawingPoints.forEach((point, index) => {
          const marker = L.circleMarker(point, {
            radius: 8,
            fillColor: '#10b981',
            color: 'white',
            weight: 2,
            fillOpacity: 1,
          });

          if (index === 0) {
            marker.bindTooltip('Start point', { permanent: false });
          }

          marker.addTo(drawingLayerRef.current);
        });

        // If 3+ points, show preview polygon
        if (drawingPoints.length >= 3) {
          const polygon = L.polygon(drawingPoints, {
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.3,
            weight: 2,
          });
          polygon.addTo(drawingLayerRef.current);
        }
      }
    });
  }, [drawingPoints]);

  // Start drawing mode
  const startDrawing = () => {
    console.log('[SEARCH-MAP] Starting drawing mode');
    setIsDrawing(true);
    setDrawingPoints([]);
    setNotes('');
    setPotentialSpotting(false);
  };

  // Cancel drawing
  const cancelDrawing = () => {
    console.log('[SEARCH-MAP] Cancelling drawing');
    setIsDrawing(false);
    setDrawingPoints([]);
    if (drawingLayerRef.current) {
      drawingLayerRef.current.clearLayers();
    }
  };

  // Undo last point
  const undoLastPoint = () => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  };

  // Submit search area
  const submitSearchArea = async () => {
    if (drawingPoints.length < 3) {
      setValidationError('Please mark at least 3 points to create an area');
      return;
    }
    setValidationError(null);

    const acreage = calculateAcreage(drawingPoints);
    console.log(`[SEARCH-MAP] Submitting area with ${drawingPoints.length} points, ${acreage} acres`);

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/search-areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometry: drawingPoints,
          acreage,
          notes: notes.trim() || null,
          potentialSpotting,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit search area');
      }

      console.log('[SEARCH-MAP] Search area submitted successfully');

      // Reset drawing state
      cancelDrawing();

      // Refresh areas
      fetchSearchAreas();
    } catch (err) {
      console.error('[SEARCH-MAP] Error submitting area:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total stats
  const totalAcreage = searchAreas.reduce((sum, area) => sum + (area.acreage || 0), 0);
  const uniqueSearchers = new Set(searchAreas.map((a) => a.markedById)).size;

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
      }}>
        <LoadingSpinner text="Loading search areas..." />
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
      {/* Header with stats */}
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
            🗺️ Search Area Map
          </h2>
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.8rem',
            color: '#64748b',
          }}>
            {searchAreas.length} areas • {totalAcreage.toFixed(1)} acres • {uniqueSearchers} searchers
          </p>
        </div>

        {/* Drawing controls */}
        {isParticipant && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isDrawing ? (
              <button
                onClick={startDrawing}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#10b981',
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
                ✏️ Mark New Area
              </button>
            ) : (
              <>
                <button
                  onClick={undoLastPoint}
                  disabled={drawingPoints.length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    background: drawingPoints.length > 0 ? '#f59e0b' : '#94a3b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    cursor: drawingPoints.length > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  ↩ Undo
                </button>
                <button
                  onClick={cancelDrawing}
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Drawing instructions */}
      {isDrawing && (
        <div style={{
          padding: '1rem 1.5rem',
          background: '#ecfdf5',
          borderBottom: '1px solid #10b981',
        }}>
          <p style={{
            margin: 0,
            color: '#065f46',
            fontSize: '0.9rem',
          }}>
            <strong>Drawing Mode:</strong> Click on the map to mark points for your search area.
            Add at least 3 points, then complete the form below.
          </p>
          <p style={{
            margin: '0.25rem 0 0 0',
            color: '#059669',
            fontSize: '0.8rem',
          }}>
            Points marked: {drawingPoints.length} •
            Estimated area: {drawingPoints.length >= 3 ? `${calculateAcreage(drawingPoints)} acres` : 'Need 3+ points'}
          </p>
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          height: '450px',
          width: '100%',
          cursor: isDrawing ? 'crosshair' : 'grab',
        }}
      />

      {/* Drawing form */}
      {isDrawing && drawingPoints.length >= 3 && (
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
            Complete Your Search Area
          </h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations from this area..."
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

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            color: '#374151',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={potentialSpotting}
              onChange={(e) => setPotentialSpotting(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            ⚠️ Potential pet sighting in this area
          </label>

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
            onClick={submitSearchArea}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: submitting ? '#94a3b8' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : `Submit Area (${calculateAcreage(drawingPoints)} acres)`}
          </button>
        </div>
      )}

      {/* Search areas list */}
      {searchAreas.length > 0 && !isDrawing && (
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
            Searched Areas ({searchAreas.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {searchAreas.map((area) => (
              <div
                key={area.id}
                style={{
                  padding: '0.75rem 1rem',
                  background: area.markedById === currentUserId ? '#eff6ff' : 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ color: '#0f172a' }}>
                    {area.markedBy?.firstName || 'Unknown'} {area.markedBy?.lastName?.[0] || ''}.
                    {area.markedById === currentUserId && (
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
                    {area.acreage} acres • {new Date(area.markedAt).toLocaleDateString()}
                    {area.potentialSpotting && ' • ⚠️ Sighting reported'}
                  </p>
                  {area.notes && (
                    <p style={{
                      margin: '0.25rem 0 0 0',
                      fontSize: '0.8rem',
                      color: '#6b7280',
                      fontStyle: 'italic',
                    }}>
                      "{area.notes}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
