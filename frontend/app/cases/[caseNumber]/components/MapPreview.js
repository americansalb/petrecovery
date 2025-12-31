'use client';

/**
 * MapPreview - Same map as Mission Control, just smaller
 *
 * Uses the exact same SARMapView component as Mission Control
 * so all data stays in sync.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Dynamically import to avoid SSR issues with Leaflet
const SARMapView = dynamic(
  () => import('@/app/components/mission/SARMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-midnight-100 animate-pulse" />
    )
  }
);

export default function MapPreview({
  caseNumber,
  lastSeenLatitude,
  lastSeenLongitude,
  lastSeenAddress,
  sightings = [],
  petSpecies = 'DOG',
  hoursElapsed = 24
}) {
  const hasLocation = lastSeenLatitude && lastSeenLongitude;
  const sightingsCount = sightings?.length || 0;

  // Format sightings for SARMapView
  const formattedSightings = sightings.map(s => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    sightedAt: s.sightedAt,
    description: s.description,
    address: s.address,
    certaintyLevel: s.certaintyLevel
  }));

  // Last seen object for SARMapView
  const lastSeen = hasLocation ? {
    latitude: lastSeenLatitude,
    longitude: lastSeenLongitude,
    address: lastSeenAddress
  } : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-white rounded-2xl shadow-lg border border-midnight-100 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-midnight-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-midnight-900 text-lg">Search Area</h2>
            {lastSeenAddress && (
              <p className="text-sm text-midnight-500 mt-0.5 line-clamp-2">{lastSeenAddress}</p>
            )}
          </div>
          {sightingsCount > 0 && (
            <span className="text-sm text-amber-600 font-medium whitespace-nowrap">
              {sightingsCount} sighting{sightingsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Map - Same SARMapView as Mission Control */}
      {hasLocation ? (
        <div className="h-64 md:h-80">
          <SARMapView
            center={[lastSeenLatitude, lastSeenLongitude]}
            lastSeen={lastSeen}
            sightings={formattedSightings}
            petSpecies={petSpecies}
            hoursElapsed={hoursElapsed}
            showControls={false}
            showLegend={false}
            showProbabilityCircles={false}
            interactive={true}
          />
        </div>
      ) : (
        <div className="h-64 bg-midnight-50 flex items-center justify-center">
          <p className="text-midnight-400">No location data available</p>
        </div>
      )}

      {/* Footer - Link to full Mission Control */}
      {hasLocation && (
        <Link
          href={`/mission-control?mission=${caseNumber}`}
          className="block px-5 py-3 bg-midnight-50 border-t border-midnight-100 text-center text-sm font-medium text-midnight-600 hover:text-midnight-900 hover:bg-midnight-100 transition"
        >
          Open Full Map in Mission Control →
        </Link>
      )}
    </motion.div>
  );
}
