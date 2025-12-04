'use client';

/**
 * FeedTabV4 - Main Feed Tab (Default)
 *
 * A scrollable feed showing:
 * - New case alerts (clickable to mission control)
 * - Case updates and sightings
 * - Reunion celebrations
 * - Community activity
 *
 * Mobile-first, easy to scroll and tap
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import {
  AlertTriangle,
  MapPin,
  Clock,
  Heart,
  Eye,
  MessageSquare,
  ChevronRight,
  Megaphone,
  PawPrint,
  Users,
  Radio,
  Shield,
  Sparkles,
} from 'lucide-react';

// ============================================================================
// Helpers - Must be defined before component to avoid hoisting issues
// ============================================================================

function getSpeciesEmoji(species) {
  const emojis = { DOG: '🐕', CAT: '🐈', BIRD: '🐦', RABBIT: '🐰', OTHER: '🐾' };
  return emojis[species] || '🐾';
}

function safeFormatTime(dateValue) {
  if (!dateValue) return null;
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return null;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

function safeParseDate(dateValue) {
  if (!dateValue) return null;
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

function getHoursSince(dateValue) {
  const date = safeParseDate(dateValue);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 3600000);
}

export default function FeedTabV4({
  squad,
  cases,
  announcements,
  chatMessages,
  membership,
  stats,
  divisions,
}) {
  const router = useRouter();

  // Build feed items from various sources
  const feedItems = useMemo(() => {
    const items = [];

    // Add active/pending cases as "New Case" or "Active Case" items
    cases.forEach(c => {
      if (c.status === 'PENDING') {
        items.push({
          type: 'new_case',
          id: `case-new-${c.id}`,
          caseData: c,
          time: c.createdAt,
          priority: 1, // Highest priority
        });
      } else if (c.status === 'ACTIVE' || c.status === 'IN_PROGRESS') {
        // Check if urgent (< 24 hours)
        const hours = getHoursSince(c.lastSeenAt);
        const isUrgent = hours !== null && hours < 24;

        items.push({
          type: isUrgent ? 'urgent_case' : 'active_case',
          id: `case-active-${c.id}`,
          caseData: c,
          time: c.lastSeenAt || c.createdAt,
          priority: isUrgent ? 2 : 3,
        });
      } else if (c.status === 'REUNITED') {
        items.push({
          type: 'reunion',
          id: `reunion-${c.id}`,
          caseData: c,
          time: c.updatedAt || c.createdAt,
          priority: 4,
        });
      }
    });

    // Add pinned announcements
    announcements.filter(a => a.isPinned).forEach(a => {
      items.push({
        type: 'announcement',
        id: `ann-${a.id}`,
        announcement: a,
        time: a.createdAt,
        priority: 0, // Always at top
        isPinned: true,
      });
    });

    // Add recent chat messages as activity
    chatMessages.slice(0, 3).forEach(msg => {
      items.push({
        type: 'chat',
        id: `chat-${msg.id}`,
        message: msg,
        time: msg.createdAt,
        priority: 5,
      });
    });

    // Sort: pinned first, then by priority, then by time
    return items.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      const dateA = safeParseDate(b.time);
      const dateB = safeParseDate(a.time);
      if (!dateA && !dateB) return 0;
      if (!dateA) return -1;
      if (!dateB) return 1;
      return dateA.getTime() - dateB.getTime();
    });
  }, [cases, announcements, chatMessages]);

  // Separate urgent cases for the top alert
  const urgentCases = useMemo(() => {
    return cases.filter(c => {
      if (c.status === 'REUNITED') return false;
      const hours = getHoursSince(c.lastSeenAt);
      return hours !== null && hours < 24;
    });
  }, [cases]);

  return (
    <div className="h-full overflow-y-auto bg-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-4">

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-4 gap-2">
          <QuickStat icon={PawPrint} value={stats.active} label="Active" color="red" />
          <QuickStat icon={Heart} value={stats.reunited} label="Found" color="green" />
          <QuickStat icon={Users} value={stats.members} label="Members" color="blue" />
          <QuickStat icon={Radio} value={stats.onDuty} label="On Duty" color="flash" />
        </div>

        {/* Urgent Alert Banner */}
        {urgentCases.length > 0 && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-400 animate-pulse" size={18} />
              <span className="text-red-400 font-bold text-sm uppercase tracking-wide">
                {urgentCases.length} Urgent - Need Help Now
              </span>
            </div>
            <p className="text-slate-300 text-sm">
              These pets went missing in the last 24 hours. Time is critical!
            </p>
          </div>
        )}

        {/* Feed Items */}
        <div className="space-y-3">
          {feedItems.length === 0 ? (
            <EmptyFeed membership={membership} squadName={squad.cityName} />
          ) : (
            feedItems.map(item => (
              <FeedItem
                key={item.id}
                item={item}
                onCaseClick={(caseNumber) => router.push(`/mission-control?mission=${caseNumber}`)}
                divisions={divisions}
              />
            ))
          )}
        </div>

        {/* Join CTA for non-members */}
        {!membership?.isMember && (
          <JoinSquadCTA squadName={squad.cityName} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Stat Component
// ============================================================================

function QuickStat({ icon: Icon, value, label, color }) {
  const colors = {
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    flash: 'bg-flash-500/10 border-flash-500/30 text-flash-400',
  };

  return (
    <div className={`${colors[color]} border rounded-xl p-3 text-center`}>
      <Icon size={16} className="mx-auto mb-1" />
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

// ============================================================================
// Feed Item Component
// ============================================================================

function FeedItem({ item, onCaseClick, divisions }) {
  switch (item.type) {
    case 'new_case':
      return <NewCaseCard caseData={item.caseData} onClick={() => onCaseClick(item.caseData.caseNumber)} />;
    case 'urgent_case':
      return <UrgentCaseCard caseData={item.caseData} onClick={() => onCaseClick(item.caseData.caseNumber)} />;
    case 'active_case':
      return <ActiveCaseCard caseData={item.caseData} onClick={() => onCaseClick(item.caseData.caseNumber)} />;
    case 'reunion':
      return <ReunionCard caseData={item.caseData} />;
    case 'announcement':
      return <AnnouncementCard announcement={item.announcement} />;
    case 'chat':
      return <ChatActivityCard message={item.message} divisions={divisions} />;
    default:
      return null;
  }
}

// ============================================================================
// New Case Card - Incoming case that needs attention
// ============================================================================

function NewCaseCard({ caseData, onClick }) {
  const speciesEmoji = getSpeciesEmoji(caseData.species);

  return (
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-2 border-amber-500/50 rounded-xl p-4 text-left hover:border-amber-400 transition-all group"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="text-amber-400" size={16} />
        <span className="text-amber-400 font-bold text-xs uppercase tracking-wide">New Case - Just Reported</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Pet Photo */}
        {caseData.photoUrl ? (
          <img
            src={caseData.photoUrl}
            alt={caseData.petName}
            className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500/30"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-amber-500/30 flex items-center justify-center text-2xl">
            {speciesEmoji}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white mb-1">{caseData.petName}</h3>
          <p className="text-slate-400 text-sm flex items-center gap-1.5 mb-1">
            <MapPin size={12} />
            <span className="truncate">{caseData.lastSeenAddress || 'Location pending'}</span>
          </p>
          {safeFormatTime(caseData.createdAt) && (
            <p className="text-amber-400/80 text-xs">
              Reported {safeFormatTime(caseData.createdAt)}
            </p>
          )}
        </div>

        <ChevronRight className="text-amber-400 group-hover:translate-x-1 transition-transform" size={24} />
      </div>
    </button>
  );
}

// ============================================================================
// Urgent Case Card - Missing < 24 hours
// ============================================================================

function UrgentCaseCard({ caseData, onClick }) {
  const speciesEmoji = getSpeciesEmoji(caseData.species);
  const hoursMissing = getHoursSince(caseData.lastSeenAt);

  return (
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-r from-red-500/20 to-red-500/5 border-2 border-red-500/50 rounded-xl p-4 text-left hover:border-red-400 transition-all group animate-pulse-subtle"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="text-red-400" size={16} />
        <span className="text-red-400 font-bold text-xs uppercase tracking-wide">
          Urgent - {hoursMissing !== null ? `${hoursMissing}h missing` : 'Missing'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {caseData.photoUrl ? (
          <img
            src={caseData.photoUrl}
            alt={caseData.petName}
            className="w-16 h-16 rounded-xl object-cover border-2 border-red-500/30"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-red-500/30 flex items-center justify-center text-2xl">
            {speciesEmoji}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white mb-1">{caseData.petName}</h3>
          <p className="text-slate-400 text-sm flex items-center gap-1.5">
            <MapPin size={12} />
            <span className="truncate">{caseData.lastSeenAddress || 'Unknown'}</span>
          </p>
        </div>

        <ChevronRight className="text-red-400 group-hover:translate-x-1 transition-transform" size={24} />
      </div>
    </button>
  );
}

// ============================================================================
// Active Case Card - Standard active case
// ============================================================================

function ActiveCaseCard({ caseData, onClick }) {
  const speciesEmoji = getSpeciesEmoji(caseData.species);

  const getTimeMissing = () => {
    const hours = getHoursSince(caseData.lastSeenAt);
    if (hours === null) return null;
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-left hover:bg-slate-800 hover:border-slate-600 transition-all group"
    >
      <div className="flex items-center gap-4">
        {caseData.photoUrl ? (
          <img
            src={caseData.photoUrl}
            alt={caseData.petName}
            className="w-14 h-14 rounded-xl object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center text-xl">
            {speciesEmoji}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white">{caseData.petName}</h3>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
              {getTimeMissing() || 'Active'}
            </span>
          </div>
          <p className="text-slate-400 text-sm flex items-center gap-1.5">
            <MapPin size={12} />
            <span className="truncate">{caseData.lastSeenAddress || 'Unknown'}</span>
          </p>
        </div>

        <ChevronRight className="text-slate-500 group-hover:text-flash-400 group-hover:translate-x-1 transition-all" size={20} />
      </div>
    </button>
  );
}

// ============================================================================
// Reunion Card - Celebration!
// ============================================================================

function ReunionCard({ caseData }) {
  const speciesEmoji = getSpeciesEmoji(caseData.species);

  return (
    <div className="bg-gradient-to-r from-green-500/15 to-emerald-500/5 border border-green-500/30 rounded-xl p-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          {caseData.photoUrl ? (
            <img
              src={caseData.photoUrl}
              alt={caseData.petName}
              className="w-14 h-14 rounded-xl object-cover border-2 border-green-500/30"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-800 border-2 border-green-500/30 flex items-center justify-center text-xl">
              {speciesEmoji}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <Heart size={12} className="text-white" />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-400 font-bold">{caseData.petName}</span>
            <span className="text-green-400">was reunited!</span>
          </div>
          {safeFormatTime(caseData.updatedAt || caseData.createdAt) && (
            <p className="text-slate-500 text-sm">
              {safeFormatTime(caseData.updatedAt || caseData.createdAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Announcement Card
// ============================================================================

function AnnouncementCard({ announcement }) {
  return (
    <div className="bg-gradient-to-r from-flash-500/15 to-flash-500/5 border border-flash-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-flash-500/20 rounded-lg flex-shrink-0">
          <Megaphone className="text-flash-400" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-flash-400 font-bold text-xs uppercase">Pinned</span>
          </div>
          {announcement.title && (
            <h4 className="font-bold text-white mb-1">{announcement.title}</h4>
          )}
          <p className="text-slate-200 text-sm leading-relaxed">{announcement.content}</p>
          <p className="text-slate-500 text-xs mt-2">
            {announcement.authorName}{safeFormatTime(announcement.createdAt) ? ` · ${safeFormatTime(announcement.createdAt)}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Chat Activity Card
// ============================================================================

function ChatActivityCard({ message, divisions }) {
  const division = divisions?.find(d => d.id === message.divisionId);

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={14} className="text-blue-400" />
        <span className="text-white font-medium text-sm">{message.authorName}</span>
        {division && (
          <span className="text-xs text-flash-400 bg-flash-500/20 px-1.5 py-0.5 rounded">
            {division.name}
          </span>
        )}
        {safeFormatTime(message.createdAt) && (
          <span className="text-slate-500 text-xs ml-auto">
            {safeFormatTime(message.createdAt)}
          </span>
        )}
      </div>
      <p className="text-slate-300 text-sm line-clamp-2">{message.content}</p>
    </div>
  );
}

// ============================================================================
// Empty Feed State
// ============================================================================

function EmptyFeed({ membership, squadName }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">🐾</div>
      <h3 className="text-xl font-bold text-white mb-2">All Clear!</h3>
      <p className="text-slate-400 mb-6">
        No active cases in {squadName || 'this area'}. Great news!
      </p>
      {membership?.isMember && (
        <button
          onClick={() => window.location.href = '/cases/report'}
          className="px-6 py-3 bg-flash-500 text-slate-900 font-bold rounded-xl hover:bg-flash-400 transition-colors"
        >
          Report a Lost Pet
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Join Squad CTA
// ============================================================================

function JoinSquadCTA({ squadName }) {
  return (
    <div className="bg-gradient-to-r from-flash-500/20 to-flash-500/5 border border-flash-500/30 rounded-xl p-5 text-center">
      <Shield className="text-flash-400 mx-auto mb-3" size={32} />
      <h3 className="font-bold text-white text-lg mb-2">
        Join {squadName || ''} Rescue Squad
      </h3>
      <p className="text-slate-400 text-sm mb-4">
        Help reunite lost pets with their families
      </p>
      <button className="w-full px-4 py-3 bg-flash-500 text-slate-900 font-bold rounded-xl hover:bg-flash-400 transition-colors">
        Join This Squad
      </button>
    </div>
  );
}

