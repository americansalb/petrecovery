'use client';

/**
 * MapPreview - Gateway to Mission Control map
 *
 * Shows a preview of the search area and strongly encourages
 * users to open the full Mission Control for real-time data.
 * This is NOT meant to duplicate Mission Control - it's a teaser.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Dynamically import map to avoid SSR issues
const MapEmbed = dynamic(() => import('./MapEmbed'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-midnight-100 animate-pulse" />
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
  const hasLocation = lastSeenLatitude && lastSeenLongitude;
  const sightingsCount = sightings?.length || 0;

  // Get most recent sighting time
  const latestSighting = sightings?.[0];
  const latestSightingTime = latestSighting?.sightedAt
    ? formatTimeAgo(new Date(latestSighting.sightedAt))
    : null;

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
        </div>
      </div>

      {/* Map with Click-to-Open Overlay */}
      {hasLocation ? (
        <Link
          href={`/mission-control?mission=${caseNumber}`}
          className="block relative group"
        >
          {/* The Map */}
          <div className="h-52 md:h-64">
            <MapEmbed
              center={[lastSeenLatitude, lastSeenLongitude]}
              sightings={sightings}
            />
          </div>

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-midnight-900/0 group-hover:bg-midnight-900/60 transition-all duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center">
              <div className="bg-white text-midnight-900 font-bold px-6 py-3 rounded-xl shadow-xl">
                Open Full Search Map →
              </div>
              <p className="text-white/90 text-sm mt-2">
                Live updates • Sightings • Coverage
              </p>
            </div>
          </div>
        </Link>
      ) : (
        <div className="h-52 bg-midnight-50 flex items-center justify-center">
          <p className="text-midnight-400">No location data available</p>
        </div>
      )}

      {/* Footer Stats */}
      {hasLocation && (
        <div className="px-5 py-3 bg-midnight-50 border-t border-midnight-100">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {/* Last Seen indicator */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-midnight-700 rounded-full" />
                <span className="text-midnight-600">Last seen</span>
              </div>

              {/* Sightings indicator */}
              {sightingsCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                  <span className="text-midnight-600">
                    {sightingsCount} sighting{sightingsCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Latest activity */}
            {latestSightingTime && (
              <span className="text-midnight-400 text-xs">
                Latest: {latestSightingTime}
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Helper for relative time
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}
