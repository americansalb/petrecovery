'use client';

/**
 * TeamTab - Simplified Team Actions
 *
 * Redesigned to focus on 4 CORE volunteer actions:
 * 1. Search the Area - GPS tracking for ground searches
 * 2. Spread the Word - Share, flyers, neighbors
 * 3. Monitor Online - Check found pet listings
 * 4. Check Shelters - Call/visit local shelters
 *
 * Each action is a big, tappable card that logs completions.
 * No more overwhelming 25-item checklists!
 */

import { useState } from 'react';
import {
  Navigation,
  Users,
  Share2,
  Search,
  Building2,
  Globe,
  Check,
  ChevronRight,
  MapPin,
  Clock,
} from 'lucide-react';

// Simple action definitions - what volunteers CAN and SHOULD do
const VOLUNTEER_ACTIONS = [
  {
    id: 'search',
    title: 'Search the Area',
    icon: Search,
    color: 'purple',
    description: 'Walk the neighborhood and look in hiding spots',
    tips: [
      'Check under porches, bushes, and parked cars',
      'Look in garages, sheds, and dumpsters',
      'Search at dawn or dusk when pets are more active',
    ],
  },
  {
    id: 'spread',
    title: 'Spread the Word',
    icon: Share2,
    color: 'blue',
    description: 'Help get more eyes looking',
    tips: [
      'Share on social media and local groups',
      'Talk to neighbors and dog walkers',
      'Post or hand out flyers',
    ],
  },
  {
    id: 'online',
    title: 'Monitor Online',
    icon: Globe,
    color: 'amber',
    description: 'Check if someone found them',
    tips: [
      'Check Pawboost, Nextdoor, local Facebook groups',
      'Search Craigslist found pets section',
      'Check shelter websites for intake photos',
    ],
  },
  {
    id: 'shelters',
    title: 'Check Shelters',
    icon: Building2,
    color: 'emerald',
    description: 'Contact local shelters directly',
    tips: [
      'Call shelters - describe the pet clearly',
      'Visit in person to check kennels',
      'Leave your contact info with them',
    ],
  },
];

