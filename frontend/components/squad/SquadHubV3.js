'use client';

/**
 * SquadHubV3 - Redesigned with consistent panel-based approach
 *
 * Matches Mission Control V2 design language:
 * - Always-visible map (zoomed out to show all cases)
 * - Expandable panels for Cases, Members, Squad Chat
 * - Cleaner visual hierarchy
 * - Mobile-responsive bottom sheet for panels
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import ExpandablePanel from '@/components/ui/ExpandablePanel';
import {
  MapPin,
  Users,
  MessageSquare,
  ClipboardList,
  ChevronLeft,
  Settings,
  UserPlus,
  Bell,
} from 'lucide-react';

// Lazy load map
const MapView = dynamic(() => import('@/app/components/case/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  ),
});

export default function SquadHubV3({ initialData, squadId }) {
  const router = useRouter();
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Extract data
  const squad = initialData?.squad || {};
  const divisions = initialData?.divisions || [];
  const allCases = initialData?.cases || [];
  const chatMessages = initialData?.chat?.messages || [];
  const membership = initialData?.membership || {};

  // Calculate stats
  const stats = useMemo(() => {
    const activeMissions = allCases.filter(c =>
      c.status === 'PENDING' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE'
    ).length;
    const reunitedCases = allCases.filter(c => c.status === 'REUNITED').length;

    return {
      active: activeMissions,
      reunited: reunitedCases,
      members: squad.memberCount || 0,
      onDuty: squad.onDutyCount || 0,
    };
  }, [allCases, squad]);

  // Map center - calculate from all cases or use squad location
  const mapCenter = useMemo(() => {
    if (allCases.length > 0) {
      const casesWithLocation = allCases.filter(c => c.lastSeenLatitude && c.lastSeenLongitude);
      if (casesWithLocation.length > 0) {
        const avgLat = casesWithLocation.reduce((sum, c) => sum + c.lastSeenLatitude, 0) / casesWithLocation.length;
        const avgLng = casesWithLocation.reduce((sum, c) => sum + c.lastSeenLongitude, 0) / casesWithLocation.length;
        return [avgLat, avgLng];
      }
    }
    // Default to Austin, TX or squad location
    return squad.latitude && squad.longitude
      ? [squad.latitude, squad.longitude]
      : [30.2672, -97.7431];
  }, [allCases, squad]);

  // Handle case click - go to Mission Control
  const handleMissionClick = (missionData) => {
    router.push(`/mission-control?mission=${missionData.missionNumber || missionData.id}`);
  };

  // Handle join case
  const handleJoinCase = async (missionData, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/cases/${missionData.id}/help`, {
        method: 'POST',
      });
      if (res.ok) {
        router.push(`/mission-control?mission=${missionData.missionNumber || missionData.id}`);
      }
    } catch (err) {
      console.error('Error joining case:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Squad Header */}
      <header className="bg-slate-900/95 border-b border-slate-700/50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => router.push('/rescue-squads')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition"
            >
              <ChevronLeft size={20} />
              <span className="text-sm">Back</span>
            </button>

            <div className="flex items-center gap-2">
              {membership?.role && (
                <button className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white transition">
                  <Settings size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Squad info */}
          <div className="flex items-center gap-4">
            {squad.logoUrl ? (
              <img
                src={squad.logoUrl}
                alt={squad.displayName}
                className="w-14 h-14 rounded-xl object-cover border-2 border-flash-500/30"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-flash-500/20 border-2 border-flash-500/30 flex items-center justify-center text-2xl">
                🐾
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{squad.displayName || 'Rescue Squad'}</h1>
              <p className="text-slate-400 text-sm flex items-center gap-1">
                <MapPin size={14} />
                {squad.cityName || 'Unknown location'}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1 p-3 bg-red-500/10 rounded-xl text-center">
              <div className="text-xl font-bold text-red-400">{stats.active}</div>
              <div className="text-xs text-red-400/70">Active Cases</div>
            </div>
            <div className="flex-1 p-3 bg-green-500/10 rounded-xl text-center">
              <div className="text-xl font-bold text-green-400">{stats.reunited}</div>
              <div className="text-xs text-green-400/70">Reunited</div>
            </div>
            <div className="flex-1 p-3 bg-flash-500/10 rounded-xl text-center">
              <div className="text-xl font-bold text-flash-400">{stats.members}</div>
              <div className="text-xs text-flash-400/70">Members</div>
            </div>
          </div>
        </div>
      </header>

      {/* Map - Always visible, zoomed out to show squad coverage */}
      <div className="relative flex-shrink-0" style={{ height: '40vh', minHeight: '250px' }}>
        <MapView
          center={mapCenter}
          zoom={11} // Zoomed out to show city
          cases={allCases}
          showCaseMarkers={true}
          onCaseClick={handleMissionClick}
        />

        {/* Case count badge */}
        <div className="absolute top-4 right-4 bg-slate-900/90 border border-slate-700/50 rounded-xl px-4 py-2">
          <span className="text-flash-400 font-bold">{stats.active}</span>
          <span className="text-slate-400 text-sm ml-1">active cases</span>
        </div>
      </div>

      {/* Expandable Panels */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-7xl mx-auto">
          <ExpandablePanel
            icon={ClipboardList}
            title="Cases"
            summary={`${stats.active} active, ${stats.reunited} reunited`}
            badge={stats.active > 0 ? `${stats.active} need help` : null}
            badgeColor="red"
            isExpanded={expandedPanel === 'missions'}
            onToggle={(expanded) => setExpandedPanel(expanded ? 'missions' : null)}
          >
            <CasesPanel
              cases={allCases}
              squadId={squadId}
              onCaseClick={handleMissionClick}
              onJoinCase={handleJoinCase}
            />
          </ExpandablePanel>

          <ExpandablePanel
            icon={Users}
            title="Members"
            summary={`${stats.members} total, ${stats.onDuty} active`}
            badge={stats.onDuty > 0 ? `${stats.onDuty} on duty` : null}
            badgeColor="green"
            isExpanded={expandedPanel === 'members'}
            onToggle={(expanded) => setExpandedPanel(expanded ? 'members' : null)}
          >
            <MembersPanel squad={squad} membership={membership} squadId={squadId} />
          </ExpandablePanel>

          <ExpandablePanel
            icon={MessageSquare}
            title="Squad Chat"
            summary={`${chatMessages.length} messages`}
            badge={chatMessages.length > 0 ? 'new' : null}
            badgeColor="flash"
            isExpanded={expandedPanel === 'chat'}
            onToggle={(expanded) => setExpandedPanel(expanded ? 'chat' : null)}
          >
            <SquadChatPanel squadId={squadId} messages={chatMessages} />
          </ExpandablePanel>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CASES PANEL - List of all squad cases
// ============================================================================
function CasesPanel({ cases, squadId, onCaseClick, onJoinCase }) {
  const [filter, setFilter] = useState('active');

  const filteredCases = cases.filter(c => {
    if (filter === 'active') {
      return c.status === 'PENDING' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE';
    }
    return c.status === 'REUNITED';
  });

  const getSpeciesEmoji = (species) => {
    return { DOG: '🐕', CAT: '🐈', BIRD: '🐦', RABBIT: '🐰' }[species] || '🐾';
  };

  const getTimeMissing = (lastSeenAt) => {
    if (!lastSeenAt) return 'Unknown';
    const hours = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
            filter === 'active'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-slate-800/50 text-slate-400'
          }`}
        >
          Active ({cases.filter(c => c.status !== 'REUNITED').length})
        </button>
        <button
          onClick={() => setFilter('reunited')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
            filter === 'reunited'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-slate-800/50 text-slate-400'
          }`}
        >
          Reunited ({cases.filter(c => c.status === 'REUNITED').length})
        </button>
      </div>

      {/* Cases list */}
      {filteredCases.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">{filter === 'active' ? '🎉' : '🐾'}</div>
          <p className="text-slate-400">
            {filter === 'active' ? 'No active cases!' : 'No reunited cases yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCases.map((missionData) => (
            <button
              key={missionData.id}
              onClick={() => onCaseClick(missionData)}
              className="w-full text-left p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-flash-500/30 transition flex items-center gap-3"
            >
              {/* Pet photo or emoji */}
              {missionData.photoUrl ? (
                <img
                  src={missionData.photoUrl}
                  alt={missionData.petName}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-xl flex-shrink-0">
                  {getSpeciesEmoji(missionData.species)}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{missionData.petName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    missionData.status === 'REUNITED'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {missionData.status === 'REUNITED' ? 'Reunited' : 'Missing'}
                  </span>
                </div>
                <p className="text-slate-500 text-xs truncate">{missionData.lastSeenAddress}</p>
                <p className="text-slate-500 text-xs">{getTimeMissing(missionData.lastSeenAt)}</p>
              </div>

              {/* Join button for active cases */}
              {missionData.status !== 'REUNITED' && (
                <button
                  onClick={(e) => onJoinCase(missionData, e)}
                  className="px-3 py-1.5 bg-flash-500 text-midnight-900 text-xs font-bold rounded-lg flex-shrink-0"
                >
                  Join
                </button>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MEMBERS PANEL - Squad members
// ============================================================================
function MembersPanel({ squad, membership, squadId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/rescue-squads/${squadId}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
        }
      } catch (err) {
        console.error('Error fetching members:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [squadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-flash-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const getRoleBadge = (role) => {
    const roles = {
      FOUNDER: { label: 'Founder', color: 'text-purple-400 bg-purple-500/20' },
      LEADER: { label: 'Leader', color: 'text-flash-400 bg-flash-500/20' },
      COORDINATOR: { label: 'Coordinator', color: 'text-blue-400 bg-blue-500/20' },
      MEMBER: { label: 'Member', color: 'text-slate-400 bg-slate-500/20' },
    };
    return roles[role] || roles.MEMBER;
  };

  return (
    <div className="space-y-4">
      {/* Join button if not a member */}
      {!membership?.role && (
        <button className="w-full py-3 bg-flash-500 text-midnight-900 font-bold rounded-xl flex items-center justify-center gap-2">
          <UserPlus size={18} />
          Join This Squad
        </button>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-slate-400">No members yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.slice(0, 20).map((member) => {
            const role = getRoleBadge(member.role);
            return (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-flash-500/20 flex items-center justify-center text-flash-400 font-bold">
                  {member.user?.firstName?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">
                    {member.user?.firstName} {member.user?.lastName}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${role.color}`}>
                    {role.label}
                  </span>
                </div>
                {member.isOnDuty && (
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                )}
              </div>
            );
          })}
          {members.length > 20 && (
            <p className="text-center text-slate-500 text-sm">
              +{members.length - 20} more members
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SQUAD CHAT PANEL - Squad-wide messaging
// ============================================================================
function SquadChatPanel({ squadId, messages: initialMessages }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-80">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-slate-400">No messages yet</p>
            <p className="text-slate-500 text-sm mt-1">Say hello to your squad!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-flash-400 text-sm font-semibold">
                  {msg.user?.firstName || 'Member'}
                </span>
                <span className="text-slate-500 text-xs">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <p className="text-white text-sm">{msg.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Message your squad..."
          className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-4 bg-flash-500 text-midnight-900 rounded-xl font-bold disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
