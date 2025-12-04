'use client';

/**
 * Mission Control V2 - Redesigned interface
 * 
 * Uses the new MapLayout shared component for consistent UI.
 * Implements "Dive In" effect and smooth panel transitions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Shared Components
import MapLayout from '@/components/ui/Layout/MapLayout';
import ExpandablePanel, { PanelGrid } from '@/components/ui/ExpandablePanel';
import CaseRail from '@/components/ui/CaseRail';
import CaseHeader from '@/components/ui/CaseHeader';
import { MissionBottomSheet } from '@/components/ui/BottomSheet';
import WaiverModal from '@/components/WaiverModal';
import { PageLoading } from '@/components/LoadingSkeleton';
import { fetchWithRetry, formatErrorMessage, isOnline } from '@/app/lib/utils';

// Icons
import {
  ClipboardList,
  Eye,
  Users,
  MessageSquare,
  Navigation,
  AlertCircle,
  RefreshCw,
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

export default function MissionControlV2() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');

  // Core state
  const [activeMission, setActiveMission] = useState(null);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [activePanel, setActivePanel] = useState(null); // { title, content }
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // GPS state
  const [isGPSTracking, setIsGPSTracking] = useState(false);
  const [gpsPath, setGpsPath] = useState([]);

  // Check mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch available missions
  const fetchAvailableMissions = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetchWithRetry('/api/cases/my-missions');
      if (res.ok) {
        const data = await res.json();
        setAvailableMissions(data.missions || []);
      }
    } catch (err) {
      console.error('Error fetching missions:', err);
    }
  }, [session]);

  // Fetch specific mission
  const fetchMission = useCallback(async (id) => {
    if (!id) return;
    setSwitching(true);
    setError(null);
    setActivePanel(null); // Close panels on switch

    try {
      if (!isOnline()) {
        setError('You are offline. Please check your connection.');
        setSwitching(false);
        setLoading(false);
        return;
      }

      const res = await fetchWithRetry(`/api/cases/${id}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Mission not found');
        } else if (res.status === 403) {
          const errorData = await res.json().catch(() => ({}));
          if (!errorData || errorData.code === 'WAIVER_NOT_ACCEPTED') {
            setShowWaiverModal(true);
            setSwitching(false);
            setLoading(false);
            return;
          }
          throw new Error(errorData.message || 'Permission denied');
        }
        throw new Error(`Failed to load mission (${res.status})`);
      }

      const data = await res.json();
      setActiveMission(data);
      setError(null);

      // Fetch sightings
      fetchSightings(data.id);
    } catch (err) {
      console.error('Error fetching mission:', err);
      setError(formatErrorMessage(err));
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  }, []);

  const fetchSightings = async (caseId) => {
    if (!caseId) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/sightings`);
      if (res.ok) {
        const data = await res.json();
        setSightings(data.sightings || []);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAvailableMissions();
  }, [fetchAvailableMissions]);

  // Load mission on URL change
  useEffect(() => {
    if (missionId) {
      fetchMission(missionId);
    } else {
      setLoading(false);
      setActiveMission(null);
    }
  }, [missionId, fetchMission]);

  // Handlers
  const handleMissionSwitch = (newMissionId) => {
    if (newMissionId === missionId) return;
    router.push(`/mission-control?mission=${newMissionId}`, { scroll: false });
  };

  const handleBackToSquad = () => {
    const squadId = activeMission?.assignments?.[0]?.rescueSquadId;
    if (squadId) {
      router.push(`/rescue-squads/${squadId}`);
    } else {
      router.push('/rescue-squads');
    }
  };

  // Panels
  const openPanel = (id, title, content) => {
    if (activePanel?.id === id) {
      setActivePanel(null);
    } else {
      setActivePanel({ id, title, content });
    }
  };

  // Stats
  const stats = useMemo(() => {
    if (!activeMission) return {};
    const team = activeMission.assignments?.flatMap(a => a.participants || []) || [];
    const uniqueTeam = [...new Map(team.map(p => [p.userId, p])).values()];
    return {
      tasksCompleted: 0, // Placeholder
      tasksTotal: 25,
      sightingsCount: sightings.length,
      teamCount: uniqueTeam.length,
      activeTeam: uniqueTeam.filter(p => p.isActive).length,
    };
  }, [activeMission, sightings]);

  // Render
  if (loading) return <PageLoading message="Loading Mission Control..." />;

  if (showWaiverModal && !activeMission) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <WaiverModal
          isOpen={showWaiverModal}
          onClose={() => {
            setShowWaiverModal(false);
            router.push('/mission-control');
          }}
          onAccepted={() => {
            setShowWaiverModal(false);
            if (missionId) fetchMission(missionId);
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800/50 border border-red-500/30 rounded-2xl p-8 text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Mission</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                if (missionId) fetchMission(missionId);
              }}
              className="flex-1 py-3 bg-flash-500 text-midnight-900 font-bold rounded-xl"
            >
              <RefreshCw size={18} className="inline mr-2" />
              Retry
            </button>
            <button
              onClick={handleBackToSquad}
              className="flex-1 py-3 bg-slate-700 text-white rounded-xl"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeMission) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Mission Control</h1>
          <p className="text-slate-400 mb-8">Select a mission to begin</p>
          {availableMissions.length > 0 ? (
            <div className="grid gap-4 max-w-md mx-auto">
              {availableMissions.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleMissionSwitch(m.id)}
                  className="p-4 bg-slate-800 rounded-xl hover:bg-slate-700 text-left"
                >
                  <div className="font-bold text-white">{m.petName}</div>
                  <div className="text-sm text-slate-400">{m.lastSeenAddress}</div>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => router.push('/rescue-squads')}
              className="px-6 py-3 bg-flash-500 text-midnight-900 font-bold rounded-xl"
            >
              Find a Rescue Squad
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <MapLayout
      activePanel={activePanel}
      onPanelClose={() => setActivePanel(null)}
      headerComponent={
        <CaseHeader
          caseData={activeMission}
          onBack={handleBackToSquad}
        />
      }
      railComponent={
        <CaseRail
          missions={availableMissions}
          activeMissionId={activeMission.id}
          onSelectMission={handleMissionSwitch}
        />
      }
      mapComponent={
        <MapView
          center={
            activeMission?.lastSeenLatitude
              ? [activeMission.lastSeenLatitude, activeMission.lastSeenLongitude]
              : [41.8781, -87.6298]
          }
          zoom={16} // Zoomed in for "Dive In" effect
          lastSeen={{
            lat: activeMission.lastSeenLatitude,
            lng: activeMission.lastSeenLongitude,
            address: activeMission.lastSeenAddress,
          }}
          sightings={sightings}
          gpsPath={gpsPath}
          petSpecies={activeMission?.petSpecies}
          showControls
        />
      }
    >
      {/* Floating Action Buttons */}
      <div className="absolute bottom-24 right-4 md:bottom-8 md:right-8 flex flex-col gap-3 pointer-events-auto">
        <button
          onClick={() => openPanel('sightings', 'Sightings', <div>Sightings Content</div>)}
          className="w-14 h-14 rounded-full bg-amber-500 text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Eye size={24} />
        </button>
        <button
          onClick={() => setIsGPSTracking(!isGPSTracking)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform ${isGPSTracking ? 'bg-green-500 animate-pulse' : 'bg-purple-500'
            } text-white`}
        >
          <Navigation size={24} />
        </button>
      </div>

      {/* Panel Triggers (Bottom Bar) */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent pointer-events-auto">
        <PanelGrid>
          <ExpandablePanel
            icon={ClipboardList}
            title="Tasks"
            summary={`${stats.tasksCompleted}/${stats.tasksTotal} done`}
            isExpanded={activePanel?.id === 'tasks'}
            onToggle={() => openPanel('tasks', 'Tasks', <div>Tasks Content Placeholder</div>)}
          />
          <ExpandablePanel
            icon={Eye}
            title="Sightings"
            summary={`${sightings.length} reported`}
            isExpanded={activePanel?.id === 'sightings'}
            onToggle={() => openPanel('sightings', 'Sightings', <div>Sightings Content Placeholder</div>)}
          />
          <ExpandablePanel
            icon={Users}
            title="Team"
            summary={`${stats.teamCount} helpers`}
            isExpanded={activePanel?.id === 'team'}
            onToggle={() => openPanel('team', 'Team', <div>Team Content Placeholder</div>)}
          />
          <ExpandablePanel
            icon={MessageSquare}
            title="Chat"
            summary="Discussion"
            isExpanded={activePanel?.id === 'chat'}
            onToggle={() => openPanel('chat', 'Chat', <div>Chat Content Placeholder</div>)}
          />
        </PanelGrid>
      </div>

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <MissionBottomSheet
          missions={availableMissions}
          activeMissionId={activeMission.id}
          onSelectMission={handleMissionSwitch}
          isOpen={bottomSheetOpen}
          onOpen={() => setBottomSheetOpen(true)}
          onClose={() => setBottomSheetOpen(false)}
        />
      )}
    </MapLayout>
  );
}

// ============================================================================
// TEAM PANEL - View helpers on the case
// ============================================================================
function TeamPanel({ caseData }) {
  const team = caseData?.assignments?.flatMap(a => a.participants || []) || [];
  const uniqueTeam = [...new Map(team.map(p => [p.userId, p])).values()];
  const activeCount = uniqueTeam.filter(p => p.isActive).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 p-3 bg-slate-800/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{uniqueTeam.length}</div>
          <div className="text-xs text-slate-400">Total Helpers</div>
        </div>
        <div className="flex-1 p-3 bg-green-500/10 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-400">{activeCount}</div>
          <div className="text-xs text-green-400/70">Active Now</div>
        </div>
      </div>

      {/* Team list */}
      {uniqueTeam.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-slate-400">No team members yet</p>
          <p className="text-slate-500 text-sm mt-1">Share this case to get help!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {uniqueTeam.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-flash-500/20 flex items-center justify-center text-flash-400 font-bold">
                {member.user?.firstName?.[0] || '?'}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">
                  {member.user?.firstName} {member.user?.lastName}
                </p>
                <p className="text-slate-500 text-xs">
                  {member.role || 'Helper'}
                </p>
              </div>
              {member.isActive && (
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Active
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHAT PANEL - Case-specific messaging
// ============================================================================
function ChatPanel({ caseId, session }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}/chat`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Error fetching chat:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    // Poll for new messages
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [caseId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/chat`, {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-flash-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-80">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-slate-400">No messages yet</p>
            <p className="text-slate-500 text-sm mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.userId === session?.user?.id;
            return (
              <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-xl ${isMe
                    ? 'bg-flash-500/20 text-flash-100'
                    : 'bg-slate-800 text-white'
                  }`}>
                  {!isMe && (
                    <p className="text-xs text-flash-400 mb-1 font-semibold">
                      {msg.user?.firstName || 'Helper'}
                    </p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-4 bg-flash-500 text-midnight-900 rounded-xl font-bold disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
