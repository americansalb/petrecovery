'use client';

/**
 * useMissionControl - Central state management hook
 *
 * Consolidates all mission control state and logic:
 * - Mission fetching and switching
 * - Sightings management
 * - User location (one-time, not continuous tracking)
 * - Tasks management
 * - Team data
 * - UI state (modals, tabs, etc.)
 *
 * NOTE: Continuous GPS tracking has been removed as it doesn't work reliably
 * in web browsers. For real-time GPS tracking, users should use the mobile app.
 * This hook now provides one-time location capture only.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRetry, formatErrorMessage, isOnline } from '@/app/lib/utils';
import { useGPS } from '@/app/lib/gpsService';

export default function useMissionControl(session) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');

  // GPS service for one-time location capture
  const { location: gpsLocation, error: gpsError, getPosition, isSupported: gpsSupported, isLoading: gpsLoading } = useGPS();

  // ============================================================
  // MISSION STATE
  // ============================================================
  const [activeMission, setActiveMission] = useState(null);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [currentMissionIndex, setCurrentMissionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  // ============================================================
  // UI STATE
  // ============================================================
  const [activeTab, setActiveTab] = useState('overview');
  const [showMissionsModal, setShowMissionsModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [showCustomActionModal, setShowCustomActionModal] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error' | 'info', message: string }

  // Helper to show notification (auto-dismisses after 4s)
  const showNotification = useCallback((type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ============================================================
  // DATA STATE
  // ============================================================
  const [sightings, setSightings] = useState([]);
  const [team, setTeam] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(['immediate']);

  // ============================================================
  // FETCH FUNCTIONS
  // ============================================================

  // Fetch available missions for current user
  const fetchAvailableMissions = useCallback(async () => {
    try {
      if (!session?.user) return;
      const res = await fetchWithRetry('/api/missions/my-missions');
      if (res.ok) {
        const data = await res.json();
        setAvailableMissions(data.missions || []);
      }
    } catch (err) {
      console.error('Error fetching available missions:', err);
    }
  }, [session]);

  // Fetch specific mission by ID
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

      const res = await fetchWithRetry(`/api/missions/${id}`);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please log in to view this mission');
        } else if (res.status === 404) {
          throw new Error('Mission not found');
        } else if (res.status === 403) {
          let errorData = null;
          try {
            errorData = await res.json();
          } catch (e) {}
          if (!errorData || errorData.code === 'WAIVER_NOT_ACCEPTED' || errorData.message?.includes('waiver')) {
            setShowWaiverModal(true);
            setSwitching(false);
            setLoading(false);
            return;
          }
          throw new Error(errorData?.message || 'Permission denied');
        }
        throw new Error(`Failed to load mission (${res.status})`);
      }

      const data = await res.json();
      setActiveMission(data);

      // Extract team from assignments
      if (data.assignments?.length > 0) {
        const allParticipants = data.assignments.flatMap(a =>
          a.participants?.map(p => ({
            id: p.id,
            odp: p.userId,
            name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            isActive: p.isActive !== false,
          })) || []
        );
        const unique = Array.from(new Map(allParticipants.map(p => [p.userId, p])).values());
        setTeam(unique);
      } else {
        setTeam([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching mission:', err);
      setError(formatErrorMessage(err));
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  }, []);

  // Fetch sightings for active mission
  const fetchSightings = useCallback(async () => {
    if (!activeMission?.id) return;
    try {
      const res = await fetch(`/api/missions/${activeMission.id}/sightings`);
      if (res.ok) {
        const data = await res.json();
        setSightings(data.sightings || []);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    }
  }, [activeMission?.id]);

  // ============================================================
  // LOCAL STORAGE - Tasks
  // ============================================================

  // Load tasks from localStorage
  useEffect(() => {
    if (!activeMission?.id) return;
    const tasksKey = `case_${activeMission.id}_tasks`;

    const savedTasks = localStorage.getItem(tasksKey);
    if (savedTasks) {
      try { setTasks(JSON.parse(savedTasks)); } catch (e) {}
    }
  }, [activeMission?.id]);

  // Save tasks to localStorage
  useEffect(() => {
    if (!activeMission?.id || tasks.length === 0) return;
    localStorage.setItem(`case_${activeMission.id}_tasks`, JSON.stringify(tasks));
  }, [tasks, activeMission?.id]);

  // ============================================================
  // INITIAL LOAD EFFECTS
  // ============================================================

  // Fetch available missions on mount
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

  // Fetch sightings when mission changes (with polling)
  useEffect(() => {
    if (activeMission?.id) {
      fetchSightings();
      const interval = setInterval(fetchSightings, 30000);
      return () => clearInterval(interval);
    }
  }, [activeMission?.id, fetchSightings]);

  // Update current mission index when missions or active mission changes
  useEffect(() => {
    if (availableMissions.length > 0 && activeMission) {
      const idx = availableMissions.findIndex(m => m.id === activeMission.id);
      if (idx >= 0) setCurrentMissionIndex(idx);
    }
  }, [availableMissions, activeMission]);

  // ============================================================
  // NAVIGATION FUNCTIONS
  // ============================================================

  const goToPrevMission = useCallback(() => {
    if (availableMissions.length === 0) return;
    const newIndex = (currentMissionIndex - 1 + availableMissions.length) % availableMissions.length;
    const newMission = availableMissions[newIndex];
    router.push(`/mission-control?mission=${newMission.id}`, { scroll: false });
  }, [availableMissions, currentMissionIndex, router]);

  const goToNextMission = useCallback(() => {
    if (availableMissions.length === 0) return;
    const newIndex = (currentMissionIndex + 1) % availableMissions.length;
    const newMission = availableMissions[newIndex];
    router.push(`/mission-control?mission=${newMission.id}`, { scroll: false });
  }, [availableMissions, currentMissionIndex, router]);

  const selectMission = useCallback((selectedMissionId) => {
    setShowMissionsModal(false);
    router.push(`/mission-control?mission=${selectedMissionId}`, { scroll: false });
  }, [router]);

  // ============================================================
  // ACTION FUNCTIONS
  // ============================================================

  const handleJoinMission = useCallback(async () => {
    if (!activeMission) {
      showNotification('error', 'No active mission to join');
      return;
    }
    if (isJoining) return; // Prevent double-click

    try {
      const squadId = activeMission.rescueSquadId || activeMission.squadId || activeMission.assignments?.[0]?.rescueSquadId;
      if (!squadId) {
        showNotification('info', 'This case needs a rescue squad first. Find one nearby to coordinate the search!');
        return;
      }

      setIsJoining(true);

      const res = await fetchWithRetry(`/api/rescue-squads/${squadId}/missions/${activeMission.id}/help`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        showNotification('success', 'You\'ve joined the search team! Check the Actions tab for ways to help.');
        await fetchMission(missionId);
        await fetchAvailableMissions();
      } else if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        showNotification('info', data.error || 'You\'re already helping with this case!');
        await fetchMission(missionId);
      } else {
        const data = await res.json().catch(() => ({}));
        showNotification('error', data.error || 'Could not join mission. Please try again.');
      }
    } catch (err) {
      console.error('Error joining mission:', err);
      showNotification('error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsJoining(false);
    }
  }, [activeMission, missionId, fetchMission, fetchAvailableMissions, showNotification, isJoining]);

  // Get current location (one-time capture)
  const refreshLocation = useCallback(async () => {
    if (!gpsSupported) {
      showNotification('error', 'GPS not available on this device');
      return null;
    }

    try {
      const location = await getPosition();
      showNotification('info', 'Location updated');
      return location;
    } catch (err) {
      showNotification('error', err.message || 'Failed to get location');
      return null;
    }
  }, [gpsSupported, getPosition, showNotification]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const getTimeMissing = useCallback(() => {
    if (!activeMission?.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(activeMission.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return { text: 'Less than 1 hour', hours: 0 };
    if (hours < 24) return { text: `${hours} hour${hours !== 1 ? 's' : ''}`, hours };
    const days = Math.floor(hours / 24);
    return { text: `${days} day${days !== 1 ? 's' : ''} ${hours % 24}h`, hours };
  }, [activeMission?.lastSeenAt]);

  const timeMissing = getTimeMissing();
  const isUrgent = timeMissing && timeMissing.hours < 24;
  const isReunited = activeMission?.status === 'RESOLVED' || activeMission?.resolution === 'REUNITED';

  // Check user status
  const participants = activeMission?.assignments?.flatMap(a => a.participants || []) || [];
  const activeParticipants = participants.filter(p => p.isActive !== false);
  const isDeployed = session && activeParticipants.some(p => p.userId === session.user.id);
  const isOwner = session && activeMission?.ownerId === session.user.id;

  // ============================================================
  // RETURN HOOK API
  // ============================================================

  return {
    // Mission state
    activeMission,
    availableMissions,
    currentMissionIndex,
    loading,
    switching,
    error,
    missionId,

    // UI state
    activeTab,
    setActiveTab,
    showMissionsModal,
    setShowMissionsModal,
    showWaiverModal,
    setShowWaiverModal,
    showSightingForm,
    setShowSightingForm,
    showCustomActionModal,
    setShowCustomActionModal,
    notification,
    showNotification,

    // Data state
    sightings,
    team,
    tasks,
    setTasks,
    isJoining,
    selectedTask,
    setSelectedTask,
    expandedCategories,
    setExpandedCategories,

    // GPS state - one-time location only
    gpsLocation,
    gpsError,
    gpsLoading,
    gpsSupported,

    // Computed values
    timeMissing,
    isUrgent,
    isReunited,
    isDeployed,
    isOwner,
    activeParticipants,

    // Actions
    fetchMission,
    fetchAvailableMissions,
    fetchSightings,
    goToPrevMission,
    goToNextMission,
    selectMission,
    handleJoinMission,
    refreshLocation,

    // Router
    router,
  };
}
