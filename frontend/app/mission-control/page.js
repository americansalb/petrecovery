'use client';

/**
 * MISSION CONTROL - Single persistent command center for all rescue missions
 *
 * Revolutionary approach: Instead of navigating between case pages,
 * stay in one persistent UI and switch which mission you're viewing.
 *
 * Features:
 * - Mission selector dropdown for fast switching
 * - Smooth transitions between missions
 * - All CaseCommandCenterV2 features preserved
 * - URL-based mission selection (?mission=ID)
 * - Mobile responsive design
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import MissionSelector from '@/components/mission/MissionSelector';
import MissionHero from '@/components/mission/MissionHero';
import MissionTabs from '@/components/mission/MissionTabs';
import WaiverModal from '@/components/WaiverModal';
import { PageLoading } from '@/components/LoadingSkeleton';
import { fetchWithRetry, formatErrorMessage, isOnline } from '@/app/lib/utils';
import { AlertCircle, Shield, RefreshCw, Rocket } from 'lucide-react';

function MissionControlContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');

  // Mission state
  const [activeMission, setActiveMission] = useState(null);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [showWaiverModal, setShowWaiverModal] = useState(false);

  // Fetch available missions for the user
  const fetchAvailableMissions = useCallback(async () => {
    try {
      if (!session?.user) return;

      const res = await fetchWithRetry('/api/cases/my-missions');
      if (res.ok) {
        const data = await res.json();
        setAvailableMissions(data.missions || []);
      }
    } catch (err) {
      console.error('Error fetching available missions:', err);
    }
  }, [session]);

  // Fetch specific mission data
  const fetchMission = useCallback(async (id) => {
    if (!id) return;

    setSwitching(true);
    setError(null);

    try {
      if (!isOnline()) {
        setError('You are offline. Please check your internet connection.');
        setSwitching(false);
        setLoading(false);
        return;
      }

      const res = await fetchWithRetry(`/api/cases/${id}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Mission not found');
        } else if (res.status === 403) {
          let errorData = null;
          try {
            errorData = await res.json();
          } catch (jsonError) {
            console.error('Failed to parse 403 response:', jsonError);
          }

          // Show waiver modal
          if (!errorData || errorData.code === 'WAIVER_NOT_ACCEPTED' || errorData.message?.includes('waiver')) {
            setShowWaiverModal(true);
            setSwitching(false);
            setLoading(false);
            return;
          }

          throw new Error(errorData.message || 'You do not have permission to view this mission');
        } else {
          throw new Error(`Failed to load mission (${res.status})`);
        }
      }

      const data = await res.json();
      setActiveMission(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching mission:', err);
      setError(formatErrorMessage(err));
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAvailableMissions();
  }, [fetchAvailableMissions]);

  // Load mission when URL changes
  useEffect(() => {
    if (missionId) {
      fetchMission(missionId);
    } else {
      setLoading(false);
      setActiveMission(null);
    }
  }, [missionId, fetchMission]);

  // Handle mission switch
  const handleMissionSwitch = (newMissionId) => {
    if (newMissionId === missionId) return;
    router.push(`/mission-control?mission=${newMissionId}`, { scroll: false });
  };

  // Handle waiver acceptance
  const handleWaiverAccepted = () => {
    setShowWaiverModal(false);
    if (missionId) {
      fetchMission(missionId);
    }
  };

  // Handle joining mission
  const handleJoinMission = async (missionIdToJoin) => {
    try {
      // Need squadId - get it from the mission data
      const squadId = activeMission?.rescueSquadId || activeMission?.squadId;

      if (!squadId) {
        alert('Unable to join mission: Squad information missing');
        console.error('Mission missing squadId:', activeMission);
        return;
      }

      const res = await fetchWithRetry(`/api/rescue-squads/${squadId}/cases/${missionIdToJoin}/help`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to join mission:', errorData);
        alert(errorData.error || errorData.message || 'Failed to join mission. Please try again.');
        return;
      }

      // Refresh mission data to show updated helper status
      await fetchMission(missionId);
      await fetchAvailableMissions();

      // Success feedback
      alert(`You've joined the rescue mission for ${activeMission.petName}! 🚀`);
    } catch (err) {
      console.error('Error joining mission:', err);
      alert('Failed to join mission. Please check your connection and try again.');
    }
  };

  // Loading state
  if (loading) {
    return <PageLoading message="Initializing Mission Control..." />;
  }

  // Waiver modal (no mission loaded yet)
  if (showWaiverModal && !activeMission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="inline-block p-4 bg-flash-500/20 rounded-full border-2 border-flash-500/50">
              <Shield size={48} className="text-flash-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Liability Waiver Required
          </h2>
          <p className="text-slate-400 mb-6">
            Please accept the liability waiver to view mission details and join the rescue effort.
          </p>
        </div>

        <WaiverModal
          isOpen={showWaiverModal}
          onClose={() => {
            setShowWaiverModal(false);
            router.push('/mission-control');
          }}
          onAccepted={handleWaiverAccepted}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border-2 border-red-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-500/20 rounded-full border-2 border-red-500/50">
              <AlertCircle size={48} className="text-red-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white text-center mb-3">
            Unable to Load Mission
          </h2>
          <p className="text-red-300 text-center mb-8">
            {error}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                if (missionId) fetchMission(missionId);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 font-bold rounded-xl hover:scale-105 transition shadow-lg shadow-flash-500/30"
            >
              <RefreshCw size={20} />
              Try Again
            </button>
            <button
              onClick={() => router.push('/mission-control')}
              className="px-6 py-3 bg-slate-800/80 text-slate-300 font-bold rounded-xl hover:bg-slate-800 hover:text-white transition border-2 border-slate-700"
            >
              Back to Mission Control
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b-2 border-flash-500/30 shadow-lg shadow-flash-500/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Mission Control Title */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-flash-500 to-flash-600 shadow-lg shadow-flash-500/30">
                <Rocket size={24} className="text-midnight-900" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">
                <span className="text-white">MISSION </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-400 to-flash-500">
                  CONTROL
                </span>
              </h1>
            </div>

            {/* Mission Selector */}
            <MissionSelector
              missions={availableMissions}
              activeMission={activeMission}
              onSwitch={handleMissionSwitch}
              onRefresh={fetchAvailableMissions}
            />
          </div>
        </div>
      </div>

      {/* Mission Content */}
      {activeMission ? (
        <>
          {/* Switching overlay */}
          {switching && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-40 animate-fadeIn">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-flash-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white font-semibold text-lg">Switching mission...</p>
                <p className="text-slate-400 text-sm mt-2">Loading {activeMission?.petName}'s data</p>
              </div>
            </div>
          )}

          {/* Mission Hero - Always visible key info */}
          <MissionHero
            mission={activeMission}
            session={session}
            onJoinMission={handleJoinMission}
          />

          {/* Mission Tabs - Main content area */}
          <MissionTabs
            mission={activeMission}
            onRefresh={() => fetchMission(missionId)}
            session={session}
          />
        </>
      ) : (
        <EmptyState
          missions={availableMissions}
          onSelectMission={handleMissionSwitch}
          onRefresh={fetchAvailableMissions}
        />
      )}

      {/* Waiver Modal */}
      {showWaiverModal && (
        <WaiverModal
          isOpen={showWaiverModal}
          onClose={() => setShowWaiverModal(false)}
          onAccepted={handleWaiverAccepted}
        />
      )}
    </div>
  );
}

