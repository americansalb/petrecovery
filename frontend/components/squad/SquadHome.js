'use client';

/**
 * SquadHome - Community-First Dashboard
 *
 * A community hub that balances:
 * - Community feel (announcements, activity, stats)
 * - Urgent action (cases that need help)
 * - Geographic awareness (map)
 *
 * Layout:
 * - Pinned Announcement (if any) - community first
 * - Map + Stats side by side on desktop
 * - Urgent Cases Alert
 * - Two columns: Active Cases | Recent Activity
 * - Join CTA for non-members
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  MapPin,
  ChevronRight,
  Heart,
  TrendingUp,
  Megaphone,
  PawPrint,
  Users,
  Radio,
  Shield,
  MessageSquare,
} from 'lucide-react';

// Lazy load map for preview
const MapPreview = dynamic(() => import('./MapPreviewMini'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800/50 animate-pulse flex items-center justify-center">
      <MapPin className="text-slate-600" size={32} />
    </div>
  ),
});

export default function SquadHome({
  squad,
  cases,
  announcements,
  chatMessages,
  membership,
  stats,
  divisions,
  squadId,
  onNavigate,
}) {
  const router = useRouter();

  // Pinned announcement
  const pinnedAnnouncement = useMemo(() => {
    return announcements.find(a => a.isPinned);
  }, [announcements]);

  // Urgent cases (missing < 24 hours)
  const urgentCases = useMemo(() => {
    return cases.filter(c => {
      if (c.status === 'REUNITED') return false;
      if (!c.lastSeenAt) return false;
      const hours = (Date.now() - new Date(c.lastSeenAt).getTime()) / 3600000;
      return hours < 24;
    }).slice(0, 5);
  }, [cases]);

  // Recent activity - show more items (up to 10)
  const recentActivity = useMemo(() => {
    const activities = [];

    // Add all announcements (non-pinned)
    announcements.filter(a => !a.isPinned).forEach(a => {
      activities.push({
        type: 'announcement',
        id: `ann-${a.id}`,
        title: a.title || 'Announcement',
        content: a.content,
        time: a.createdAt,
        author: a.authorName,
        isPinned: a.isPinned,
      });
    });

    // Add case events (reunions only - new cases shown separately)
    cases.forEach(c => {
      if (c.status === 'REUNITED') {
        activities.push({
          type: 'reunion',
          id: `reunion-${c.id}`,
          petName: c.petName,
          species: c.species,
          time: c.updatedAt || c.createdAt,
          photoUrl: c.photoUrl,
        });
      }
    });

    // Add recent chat messages as activity
    chatMessages.slice(0, 5).forEach(msg => {
      activities.push({
        type: 'chat',
        id: `chat-${msg.id}`,
        author: msg.authorName || 'Member',
        content: msg.content,
        time: msg.createdAt,
      });
    });

    // Sort by time, most recent first
    return activities
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 10);
  }, [announcements, cases, chatMessages]);

  // Active cases - show more (up to 8)
  const activeCases = useMemo(() => {
    return cases
      .filter(c => c.status === 'ACTIVE' || c.status === 'IN_PROGRESS' || c.status === 'PENDING')
      .sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0))
      .slice(0, 8);
  }, [cases]);

  // Map center
  const mapCenter = useMemo(() => {
    const casesWithLocation = cases.filter(c => c.lastSeenLatitude && c.lastSeenLongitude);
    if (casesWithLocation.length > 0) {
      const avgLat = casesWithLocation.reduce((sum, c) => sum + c.lastSeenLatitude, 0) / casesWithLocation.length;
      const avgLng = casesWithLocation.reduce((sum, c) => sum + c.lastSeenLongitude, 0) / casesWithLocation.length;
      return [avgLat, avgLng];
    }
    if (squad.latitude && squad.longitude) {
      return [squad.latitude, squad.longitude];
    }
    return [30.2672, -97.7431];
  }, [cases, squad]);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Pinned Announcement - Community First */}
      {pinnedAnnouncement && (
        <div className="bg-gradient-to-br from-flash-500/15 via-flash-500/5 to-transparent border border-flash-500/40 rounded-2xl p-4 md:p-5 shadow-lg shadow-flash-500/10">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-flash-500/20 rounded-xl flex-shrink-0">
              <Megaphone className="text-flash-400" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-flash-300">Squad Announcement</span>
                <span className="text-xs bg-flash-500/30 text-flash-300 px-2 py-0.5 rounded-full">Pinned</span>
              </div>
              <p className="text-white leading-relaxed text-sm md:text-base">{pinnedAnnouncement.content}</p>
              <p className="text-slate-500 text-xs mt-2">
                — {pinnedAnnouncement.authorName}, {formatDistanceToNow(new Date(pinnedAnnouncement.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Map Preview + Quick Stats Row */}
      <div className="grid md:grid-cols-3 gap-4 md:gap-5">
        {/* Map Preview - Takes 2 columns on desktop */}
        <div className="md:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="text-flash-400" size={18} />
              <h3 className="font-bold text-white text-sm md:text-base">
                {squad.cityName || 'Squad'} Coverage
              </h3>
            </div>
            <button
              onClick={() => onNavigate('map')}
              className="text-sm text-flash-400 hover:text-flash-300 flex items-center gap-1"
            >
              Full Map <ChevronRight size={14} />
            </button>
          </div>
          <div
            className="h-44 md:h-52 cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => onNavigate('map')}
          >
            <MapPreview
              center={mapCenter}
              cases={activeCases}
              satellite={true}
            />
          </div>
        </div>

        {/* Quick Stats - 1 column on desktop, full width on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
          <QuickStat
            icon={PawPrint}
            value={stats.active}
            label="Active Cases"
            color="red"
            onClick={() => onNavigate('cases')}
          />
          <QuickStat
            icon={Heart}
            value={stats.reunited}
            label="Reunited"
            color="green"
          />
          <QuickStat
            icon={Users}
            value={stats.members}
            label="Members"
            color="blue"
          />
          <QuickStat
            icon={Radio}
            value={stats.onDuty}
            label="On Duty"
            color="flash"
          />
        </div>
      </div>

      {/* Urgent Cases Alert */}
      {urgentCases.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/20 via-red-500/10 to-transparent border border-red-500/30 rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-3 mb-3 md:mb-4">
            <div className="p-2 bg-red-500/20 rounded-xl flex-shrink-0">
              <AlertTriangle className="text-red-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-red-300 text-base md:text-lg">Urgent - Need Help Now</h3>
              <p className="text-red-400/70 text-xs md:text-sm">Missing less than 24 hours</p>
            </div>
          </div>

          <div className="space-y-2">
            {urgentCases.map(c => (
              <CaseCard
                key={c.id}
                caseData={c}
                isUrgent
                onClick={() => router.push(`/mission-control?mission=${c.caseNumber}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout - Cases & Activity */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-5">
        {/* Active Cases List */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PawPrint className="text-flash-400" size={18} />
              <h3 className="font-bold text-white text-sm md:text-base">Active Cases</h3>
              {stats.active > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  {stats.active}
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('cases')}
              className="text-sm text-flash-400 hover:text-flash-300 flex items-center gap-1"
            >
              All <ChevronRight size={14} />
            </button>
          </div>
          <div className="p-2 md:p-3 space-y-1 md:space-y-2 max-h-[350px] md:max-h-[400px] overflow-y-auto">
            {activeCases.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <Heart size={32} className="mx-auto mb-2 opacity-50 text-green-500" />
                <p className="text-sm text-green-400">No active cases!</p>
                <p className="text-xs mt-1">All pets have been found</p>
              </div>
            ) : (
              activeCases.map(c => (
                <CaseCard
                  key={c.id}
                  caseData={c}
                  onClick={() => router.push(`/mission-control?mission=${c.caseNumber}`)}
                />
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-flash-400" size={18} />
              <h3 className="font-bold text-white text-sm md:text-base">Squad Activity</h3>
            </div>
            <button
              onClick={() => onNavigate('community')}
              className="text-sm text-flash-400 hover:text-flash-300 flex items-center gap-1"
            >
              Community <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-700/30 max-h-[350px] md:max-h-[400px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
                <button
                  onClick={() => onNavigate('community')}
                  className="text-xs mt-2 text-flash-400 hover:text-flash-300"
                >
                  Start a conversation →
                </button>
              </div>
            ) : (
              recentActivity.map(activity => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  onCaseClick={(caseNumber) => router.push(`/mission-control?mission=${caseNumber}`)}
                  onCommunityClick={() => onNavigate('community')}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Join CTA for non-members */}
      {!membership?.isMember && (
        <div className="bg-gradient-to-r from-flash-500/20 via-flash-500/10 to-transparent border border-flash-500/30 rounded-2xl p-5 md:p-6">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="p-3 bg-flash-500/20 rounded-xl">
              <Shield className="text-flash-400" size={32} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg md:text-xl font-bold text-white mb-1">
                Join {squad.cityName || ''} Rescue Squad
              </h3>
              <p className="text-slate-400 text-sm">
                Help reunite lost pets with their families in your community
              </p>
            </div>
            <button className="px-6 py-2.5 bg-flash-500 text-midnight-900 font-bold rounded-xl hover:bg-flash-400 transition text-sm md:text-base whitespace-nowrap">
              Join This Squad
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// QUICK STAT - Compact stat display
// ============================================================================

function QuickStat({ icon: Icon, value, label, color, onClick }) {
  const colors = {
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
    green: 'from-green-500/20 to-green-500/5 border-green-500/30 text-green-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
    flash: 'from-flash-500/20 to-flash-500/5 border-flash-500/30 text-flash-400',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        bg-gradient-to-br ${colors[color]} border rounded-xl p-3 md:p-4
        flex items-center gap-3
        ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}
      `}
    >
      <Icon size={20} className="flex-shrink-0" />
      <div className="text-left">
        <div className="text-xl md:text-2xl font-bold text-white">{value}</div>
        <div className="text-xs opacity-80">{label}</div>
      </div>
    </Component>
  );
}

// ============================================================================
// CASE CARD - Compact case display
// ============================================================================

function CaseCard({ caseData, onClick, isUrgent = false }) {
  const speciesEmoji = { DOG: '🐕', CAT: '🐈', BIRD: '🐦', RABBIT: '🐰' }[caseData.species] || '🐾';

  const getTimeMissing = () => {
    if (!caseData.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const timeMissing = getTimeMissing();

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-2.5 md:p-3 rounded-xl text-left transition-colors
        ${isUrgent
          ? 'bg-red-500/10 hover:bg-red-500/20'
          : 'bg-slate-800/30 hover:bg-slate-800/50'
        }
      `}
    >
      {caseData.photoUrl ? (
        <img
          src={caseData.photoUrl}
          alt={caseData.petName}
          className="w-11 h-11 md:w-12 md:h-12 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-11 h-11 md:w-12 md:h-12 rounded-lg bg-slate-700 flex items-center justify-center text-lg flex-shrink-0">
          {speciesEmoji}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm">{caseData.petName}</span>
          {timeMissing && (
            <span className={`text-xs ${isUrgent ? 'text-red-400' : 'text-slate-500'}`}>
              {timeMissing}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate">{caseData.lastSeenAddress || 'Location unknown'}</p>
      </div>

      {caseData.helperCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
          <Users size={12} />
          {caseData.helperCount}
        </div>
      )}

      <ChevronRight className="text-slate-500 flex-shrink-0" size={16} />
    </button>
  );
}

// ============================================================================
// ACTIVITY ITEM - Single activity in the feed
// ============================================================================

function ActivityItem({ activity, onCaseClick, onCommunityClick }) {
  if (activity.type === 'announcement') {
    return (
      <div className="p-3 md:p-4">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone size={14} className="text-flash-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-flash-400">Announcement</span>
        </div>
        <p className="text-white text-sm line-clamp-2">{activity.content}</p>
        <p className="text-slate-500 text-xs mt-1">
          {activity.author} · {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
        </p>
      </div>
    );
  }

  if (activity.type === 'reunion') {
    const speciesEmoji = { DOG: '🐕', CAT: '🐈', BIRD: '🐦', RABBIT: '🐰' }[activity.species] || '🐾';
    return (
      <div className="p-3 md:p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <Heart size={14} className="text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm">
            <span className="font-semibold">{activity.petName}</span>
            <span className="text-green-400"> was reunited!</span> {speciesEmoji}
          </p>
          <p className="text-slate-500 text-xs">
            {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
          </p>
        </div>
      </div>
    );
  }

  if (activity.type === 'chat') {
    return (
      <button
        onClick={onCommunityClick}
        className="w-full p-3 md:p-4 flex items-center gap-3 hover:bg-slate-800/30 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={14} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm">
            <span className="font-semibold text-blue-400">{activity.author}</span>
            <span className="text-slate-400">: </span>
            <span className="text-slate-300 line-clamp-1">{activity.content}</span>
          </p>
          <p className="text-slate-500 text-xs">
            {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
          </p>
        </div>
      </button>
    );
  }

  return null;
}
