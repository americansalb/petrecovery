'use client';

/**
 * SocialProofBar - Show momentum and activity
 *
 * Displays: views, shares, active searchers, sightings count
 * Plus a live activity ticker showing recent activity
 */

import { motion } from 'framer-motion';
import { Eye, Share2, Users, MapPin, Clock } from 'lucide-react';

// Format time ago for ticker
const formatTimeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
};

export default function SocialProofBar({
  viewCount = 0,
  shareCount = 0,
  activeSearchers = 0,
  sightingsCount = 0,
  latestActivity = null // { type: 'sighting'|'share'|'search', message: string, time: Date }
}) {
  const stats = [
    { icon: Eye, value: viewCount, label: viewCount === 1 ? 'View' : 'Views', color: 'text-midnight-500' },
    { icon: Share2, value: shareCount, label: shareCount === 1 ? 'Share' : 'Shares', color: 'text-midnight-500' },
    { icon: Users, value: activeSearchers, label: 'Searching', color: 'text-midnight-500' },
    { icon: MapPin, value: sightingsCount, label: sightingsCount === 1 ? 'Sighting' : 'Sightings', color: 'text-flash-600' },
  ];
  const nothingYet = viewCount + shareCount + activeSearchers + sightingsCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-2xl shadow-md border border-midnight-100 overflow-hidden"
    >
      {/* A fresh case has nothing to count. One honest line beats a wall of
          four zeros. */}
      {nothingYet ? (
        <div className="py-4 px-4 text-center">
          <p className="text-sm text-midnight-600">
            <span className="font-semibold text-midnight-900">Just posted.</span>{' '}
            Be the first to share this case or report a sighting.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-midnight-100">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="flex flex-col items-center justify-center py-4 px-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xl font-bold text-midnight-900">
                {stat.value >= 1000 ? `${(stat.value / 1000).toFixed(1)}K` : stat.value}
              </span>
            </div>
            <span className="text-xs text-midnight-500">{stat.label}</span>
          </div>
        ))}
      </div>
      )}

      {/* Activity Ticker */}
      {latestActivity && (
        <div className="border-t border-midnight-100 bg-midnight-50 px-4 py-3">
          {/* items-start + line-clamp-2, not items-center + truncate: one line
              cut this to "Mike reported a sighting near Ne..." on a phone,
              losing the where, which is the only part worth reading. */}
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 mt-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
            <p className="text-sm text-midnight-700 flex-1 min-w-0 line-clamp-2">
              <span className="font-medium">{latestActivity.message}</span>
            </p>
            <span className="text-xs text-midnight-400 flex-shrink-0 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(latestActivity.time)}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
