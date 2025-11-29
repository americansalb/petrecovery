'use client';

/**
 * SquadHubContext - State Management for Squad Hub
 *
 * Manages:
 * - Division filtering
 * - Case queue tabs
 * - Activity lane tabs
 * - Mobile navigation
 * - On Duty toggle
 * - Case selection (for map focus)
 */

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const SquadHubContext = createContext(null);

export function SquadHubProvider({ children, initialData }) {
  const router = useRouter();

  // Core data from server
  const [data, setData] = useState(initialData);

  // UI State
  const [selectedDivisionId, setSelectedDivisionId] = useState('ALL');
  const [caseTab, setCaseTab] = useState('INCOMING');
  const [activityTab, setActivityTab] = useState('CHAT');
  const [mobileTab, setMobileTab] = useState('CASES');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [chatScope, setChatScope] = useState('DIVISION'); // 'DIVISION' | 'SQUAD'

  // Computed: filtered cases based on division and tab
  const filteredCases = useMemo(() => {
    let cases = data.cases || [];

    // Filter by division
    if (selectedDivisionId !== 'ALL') {
      cases = cases.filter(c => c.divisionId === selectedDivisionId);
    }

    // Filter by tab
    switch (caseTab) {
      case 'INCOMING':
        // Cases user hasn't joined, not reunited, still seeking helpers
        return cases.filter(c =>
          !c.isUserHelper &&
          c.status !== 'REUNITED' &&
          c.status !== 'CLOSED_OTHER'
        );

      case 'ACTIVE':
        // All non-reunited cases
        return cases.filter(c =>
          c.status !== 'REUNITED' &&
          c.status !== 'CLOSED_OTHER'
        );

      case 'REUNITED':
        // Success stories
        return cases.filter(c => c.status === 'REUNITED');

      default:
        return cases;
    }
  }, [data.cases, selectedDivisionId, caseTab]);

  // Computed: cases for map (all active cases in selected division)
  const mapCases = useMemo(() => {
    let cases = data.cases || [];

    if (selectedDivisionId !== 'ALL') {
      cases = cases.filter(c => c.divisionId === selectedDivisionId);
    }

    return cases.filter(c =>
      c.status !== 'REUNITED' &&
      c.status !== 'CLOSED_OTHER' &&
      c.lastSeenLat != null &&
      c.lastSeenLng != null
    );
  }, [data.cases, selectedDivisionId]);

  // Computed: selected case details
  const selectedCase = useMemo(() => {
    if (!selectedCaseId) return null;
    return data.cases?.find(c => c.id === selectedCaseId) || null;
  }, [data.cases, selectedCaseId]);

  // Computed: division with active case counts
  const divisionsWithCounts = useMemo(() => {
    return (data.divisions || []).map(div => ({
      ...div,
      activeCaseCount: (data.cases || []).filter(c =>
        c.divisionId === div.id &&
        c.status !== 'REUNITED' &&
        c.status !== 'CLOSED_OTHER'
      ).length,
    }));
  }, [data.divisions, data.cases]);

  // Computed: total active case count
  const totalActiveCases = useMemo(() => {
    return (data.cases || []).filter(c =>
      c.status !== 'REUNITED' &&
      c.status !== 'CLOSED_OTHER'
    ).length;
  }, [data.cases]);

  // Action: Toggle On Duty
  const toggleOnDuty = useCallback(async () => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      membership: {
        ...prev.membership,
        isMember: true,
        isOnDuty: !prev.membership.isOnDuty,
      },
      squad: {
        ...prev.squad,
        onDutyCount: prev.membership.isOnDuty
          ? prev.squad.onDutyCount - 1
          : prev.squad.onDutyCount + 1,
      },
    }));

    // TODO: Call API
    // await fetch(`/api/squads/${data.squad.id}/on-duty`, {
    //   method: 'POST',
    //   body: JSON.stringify({ onDuty: !data.membership.isOnDuty }),
    // });
  }, []);

  // Action: Join Squad
  const joinSquad = useCallback(async () => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      membership: {
        ...prev.membership,
        isMember: true,
        isOnDuty: false,
      },
      squad: {
        ...prev.squad,
        memberCount: prev.squad.memberCount + 1,
      },
    }));

    // TODO: Call API
    // await fetch(`/api/squads/${data.squad.id}/join`, { method: 'POST' });
  }, []);

  // Action: Help on Case
  const helpOnCase = useCallback(async (caseId) => {
    const targetCase = data.cases?.find(c => c.id === caseId);
    if (!targetCase) return;

    // Optimistic update
    setData(prev => ({
      ...prev,
      cases: prev.cases.map(c =>
        c.id === caseId
          ? { ...c, isUserHelper: true, helperCount: c.helperCount + 1 }
          : c
      ),
    }));

    // TODO: Call API
    // await fetch(`/api/cases/${caseId}/help`, { method: 'POST' });

    // Navigate to case command center
    router.push(`/cases/${targetCase.caseNumber}`);
  }, [data.cases, router]);

  // Action: Select case (for map focus)
  const selectCase = useCallback((caseId) => {
    setSelectedCaseId(caseId);
  }, []);

  // Action: Send chat message
  const sendChatMessage = useCallback(async (content, divisionId = null) => {
    // TODO: Implement chat
    console.log('Send message:', content, 'to division:', divisionId);
  }, []);

  const value = {
    // Data
    squad: data.squad,
    membership: data.membership,
    divisions: divisionsWithCounts,
    cases: data.cases,
    events: data.activityPreview?.recentEvents || [],
    chatMessages: data.chat?.messages || [],
    announcements: data.announcements || [],

    // Computed
    filteredCases,
    mapCases,
    selectedCase,
    totalActiveCases,

    // UI State
    selectedDivisionId,
    setSelectedDivisionId,
    caseTab,
    setCaseTab,
    activityTab,
    setActivityTab,
    mobileTab,
    setMobileTab,
    selectedCaseId,
    selectCase,
    chatScope,
    setChatScope,

    // Actions
    toggleOnDuty,
    joinSquad,
    helpOnCase,
    sendChatMessage,
  };

  return (
    <SquadHubContext.Provider value={value}>
      {children}
    </SquadHubContext.Provider>
  );
}

export function useSquadHub() {
  const context = useContext(SquadHubContext);
  if (!context) {
    throw new Error('useSquadHub must be used within a SquadHubProvider');
  }
  return context;
}

export default SquadHubContext;
