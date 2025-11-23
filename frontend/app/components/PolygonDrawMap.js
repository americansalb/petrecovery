'use client';
import { useEffect, useRef, useState } from 'react';

export default function PolygonDrawMap({ onPolygonChange, initialBoundaries = null, centerLat = 41.8781, centerLng = -87.6298, zoom = 12 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mapInstanceRef.current) return; // Already initialized

    // Dynamically import Leaflet
    import('leaflet').then((L) => {
      // Dynamically import Leaflet Draw
      import('leaflet-draw').then(() => {
        // Fix Leaflet icon paths
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Initialize map
        const map = L.map(mapRef.current).setView([centerLat, centerLng], zoom);
        mapInstanceRef.current = map;

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Feature group to store drawn items
        const drawnItems = new L.FeatureGroup();
        drawnItemsRef.current = drawnItems;
        map.addLayer(drawnItems);

        // Add existing polygon if provided
        if (initialBoundaries) {
          try {
            const coords = typeof initialBoundaries === 'string'
              ? JSON.parse(initialBoundaries)
              : initialBoundaries;
            if (coords && coords.length > 0) {
              const polygon = L.polygon(coords, {
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.3,
                weight: 3
              });
              drawnItems.addLayer(polygon);
              map.fitBounds(polygon.getBounds());
            }
          } catch (e) {
            console.error('Error loading initial polygon:', e);
          }
        }

        // Add draw controls
        const drawControl = new L.Control.Draw({
          position: 'topright',
          draw: {
            polygon: {
              allowIntersection: false, // Restrict polygons to simple shapes
              shapeOptions: {
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.3,
                weight: 3
              },
              showArea: true,
              metric: false // Use miles instead of km
            },
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
          },
          edit: {
            featureGroup: drawnItems,
            remove: true
          }
        });
        map.addControl(drawControl);

        // Handle polygon created
        map.on(L.Draw.Event.CREATED, function (e) {
          const layer = e.layer;

          // Clear existing polygons (only allow one at a time)
          drawnItems.clearLayers();
          drawnItems.addLayer(layer);

          // Get polygon coordinates
          const coords = layer.getLatLngs()[0].map(latLng => [latLng.lat, latLng.lng]);

          // Calculate center point
          const bounds = layer.getBounds();
          const center = bounds.getCenter();

          onPolygonChange({
            boundaries: coords,
            centerLatitude: center.lat,
            centerLongitude: center.lng,
            bounds: bounds
          });
        });

        // Handle polygon edited
        map.on(L.Draw.Event.EDITED, function (e) {
          const layers = e.layers;
          layers.eachLayer(function (layer) {
            const coords = layer.getLatLngs()[0].map(latLng => [latLng.lat, latLng.lng]);
            const bounds = layer.getBounds();
            const center = bounds.getCenter();

            onPolygonChange({
              boundaries: coords,
              centerLatitude: center.lat,
              centerLongitude: center.lng,
              bounds: bounds
            });
          });
        });

        // Handle polygon deleted
        map.on(L.Draw.Event.DELETED, function () {
          onPolygonChange(null);
        });
      });
    });

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{
      border: '2px solid #e2e8f0',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '1rem'
    }}>
      <div ref={mapRef} style={{ height: '500px', width: '100%' }} />
      <div style={{
        padding: '1rem',
        background: '#f8fafc',
        fontSize: '0.9rem',
        color: '#64748b',
        lineHeight: '1.6'
      }}>
        <strong>Instructions:</strong>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li>Click the polygon tool (⬟) in the top right to start drawing</li>
          <li>Click on the map to add points for your division boundary</li>
          <li>Click the first point again to complete the polygon</li>
          <li>Use the edit tool (✎) to modify your polygon</li>
          <li>Use the trash tool (🗑) to delete and start over</li>
          <li>Only one polygon allowed - drawing a new one replaces the old one</li>
        </ul>
      </div>
    </div>
  );
}