export default function TeamTab({
  team = [],
  mission,
  gpsPath = [],
  setGpsPath,
  isGPSTracking,
  setIsGPSTracking,
  showNotification,
  session,
}) {
  const [completedActions, setCompletedActions] = useState({});
  const [expandedAction, setExpandedAction] = useState(null);

  const startGPSTracking = () => {
    if (!('geolocation' in navigator)) {
      showNotification?.('error', 'GPS not available on this device');
      return;
    }
    setIsGPSTracking(true);
    setGpsPath([]);
    showNotification?.('info', 'GPS tracking started. Your search path is being recorded.');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPath(prev => [...prev, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }]);
      },
      (error) => {
        console.error('GPS error:', error);
        setIsGPSTracking(false);
        showNotification?.('error', 'Unable to access GPS. Please check your location permissions.');
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    window._gpsWatchId = watchId;
  };

  const stopGPSTracking = () => {
    if (window._gpsWatchId) {
      navigator.geolocation.clearWatch(window._gpsWatchId);
      window._gpsWatchId = null;
    }
    setIsGPSTracking(false);
    if (gpsPath.length > 0) {
      showNotification?.('success', `Search recorded! ${gpsPath.length} GPS points saved.`);
      // Mark search action as completed
      markActionComplete('search');
    }
  };

  const markActionComplete = (actionId) => {
    setCompletedActions(prev => ({
      ...prev,
      [actionId]: {
        completedAt: new Date().toISOString(),
        completedBy: session?.user?.name || 'You',
      }
    }));
    showNotification?.('success', 'Action logged! Thank you for helping.');
  };

  const getColorClasses = (color, isCompleted) => {
    if (isCompleted) {
      return {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/50',
        text: 'text-emerald-400',
        icon: 'text-emerald-400',
      };
    }
    const colors = {
      purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', icon: 'text-purple-400' },
      blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: 'text-blue-400' },
      amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: 'text-amber-400' },
      emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'text-emerald-400' },
    };
    return colors[color] || colors.purple;
  };

  const completedCount = Object.keys(completedActions).length;

  return (
    <div className="space-y-4 pb-20">
      {/* GPS Search - Primary Action */}
      <div className={`rounded-xl p-4 border-2 transition-all ${
        isGPSTracking
          ? 'bg-purple-500/20 border-purple-500'
          : 'bg-slate-800/50 border-purple-500/30 hover:border-purple-500/50'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${isGPSTracking ? 'bg-purple-500' : 'bg-purple-500/20'}`}>
            <Navigation size={24} className={isGPSTracking ? 'text-white' : 'text-purple-400'} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg">Search the Area</h3>
            <p className="text-slate-400 text-sm mt-1">
              {isGPSTracking
                ? `Recording your path... ${gpsPath.length} points`
                : 'Track your search so the team knows where you looked'
              }
            </p>

            {!isGPSTracking ? (
              <button
                onClick={startGPSTracking}
                className="mt-3 w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-purple-500/30"
              >
                Start GPS Search
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-purple-300 text-sm">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  <span>Recording your search path...</span>
                </div>
                <button
                  onClick={stopGPSTracking}
                  className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition"
                >
                  <Check size={18} className="inline mr-2" />
                  Done Searching
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search tips - collapsible */}
        {!isGPSTracking && (
          <div className="mt-4 pt-4 border-t border-purple-500/20">
            <p className="text-purple-300 text-xs font-medium mb-2">Search tips:</p>
            <ul className="text-slate-400 text-xs space-y-1">
              <li>• Check under porches, bushes, and parked cars</li>
              <li>• Look in garages, sheds, and dumpsters</li>
              <li>• Search at dawn or dusk when pets are more active</li>
            </ul>
          </div>
        )}
      </div>

      {/* Other Actions Grid */}
      <div className="grid gap-3">
        {VOLUNTEER_ACTIONS.slice(1).map(action => {
          const isCompleted = !!completedActions[action.id];
          const isExpanded = expandedAction === action.id;
          const colors = getColorClasses(action.color, isCompleted);
          const Icon = action.icon;

          return (
            <div
              key={action.id}
              className={`rounded-xl border transition-all ${colors.bg} ${colors.border}`}
            >
              <button
                onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                className="w-full p-4 flex items-center gap-4 text-left"
              >
                <div className={`p-2.5 rounded-xl ${isCompleted ? 'bg-emerald-500/20' : colors.bg}`}>
                  {isCompleted ? (
                    <Check size={22} className="text-emerald-400" />
                  ) : (
                    <Icon size={22} className={colors.icon} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold ${isCompleted ? 'text-emerald-400' : 'text-white'}`}>
                    {action.title}
                    {isCompleted && <span className="ml-2 text-xs font-normal">Done!</span>}
                  </h3>
                  <p className="text-slate-400 text-sm truncate">{action.description}</p>
                </div>
                <ChevronRight
                  size={20}
                  className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0">
                  <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                    <p className="text-slate-400 text-xs font-medium mb-2">How to help:</p>
                    <ul className="text-slate-300 text-sm space-y-1.5">
                      {action.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-slate-500 mt-0.5">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {!isCompleted ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markActionComplete(action.id);
                        setExpandedAction(null);
                      }}
                      className={`w-full py-2.5 rounded-xl font-bold transition ${
                        action.color === 'blue' ? 'bg-blue-500 hover:bg-blue-400' :
                        action.color === 'amber' ? 'bg-amber-500 hover:bg-amber-400 text-slate-900' :
                        'bg-emerald-500 hover:bg-emerald-400'
                      } text-white`}
                    >
                      <Check size={16} className="inline mr-2" />
                      Mark as Done
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <Check size={16} />
                      <span>Completed by {completedActions[action.id].completedBy}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Team Members Section */}
      <div className="bg-slate-800/50 border border-flash-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Users size={18} className="text-flash-400" />
          Search Team ({team.length})
        </h3>
        {team.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-400 text-sm">No team members yet</p>
            <p className="text-slate-500 text-xs mt-1">Share this case to get more helpers!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {team.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-flash-500/20 flex items-center justify-center text-flash-400 font-bold text-sm">
                  {member.firstName?.[0]}{member.lastName?.[0] || ''}
                </div>
                <span className="text-white text-sm flex-1">{member.name}</span>
                {member.isActive && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-emerald-400 text-xs">Active</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Summary */}
      {completedCount > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
          <p className="text-emerald-400 font-bold text-lg">
            {completedCount} of 4 actions completed
          </p>
          <p className="text-emerald-300/70 text-sm mt-1">
            Thank you for helping find {mission?.petName || 'this pet'}!
          </p>
        </div>
      )}
    </div>
  );
}
