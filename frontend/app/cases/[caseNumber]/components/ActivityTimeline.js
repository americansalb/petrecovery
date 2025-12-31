'use client';

/**
 * ActivityTimeline - Chronological feed of case activity
 *
 * Shows sightings, owner updates, and search activity.
 * Makes the case feel alive and active.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, MessageCircle, Users, MapPin, Clock, ChevronDown,
  Camera, CheckCircle, AlertCircle
} from 'lucide-react';

// Format time ago
const formatTimeAgo = (date) => {
  if (!date) return 'Unknown';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

// Get icon and style for activity type
const getActivityStyle = (type, certaintyLevel = null) => {
  switch (type) {
    case 'sighting':
      return {
        icon: Eye,
        bgColor: certaintyLevel >= 4 ? 'bg-emerald-100' : certaintyLevel >= 2 ? 'bg-amber-100' : 'bg-slate-100',
        iconColor: certaintyLevel >= 4 ? 'text-emerald-600' : certaintyLevel >= 2 ? 'text-amber-600' : 'text-slate-600',
        label: 'Sighting'
      };
    case 'update':
      return {
        icon: MessageCircle,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        label: 'Update'
      };
    case 'search':
      return {
        icon: Users,
        bgColor: 'bg-purple-100',
        iconColor: 'text-purple-600',
        label: 'Search Activity'
      };
    case 'created':
      return {
        icon: AlertCircle,
        bgColor: 'bg-flash-100',
        iconColor: 'text-flash-600',
        label: 'Case Created'
      };
    default:
      return {
        icon: Clock,
        bgColor: 'bg-slate-100',
        iconColor: 'text-slate-600',
        label: 'Activity'
      };
  }
};

// Confidence badge
const ConfidenceBadge = ({ level }) => {
  if (!level) return null;

  const config = {
    5: { label: 'Very Sure', color: 'bg-emerald-500 text-white' },
    4: { label: 'Likely', color: 'bg-emerald-100 text-emerald-700' },
    3: { label: 'Possible', color: 'bg-amber-100 text-amber-700' },
    2: { label: 'Uncertain', color: 'bg-slate-100 text-slate-600' },
    1: { label: 'Unlikely', color: 'bg-slate-100 text-slate-500' }
  };

  const { label, color } = config[level] || config[3];

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
};

// Single Activity Entry
function ActivityEntry({ activity, isFirst }) {
  const style = getActivityStyle(activity.type, activity.certaintyLevel);
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative pl-8 pb-6 ${!isFirst ? 'border-l-2 border-midnight-100 ml-3' : ''}`}
    >
      {/* Timeline dot */}
      <div className={`absolute left-0 -translate-x-1/2 w-7 h-7 rounded-full ${style.bgColor} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${style.iconColor}`} />
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-midnight-100 p-4 ml-2 shadow-sm hover:shadow-md transition">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${style.iconColor}`}>
              {style.label}
            </span>
            {activity.certaintyLevel && (
              <ConfidenceBadge level={activity.certaintyLevel} />
            )}
          </div>
          <span className="text-xs text-midnight-400 flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(activity.timestamp)}
          </span>
        </div>

        {/* Author */}
        {activity.author && (
          <p className="text-sm font-medium text-midnight-900 mb-1">
            {activity.author}
          </p>
        )}

        {/* Description */}
        <p className="text-sm text-midnight-600 leading-relaxed">
          {activity.description}
        </p>

        {/* Location if sighting */}
        {activity.address && (
          <p className="text-xs text-midnight-400 mt-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {activity.address}
          </p>
        )}

        {/* Photo indicator */}
        {activity.hasPhoto && (
          <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
            <Camera className="w-3 h-3" />
            Photo attached
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ActivityTimeline({
  sightings = [],
  updates = [],
  caseCreatedAt
}) {
  const [showAll, setShowAll] = useState(false);

  // Combine and sort all activities chronologically
  const allActivities = [];

  // Add sightings
  sightings.forEach(sighting => {
    allActivities.push({
      type: 'sighting',
      timestamp: sighting.sightedAt,
      description: sighting.description,
      address: sighting.address,
      certaintyLevel: sighting.certaintyLevel,
      author: sighting.reporterName || 'Community member',
      hasPhoto: sighting.photoUrls && JSON.parse(sighting.photoUrls || '[]').length > 0
    });
  });

  // Add updates
  updates.forEach(update => {
    allActivities.push({
      type: 'update',
      timestamp: update.createdAt,
      description: update.content,
      author: 'Owner'
    });
  });

  // Add case creation
  if (caseCreatedAt) {
    allActivities.push({
      type: 'created',
      timestamp: caseCreatedAt,
      description: 'Search case was created'
    });
  }

  // Sort by timestamp, newest first
  allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Show limited or all
  const displayedActivities = showAll ? allActivities : allActivities.slice(0, 3);
  const hasMore = allActivities.length > 3;

  if (allActivities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl shadow-lg border border-midnight-100 p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-midnight-400" />
          <h2 className="font-bold text-midnight-900">Activity</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-midnight-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Eye className="w-6 h-6 text-midnight-400" />
          </div>
          <p className="text-midnight-500">No activity yet</p>
          <p className="text-sm text-midnight-400 mt-1">
            Sightings and updates will appear here
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white rounded-2xl shadow-lg border border-midnight-100 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <h2 className="font-bold text-midnight-900">Latest Activity</h2>
        </div>
        <span className="text-sm text-midnight-500">
          {allActivities.length} update{allActivities.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        <AnimatePresence>
          {displayedActivities.map((activity, index) => (
            <ActivityEntry
              key={`${activity.type}-${activity.timestamp}-${index}`}
              activity={activity}
              isFirst={index === 0}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Show More Button */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-4 py-3 text-sm font-medium text-midnight-600 hover:text-midnight-900 flex items-center justify-center gap-1 transition"
        >
          {showAll ? 'Show less' : `View ${allActivities.length - 3} more`}
          <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </motion.div>
  );
}
