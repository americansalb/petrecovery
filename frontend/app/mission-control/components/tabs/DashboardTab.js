'use client';

/**
 * DashboardTab - V4 Home View
 *
 * Features:
 * - Suramaa tip banner with contextual tips
 * - Points summary card with gamification
 * - Quick actions grid (GPS, Shelters, Flyer, Sighting)
 * - Recent activity feed
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Navigation,
  Building2,
  FileText,
  Eye,
  Star,
  Trophy,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  ChevronRight,
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  Zap,
} from 'lucide-react';

// ============================================================================
// SURAMAA TIP BANNER
// ============================================================================
function SuramaaTipBanner({ caseId, onDismiss }) {
  const [tip, setTip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    const fetchTips = async () => {
      try {
        const res = await fetch(`/api/mission/${caseId}/tips`);
        if (res.ok) {
          const data = await res.json();
          if (data.tips && data.tips.length > 0) {
            setTip(data.tips[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching tips:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTips();
  }, [caseId]);

  const handleDismiss = async () => {
    if (!tip) return;
    setDismissing(true);
    try {
      await fetch(`/api/mission/${caseId}/tips/${tip.id}`, { method: 'DELETE' });
      setTip(null);
      if (onDismiss) onDismiss(tip.id);
    } catch (err) {
      console.error('Error dismissing tip:', err);
    } finally {
      setDismissing(false);
    }
  };

  if (loading || !tip) return null;

  const tipIcons = {
    TIME: '🌅',
    WEATHER: '🌤️',
    PROGRESS: '🎉',
    LOCATION: '📍',
    COLD_SPOT: '🗺️',
    STRATEGY: '💡',
    ENCOURAGE: '💪',
    SIGHTING: '👀',
  };

  return (
    <div className="bg-gradient-to-r from-purple-500/20 to-flash-500/20 rounded-xl p-4 border border-purple-500/30 relative">
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition"
      >
        {dismissing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
      </button>

      <div className="flex gap-3">
        {/* Suramaa Avatar */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-flash-500 flex items-center justify-center text-2xl shadow-lg">
          🐾
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-semibold">Suramaa</span>
            <span className="text-lg">{tipIcons[tip.type] || '💡'}</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{tip.message}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// POINTS CARD
