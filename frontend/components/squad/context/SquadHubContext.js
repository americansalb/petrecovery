'use client';

/**
 * SquadHubContext - State Management for Squad Hub
 *
 * Manages:
 * - Main tab (Operations vs Community)
 * - Division filtering
 * - Case queue tabs
 * - Activity lane tabs
 * - Community tabs
 * - Mobile navigation
 * - On Duty toggle
 * - Case selection (for map focus)
 * - Help requests
 * - Member presence
 */

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const SquadHubContext = createContext(null);

export function SquadHubProvider({ children, initialData }) {
  const router = useRouter();

  // Core data from server
  const [data, setData] = useState(initialData);

  // Main Tab State (Operations vs Community)
  const [mainTab, setMainTab] = useState('OPERATIONS');

  // UI State - Operations
  const [selectedDivisionId, setSelectedDivisionId] = useState('ALL');
  const [caseTab, setCaseTab] = useState('INCOMING');
  const [activityTab, setActivityTab] = useState('CHAT');
  const [mobileTab, setMobileTab] = useState('CASES');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [chatScope, setChatScope] = useState('DIVISION');

  // UI State - Community
  const [communityTab, setCommunityTab] = useState('CHAT');
  const [mobileCommunityTab, setMobileCommunityTab] = useState('CHAT');

  // Computed: filtered cases based on division and tab
  const filteredCases = useMemo(() => {
    let cases = data.cases || [];

    if (selectedDivisionId !== 'ALL') {
      cases = cases.filter(c => c.divisionId === selectedDivisionId);
    }

    switch (caseTab) {
      case 'INCOMING':
        return cases.filter(c =>
          !c.isUserHelper &&
          c.status !== 'REUNITED' &&
          c.status !== 'CLOSED_OTHER'
        );
      case 'ACTIVE':
        return cases.filter(c =>
          c.status !== 'REUNITED' &&
          c.status !== 'CLOSED_OTHER'
        );
      case 'REUNITED':
        return cases.filter(c => c.status === 'REUNITED');
      default:
        return cases;
    }
  }, [data.cases, selectedDivisionId, caseTab]);

  // Computed: cases for map
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

  // Computed: divisions with active case counts
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

  // Computed: filtered requests based on division
  const filteredRequests = useMemo(() => {
    let requests = data.requests || [];

    if (selectedDivisionId !== 'ALL') {
      requests = requests.filter(r =>
        r.divisionId === selectedDivisionId || r.divisionId === null
      );
    }

    return requests.filter(r => r.status !== 'COMPLETED');
  }, [data.requests, selectedDivisionId]);

  // Computed: filtered chat messages based on scope and division
  const filteredChatMessages = useMemo(() => {
    let messages = data.chat?.messages || [];

    if (chatScope === 'DIVISION' && selectedDivisionId !== 'ALL') {
      messages = messages.filter(m =>
        m.divisionId === selectedDivisionId || !m.divisionId
      );
    }

    return messages;
  }, [data.chat?.messages, chatScope, selectedDivisionId]);

  // Computed: filtered announcements based on division
  const filteredAnnouncements = useMemo(() => {
    let announcements = data.announcements || [];

    if (selectedDivisionId !== 'ALL') {
      announcements = announcements.filter(a =>
        a.divisionId === selectedDivisionId || !a.divisionId
      );
    }

    return announcements;
  }, [data.announcements, selectedDivisionId]);

  // Computed: on duty members filtered by division
  const filteredOnDutyMembers = useMemo(() => {
    let members = data.members?.onDuty || [];

    if (selectedDivisionId !== 'ALL') {
      members = members.filter(m =>
        m.divisionId === selectedDivisionId || !m.divisionId
      );
    }

    return members;
  }, [data.members?.onDuty, selectedDivisionId]);

  // Action: Open Community View
  const openCommunityView = useCallback(() => {
    setMainTab('COMMUNITY');
  }, []);

  // Action: Toggle On Duty
  const toggleOnDuty = useCallback(async () => {
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
  }, []);

  // Action: Join Squad
  const joinSquad = useCallback(async () => {
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
  }, []);

  // Action: Help on Case
  const helpOnCase = useCallback(async (caseId) => {
    const targetCase = data.cases?.find(c => c.id === caseId);
    if (!targetCase) return;

    setData(prev => ({
      ...prev,
      cases: prev.cases.map(c =>
        c.id === caseId
          ? { ...c, isUserHelper: true, helperCount: c.helperCount + 1 }
          : c
      ),
    }));

    router.push(`/cases/${targetCase.caseNumber}`);
  }, [data.cases, router]);

  // Action: Help on Request
  const helpOnRequest = useCallback(async (requestId) => {
    setData(prev => ({
      ...prev,
      requests: (prev.requests || []).map(r =>
        r.id === requestId
          ? { ...r, isUserHelper: true, helpersCount: r.helpersCount + 1 }
          : r
      ),
    }));
    // TODO: Call API
  }, []);

  // Action: Post Request
  const postRequest = useCallback(async (title, body, divisionId = null) => {
    const newRequest = {
      id: `req_${Date.now()}`,
      title,
      body,
      divisionId,
      authorId: 'current_user',
      authorName: 'You',
      createdAt: new Date().toISOString(),
      helpersCount: 0,
      isUserHelper: false,
      status: 'OPEN',
    };

    setData(prev => ({
      ...prev,
      requests: [newRequest, ...(prev.requests || [])],
    }));
    // TODO: Call API
  }, []);

  // Action: Select case (for map focus)
  const selectCase = useCallback((caseId) => {
    setSelectedCaseId(caseId);
  }, []);

  // Action: Send chat message
  const sendChatMessage = useCallback(async (content, divisionId = null) => {
    const newMessage = {
      id: `msg_${Date.now()}`,
      authorId: 'current_user',
      authorName: 'You',
      authorRole: data.membership.role || 'MEMBER',
      content,
      createdAt: new Date().toISOString(),
      divisionId,
    };

    setData(prev => ({
      ...prev,
      chat: {
        ...prev.chat,
        messages: [...(prev.chat?.messages || []), newMessage],
      },
    }));
    // TODO: Call API
  }, [data.membership.role]);

  const value = {
    // Data
    squad: data.squad,
    membership: data.membership,
    divisions: divisionsWithCounts,
    cases: data.cases,
    events: data.activityPreview?.recentEvents || [],
    chatMessages: filteredChatMessages,
    announcements: filteredAnnouncements,
    requests: data.requests || [],
    onDutyMembers: filteredOnDutyMembers,
    recentlyActiveMembers: data.members?.recentlyActive || [],

    // Computed
    filteredCases,
    filteredRequests,
    mapCases,
    selectedCase,
    totalActiveCases,

    // UI State
    mainTab,
    setMainTab,
    selectedDivisionId,
    setSelectedDivisionId,
    caseTab,
    setCaseTab,
    activityTab,
    setActivityTab,
    communityTab,
    setCommunityTab,
    mobileTab,
    setMobileTab,
    mobileCommunityTab,
    setMobileCommunityTab,
    selectedCaseId,
    selectCase,
    chatScope,
    setChatScope,

    // Actions
    openCommunityView,
    toggleOnDuty,
    joinSquad,
    helpOnCase,
    helpOnRequest,
    postRequest,
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
