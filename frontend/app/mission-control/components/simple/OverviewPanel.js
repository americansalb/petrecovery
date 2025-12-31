'use client';

/**
 * OverviewPanel - Mission home base
 *
 * Shows at-a-glance info:
 * - Pet photo and details
 * - Time missing with urgency indicator
 * - Key stats (sightings, searchers, area covered)
 * - Quick action buttons
 * - Recent activity feed
 */

import {
  Clock,
  MapPin,
  Users,
  Eye,
  Navigation,
  Share2,
  AlertCircle,
  ChevronRight,
  Zap,
  Phone,
} from 'lucide-react';

// Time urgency levels
function getUrgencyLevel(hoursMissing) {
  if (hoursMissing < 24) return { level: 'critical', label: 'First 24 Hours', color: 'red', message: 'Most pets are found within the first 24 hours. Act fast!' };
  if (hoursMissing < 72) return { level: 'high', label: '24-72 Hours', color: 'amber', message: 'Expand your search radius. Check with neighbors and shelters.' };
  if (hoursMissing < 168) return { level: 'moderate', label: '3-7 Days', color: 'yellow', message: 'Set up feeding stations. Pets often hide nearby.' };
  return { level: 'ongoing', label: 'Over 1 Week', color: 'blue', message: 'Don\'t give up! Many pets are found weeks or months later.' };
}

function formatTimeMissing(hours) {
  if (hours < 1) return 'Less than an hour';
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''}`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

export default function OverviewPanel({
  mission,
  timeMissing,
  sightingsCount = 0,
  teamCount = 0,
  searchersActive = 0,
  recentActivity = [],
  onStartSearch,
  onReportSighting,
  onShare,
  onViewMap,
  onCallShelters,
  hideSearchButton = false, // Hide on desktop since map has its own button
  isSearching = false,
}) {
  const pet = mission || {};
  const hoursMissing = timeMissing?.hours || 0;
  const urgency = getUrgencyLevel(hoursMissing);

  const urgencyColors = {
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
      {/* Pet Card */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Pet Header */}
          <div className="p-4 flex gap-4">
            {/* Photo */}
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-4xl shrink-0 overflow-hidden">
              {pet.petPhotoUrl ? (
                <img src={pet.petPhotoUrl} alt={pet.petName} className="w-full h-full object-cover" />
              ) : (
                pet.petSpecies === 'DOG' ? '🐕' : pet.petSpecies === 'CAT' ? '🐈' : '🐾'
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{pet.petName || 'Missing Pet'}</h1>
              <p className="text-sm text-slate-400">
                {pet.petBreed || pet.petSpecies || 'Pet'}
                {pet.petColor && ` • ${pet.petColor}`}
              </p>

              {/* Last seen */}
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                <MapPin size={12} />
                <span className="truncate">{pet.lastSeenAddress || 'Location not specified'}</span>
              </div>
            </div>
          </div>

          {/* Time Missing Banner */}
          <div className={`px-4 py-3 bg-gradient-to-r ${urgencyColors[urgency.color]} border-t border-b`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span className="font-semibold">Missing {formatTimeMissing(hoursMissing)}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/20">{urgency.label}</span>
            </div>
            <p className="text-xs mt-1 opacity-80">{urgency.message}</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 divide-x divide-slate-700">
            <button onClick={onViewMap} className="p-3 text-center hover:bg-slate-800/50 transition">
              <div className="text-xl font-bold text-white">{sightingsCount}</div>
              <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                <Eye size={10} />
                Sightings
              </div>
            </button>
            <div className="p-3 text-center">
              <div className="text-xl font-bold text-white">{teamCount}</div>
              <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                <Users size={10} />
                Team
              </div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xl font-bold text-amber-400">{searchersActive}</div>
              <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                <Navigation size={10} />
                Searching
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Command Deck */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Command Deck</h2>
          <div className="h-[1px] flex-1 bg-slate-800 ml-3" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Primary Action: Start Search */}
          {!hideSearchButton && !isSearching && (
            <button
              onClick={onStartSearch}
              className="col-span-2 group relative overflow-hidden p-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] active:scale-[0.99]"
            >
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative py-4 px-6 flex items-center justify-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                  <Navigation size={20} className="text-white" />
                </div>
                <div className="flex flex-col items-start -space-y-0.5">
                  <span className="text-sm font-extrabold tracking-wide uppercase">Start GPS Search</span>
                  <span className="text-[10px] text-amber-100/90 font-medium">Track & Log Coverage</span>
                </div>
              </div>
            </button>
          )}

          {/* Report Sighting */}
          <button
            onClick={onReportSighting}
            className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-emerald-900/20 hover:border-emerald-500/30 transition-all group flex flex-col items-center gap-2"
          >
            <div className="p-2 rounded-full bg-slate-900/50 group-hover:bg-emerald-500/20 transition-colors">
              <Eye size={18} className="text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-slate-300 group-hover:text-emerald-300">Log Sighting</span>
          </button>

          {/* Share */}
          <button
            onClick={onShare}
            className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-blue-900/20 hover:border-blue-500/30 transition-all group flex flex-col items-center gap-2"
          >
            <div className="p-2 rounded-full bg-slate-900/50 group-hover:bg-blue-500/20 transition-colors">
              <Share2 size={18} className="text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-slate-300 group-hover:text-blue-300">Share Case</span>
          </button>

          {/* Find Shelters */}
          <button
            onClick={onCallShelters}
            className="col-span-2 p-3 rounded-xl bg-slate-800/30 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition flex items-center justify-center gap-2 group"
          >
            <Phone size={14} className="text-slate-500 group-hover:text-slate-400" />
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300">Find Nearby Shelters & Vets</span>
            <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-500" />
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 pb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Activity</h2>

        <div className="space-y-2">
          {recentActivity.length > 0 ? (
            recentActivity.slice(0, 5).map((activity, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                  {activity.type === 'sighting' ? <Eye size={14} /> :
                    activity.type === 'search' ? <Navigation size={14} /> :
                      activity.type === 'message' ? <AlertCircle size={14} /> :
                        <Zap size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{activity.text}</p>
                  <p className="text-xs text-slate-500">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-500">
              <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Start searching to log activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom padding for safe area */}
      <div className="h-4" />
    </div>
  );
}
