'use client';

/**
 * MapPreview - Simple map showing last seen and sightings
 *
 * A preview that links to the full mission control map.
 * Shows: last seen location, recent sightings, search radius
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, ExternalLink, Eye, Navigation } from 'lucide-react';

// Dynamically import map to avoid SSR issues
const PetMap = dynamic(() => import('@/app/components/PetMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-midnight-100 flex items-center justify-center">
      <div className="animate-pulse text-midnight-400">Loading map...</div>
    </div>
  )
});

export default function MapPreview({
  caseNumber,
  lastSeenLatitude,
  lastSeenLongitude,
  lastSeenAddress,
  sightings = [],
  searchRadius = 5
}) {
  // Build markers array
  const markers = [];

  // Last seen marker
  if (lastSeenLatitude && lastSeenLongitude) {
    markers.push({
      position: [lastSeenLatitude, lastSeenLongitude],
      type: 'lastSeen',
      popup: `Last seen: ${lastSeenAddress || 'Here'}`
    });
  }

  // Sighting markers (most recent first, limit to 5)
  const recentSightings = sightings.slice(0, 5);
  recentSightings.forEach((sighting, index) => {
    if (sighting.latitude && sighting.longitude) {
      markers.push({
        position: [sighting.latitude, sighting.longitude],
        type: 'sighting',
        popup: sighting.description || `Sighting ${index + 1}`
      });
    }
  });

  const hasLocation = lastSeenLatitude && lastSeenLongitude;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-white rounded-2xl shadow-lg border border-midnight-100 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-midnight-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-midnight-600" />
            <h2 className="font-bold text-midnight-900">Search Area</h2>
          </div>
          {sightings.length > 0 && (
            <span className="text-sm text-amber-600 font-medium flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {sightings.length} sighting{sightings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {lastSeenAddress && (
          <p className="text-sm text-midnight-500 mt-1">{lastSeenAddress}</p>
        )}
      </div>

      {/* Map */}
      {hasLocation ? (
        <div className="relative">
          <div className="h-48 md:h-64">
            <PetMap
              center={[lastSeenLatitude, lastSeenLongitude]}
              zoom={14}
              height="100%"
              markers={markers}
            />
          </div>

          {/* Overlay Link to Mission Control */}
          <Link
            href={`/mission-control?mission=${caseNumber}`}
            className="absolute bottom-4 right-4 bg-midnight-900 hover:bg-midnight-800 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium transition"
          >
            <Navigation className="w-4 h-4" />
            Open Full Map
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="h-48 bg-midnight-50 flex items-center justify-center">
          <p className="text-midnight-400">No location data available</p>
        </div>
      )}

      {/* Map Legend */}
      {hasLocation && (
        <div className="px-5 py-3 bg-midnight-50 border-t border-midnight-100 flex flex-wrap gap-4 text-xs text-midnight-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-midnight-700 rounded-full" />
            Last Seen
          </div>
          {sightings.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-amber-500 rounded-full" />
              Sightings
            </div>
          )}
          <div className="flex items-center gap-1.5 text-midnight-400">
            <span className="w-3 h-3 border-2 border-dashed border-blue-400 rounded-full" />
            {searchRadius} mile radius
          </div>
        </div>
      )}
    </motion.div>
  );
}