// ============================================================================
function PointsCard({ caseId, userId }) {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;

    const fetchPoints = async () => {
      try {
        const res = await fetch(`/api/mission/${caseId}/points`);
        if (res.ok) {
          const data = await res.json();
          // Find current user in leaderboard
          const userEntry = data.leaderboard?.find(e => e.userId === userId);
          setPoints({
            caseTotal: userEntry?.points || 0,
            rank: userEntry?.rank || null,
            todayVerified: data.summary?.todayVerified || 0,
            todaySelfReported: data.summary?.todaySelfReported || 0,
            teamTotal: data.summary?.totalPoints || 0,
            leaderboard: data.leaderboard || [],
          });
        }
      } catch (err) {
        console.error('Error fetching points:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();
  }, [caseId, userId]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 animate-pulse">
        <div className="h-20 bg-slate-700/50 rounded-lg"></div>
      </div>
    );
  }

  const selfReportedCap = 100;
  const selfReportedUsed = points?.todaySelfReported || 0;
  const capPercentage = Math.min((selfReportedUsed / selfReportedCap) * 100, 100);

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      {/* Main Points Display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-flash-500/20 flex items-center justify-center">
            <Star className="text-flash-400" size={24} />
          </div>
          <div>
            <div className="text-3xl font-bold text-flash-400">{points?.caseTotal || 0}</div>
            <div className="text-xs text-slate-400">Your Points</div>
          </div>
        </div>

        {points?.rank && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
            <Trophy className="text-yellow-400" size={20} />
            <div>
              <div className="text-xl font-bold text-yellow-400">#{points.rank}</div>
              <div className="text-xs text-slate-400">Rank</div>
            </div>
          </div>
        )}
      </div>

      {/* Today's Breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-slate-400">Verified Today</span>
          </div>
          <div className="text-xl font-bold text-green-400">{points?.todayVerified || 0}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-xs text-slate-400">Logged Today</span>
          </div>
          <div className="text-xl font-bold text-yellow-400">{selfReportedUsed}</div>
        </div>
      </div>

      {/* Daily Cap Progress */}
      <div className="bg-slate-900/50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Daily Cap (Self-Reported)</span>
          <span className="text-xs font-medium text-slate-300">{selfReportedUsed}/{selfReportedCap}</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              capPercentage >= 100 ? 'bg-red-500' : capPercentage >= 80 ? 'bg-yellow-500' : 'bg-flash-500'
            }`}
            style={{ width: `${capPercentage}%` }}
          />
        </div>
        {capPercentage >= 80 && (
          <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
            <AlertCircle size={12} />
            {capPercentage >= 100
              ? 'Cap reached! Use GPS/email for unlimited points.'
              : 'Almost at cap. Try GPS-verified actions!'}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// QUICK ACTIONS GRID
// ============================================================================
function QuickActionsGrid({ mission, onNavigate, onReportSighting, showNotification }) {
  const actions = [
    {
      id: 'gps',
      label: 'GPS Search',
      icon: Navigation,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      description: '10 pts/mile',
      onClick: () => onNavigate('map'),
    },
    {
      id: 'shelters',
      label: 'Shelters',
      icon: Building2,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30',
      description: '8-15 pts each',
      onClick: () => onNavigate('actions'),
    },
    {
      id: 'flyer',
      label: 'Flyer',
      icon: FileText,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      description: 'Generate PDF',
      onClick: () => onNavigate('actions'),
    },
    {
      id: 'sighting',
      label: 'Sighting',
      icon: Eye,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/30',
      description: 'Report now',
      onClick: onReportSighting,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(action => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border ${action.bgColor} ${action.borderColor} hover:scale-[1.02] active:scale-[0.98] transition-all`}
          >
            <Icon className={action.color} size={28} />
            <div className="text-center">
              <div className="text-white font-semibold text-sm">{action.label}</div>
              <div className="text-slate-400 text-xs">{action.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================
function ActivityFeed({ caseId, sightings }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Combine sightings with other activity types
    // For now, just show sightings - we'll add more activity types later
    const sightingActivities = (sightings || []).map(s => ({
      id: s.id,
      type: 'sighting',
      icon: '👀',
      title: 'Possible sighting reported',
      description: s.address || 'Unknown location',
      timestamp: s.createdAt,
      color: 'text-orange-400',
    }));

    // Sort by timestamp descending
    const sorted = sightingActivities.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    setActivities(sorted.slice(0, 5));
    setLoading(false);
  }, [sightings]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-800/30 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="text-slate-500 mx-auto mb-2" size={32} />
        <p className="text-slate-400 text-sm">No recent activity</p>
        <p className="text-slate-500 text-xs mt-1">Be the first to help!</p>
      </div>
    );
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-2">
      {activities.map(activity => (
        <div
          key={activity.id}
          className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center text-xl">
            {activity.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{activity.title}</div>
            <div className="text-slate-400 text-xs truncate">{activity.description}</div>
          </div>
          <div className="text-slate-500 text-xs flex-shrink-0">
            {formatTimeAgo(activity.timestamp)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD TAB
// ============================================================================
export default function DashboardTab({
  mission,
  userId,
  sightings,
  team,
  timeMissing,
  isUrgent,
  isReunited,
  isOwner,
  onNavigate,
  onReportSighting,
  showNotification,
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4 pb-24">
        {/* Urgency Alert */}
        {isUrgent && !isReunited && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0" size={24} />
            <div>
              <div className="text-red-400 font-semibold text-sm">Act Fast - Every Moment Matters</div>
              <div className="text-red-300/80 text-xs">
                {mission.petName} has been missing for {timeMissing?.text}
              </div>
            </div>
          </div>
        )}

        {/* Reunion Banner */}
        {isReunited && (
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-emerald-400 font-bold text-lg">{mission.petName} is Home!</div>
            <div className="text-emerald-300/80 text-sm">Thank you to everyone who helped!</div>
          </div>
        )}

        {/* Suramaa Tip */}
        {!isReunited && (
          <SuramaaTipBanner caseId={mission?.id} />
        )}

        {/* Points Card */}
        <PointsCard caseId={mission?.id} userId={userId} />

        {/* Quick Actions */}
        {!isReunited && (
          <div>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-flash-400" />
              Quick Actions
            </h2>
            <QuickActionsGrid
              mission={mission}
              onNavigate={onNavigate}
              onReportSighting={onReportSighting}
              showNotification={showNotification}
            />
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Clock size={18} className="text-slate-400" />
              Recent Activity
            </h2>
            <button
              onClick={() => onNavigate('actions')}
              className="text-flash-400 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              View All
              <ChevronRight size={16} />
            </button>
          </div>
          <ActivityFeed caseId={mission?.id} sightings={sightings} />
        </div>
      </div>
    </div>
  );
}