// Empty state when no mission selected
function EmptyState({ missions, onSelectMission, onRefresh }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-flash-500/20 to-flash-600/20 border-2 border-flash-500/30 mb-6">
          <Rocket size={40} className="text-flash-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">
          Welcome to Mission Control
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Your command center for coordinating rescue missions. Select a mission above to get started.
        </p>
      </div>

      {/* Available Missions */}
      {missions && missions.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Active Missions ({missions.length})</h3>
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white transition"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missions.map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onClick={() => onSelectMission(mission.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/30 border-2 border-slate-700/50 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-lg mb-6">
            No active missions assigned to you yet.
          </p>
          <button
            onClick={() => window.location.href = '/rescue-squads'}
            className="px-6 py-3 bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 font-bold rounded-xl hover:scale-105 transition shadow-lg shadow-flash-500/30"
          >
            Join a Rescue Squad
          </button>
        </div>
      )}
    </div>
  );
}

// Mission card for empty state
function MissionCard({ mission, onClick }) {
  const getUrgencyColor = () => {
    const hours = mission.hoursMissing || 0;
    if (hours < 4) return 'border-red-500/50 bg-red-500/10';
    if (hours < 24) return 'border-amber-500/50 bg-amber-500/10';
    return 'border-flash-500/50 bg-flash-500/10';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-6 rounded-xl border-2 ${getUrgencyColor()} hover:scale-105 transition-all group`}
    >
      <div className="flex items-start gap-4 mb-4">
        {mission.photoUrl ? (
          <img
            src={mission.photoUrl}
            alt={mission.petName}
            className="w-16 h-16 rounded-xl object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-slate-700 flex items-center justify-center text-3xl">
            {mission.petSpecies === 'DOG' ? '🐕' : '🐈'}
          </div>
        )}
        <div className="flex-1">
          <h4 className="text-lg font-bold text-white mb-1 group-hover:text-flash-400 transition">
            {mission.petName}
          </h4>
          <p className="text-sm text-slate-400">
            {mission.timeMissing} • {mission.helperCount || 0} helpers
          </p>
        </div>
      </div>
      <div className="text-xs text-slate-500">
        📍 {mission.lastSeenAddress || 'Location unknown'}
      </div>
    </button>
  );
}

// Main export with Suspense wrapper
export default function MissionControl() {
  return (
    <Suspense fallback={<PageLoading message="Initializing Mission Control..." />}>
      <MissionControlContent />
    </Suspense>
  );
}
