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

const SquadHubContext = createContext(null);

export function SquadHubProvider({ children, initialData, squadId }) {
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

  // UI State - Chat filters
  const [chatCaseFilterId, setChatCaseFilterId] = useState(null);

  // UI State - Request highlight (for scroll-to)
  const [highlightRequestId, setHighlightRequestId] = useState(null);

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

  // Computed: filtered chat messages based on scope, division, and case
  const filteredChatMessages = useMemo(() => {
    let messages = data.chat?.messages || [];

    // Division filter
    if (chatScope === 'DIVISION' && selectedDivisionId !== 'ALL') {
      messages = messages.filter(m =>
        m.divisionId === selectedDivisionId || !m.divisionId
      );
    }

    // Case filter (if set)
    if (chatCaseFilterId) {
      messages = messages.filter(m =>
        m.caseId === chatCaseFilterId || !m.caseId
      );
    }

    return messages;
  }, [data.chat?.messages, chatScope, selectedDivisionId, chatCaseFilterId]);

  // Computed: cases that have chat messages (for case filter dropdown)
  const casesWithChat = useMemo(() => {
    const messages = data.chat?.messages || [];
    const caseIds = [...new Set(messages.filter(m => m.caseId).map(m => m.caseId))];
    return (data.cases || []).filter(c => caseIds.includes(c.id));
  }, [data.chat?.messages, data.cases]);

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

  // Computed: Your Missions (cases and requests where user is helping)
  const yourMissions = useMemo(() => {
    const missions = [];

    // Add cases where user is helper
    const myCases = (data.cases || []).filter(c =>
      c.isUserHelper &&
      c.status !== 'REUNITED' &&
      c.status !== 'CLOSED_OTHER'
    );
    myCases.forEach(c => {
      missions.push({
        type: 'CASE',
        id: c.id,
        label: c.petName,
        status: c.status,
        urgency: c.urgency,
        caseNumber: c.caseNumber,
      });
    });

    // Add requests where user is helper and not completed
    const myRequests = (data.requests || []).filter(r =>
      r.isUserHelper && r.status !== 'COMPLETED'
    );
    myRequests.forEach(r => {
      missions.push({
        type: 'REQUEST',
        id: r.id,
        label: r.title.length > 30 ? r.title.slice(0, 30) + '...' : r.title,
        status: r.status,
      });
    });

    return missions;
  }, [data.cases, data.requests]);

  // Computed: requests grouped by status
  const groupedRequests = useMemo(() => {
    const requests = data.requests || [];

    // Filter by division if needed
    let filtered = requests;
    if (selectedDivisionId !== 'ALL') {
      filtered = requests.filter(r =>
        r.divisionId === selectedDivisionId || r.divisionId === null
      );
    }

    return {
      OPEN: filtered.filter(r => r.status === 'OPEN'),
      IN_PROGRESS: filtered.filter(r => r.status === 'IN_PROGRESS'),
      COMPLETED: filtered.filter(r => r.status === 'COMPLETED'),
    };
  }, [data.requests, selectedDivisionId]);

  // Action: Open Community View
  const openCommunityView = useCallback(() => {
    setMainTab('COMMUNITY');
  }, []);

  // Action: Toggle On Duty
  const toggleOnDuty = useCallback(async () => {
    // Optimistic update
    const wasOnDuty = data.membership.isOnDuty;
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

    // Call API
    if (squadId) {
      try {
        const res = await fetch(`/api/rescue-squads/${squadId}/toggle-duty`, {
          method: 'POST',
        });
        if (!res.ok) {
          // Revert on error
          setData(prev => ({
            ...prev,
            membership: { ...prev.membership, isOnDuty: wasOnDuty },
            squad: {
              ...prev.squad,
              onDutyCount: wasOnDuty ? prev.squad.onDutyCount + 1 : prev.squad.onDutyCount - 1,
            },
          }));
        }
      } catch (err) {
        console.error('Failed to toggle duty:', err);
      }
    }
  }, [data.membership.isOnDuty, squadId]);

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

    // Call API
    if (squadId) {
      try {
        const res = await fetch(`/api/rescue-squads/${squadId}/join`, {
          method: 'POST',
        });
        if (!res.ok) {
          // Revert on error
          setData(prev => ({
            ...prev,
            membership: { ...prev.membership, isMember: false },
            squad: { ...prev.squad, memberCount: prev.squad.memberCount - 1 },
          }));
        }
      } catch (err) {
        console.error('Failed to join squad:', err);
      }
    }
  }, [squadId]);

  // Action: Help on Case
  // Updates local state to mark user as helper, then navigates to Operations tab
  // with the case selected so user can see case details
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

    // Navigate to Operations tab with this case selected
    setMainTab('OPERATIONS');
    setCaseTab('ACTIVE');
    setSelectedCaseId(caseId);
    setMobileTab('CASES');

    // Call API
    if (squadId) {
      try {
        const res = await fetch(`/api/rescue-squads/${squadId}/cases/${caseId}/help`, {
          method: 'POST',
        });
        if (!res.ok) {
          // Revert on error
          setData(prev => ({
            ...prev,
            cases: prev.cases.map(c =>
              c.id === caseId
                ? { ...c, isUserHelper: false, helperCount: c.helperCount - 1 }
                : c
            ),
          }));
        }
      } catch (err) {
        console.error('Failed to help on case:', err);
      }
    }
  }, [data.cases, squadId]);

  // Action: Help on Request
  const helpOnRequest = useCallback(async (requestId) => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      requests: (prev.requests || []).map(r =>
        r.id === requestId
          ? {
              ...r,
              isUserHelper: true,
              helpersCount: r.helpersCount + 1,
              status: r.status === 'OPEN' ? 'IN_PROGRESS' : r.status,
            }
          : r
      ),
    }));

    // Call API
    if (squadId) {
      try {
        await fetch(`/api/rescue-squads/${squadId}/requests/${requestId}/help`, {
          method: 'POST',
        });
      } catch (err) {
        console.error('Failed to help on request:', err);
      }
    }
  }, [squadId]);

  // Action: Complete request for user (mark their part done)
  const completeRequestForUser = useCallback(async (requestId) => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      requests: (prev.requests || []).map(r =>
        r.id === requestId
          ? { ...r, isUserHelper: false, helpersCount: Math.max(0, r.helpersCount - 1), status: 'COMPLETED' }
          : r
      ),
    }));

    // Call API
    if (squadId) {
      try {
        await fetch(`/api/rescue-squads/${squadId}/requests/${requestId}/help`, {
          method: 'PATCH',
        });
      } catch (err) {
        console.error('Failed to complete request:', err);
      }
    }
  }, [squadId]);

  // Action: Leave request
  const leaveRequest = useCallback(async (requestId) => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      requests: (prev.requests || []).map(r =>
        r.id === requestId
          ? { ...r, isUserHelper: false, helpersCount: Math.max(0, r.helpersCount - 1), status: 'OPEN' }
          : r
      ),
    }));

    // Call API
    if (squadId) {
      try {
        await fetch(`/api/rescue-squads/${squadId}/requests/${requestId}/help`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to leave request:', err);
      }
    }
  }, [squadId]);

  // Action: Leave case
  const leaveCase = useCallback(async (caseId) => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      cases: prev.cases.map(c =>
        c.id === caseId
          ? { ...c, isUserHelper: false, helperCount: Math.max(0, c.helperCount - 1) }
          : c
      ),
    }));

    // Call API
    if (squadId) {
      try {
        await fetch(`/api/rescue-squads/${squadId}/cases/${caseId}/help`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to leave case:', err);
      }
    }
  }, [squadId]);

  // Action: Post Request
  const postRequest = useCallback(async (title, body, divisionId = null, caseId = null) => {
    // Find case code if caseId provided
    const linkedCase = caseId ? data.cases?.find(c => c.id === caseId) : null;

    const tempId = `req_${Date.now()}`;
    const newRequest = {
      id: tempId,
      title,
      body,
      divisionId,
      caseId,
      caseCode: linkedCase?.caseNumber || null,
      authorId: 'current_user',
      authorName: 'You',
      createdAt: new Date().toISOString(),
      helpersCount: 0,
      isUserHelper: false,
      status: 'OPEN',
    };

    // Optimistic update
    setData(prev => ({
      ...prev,
      requests: [newRequest, ...(prev.requests || [])],
    }));

    // Call API
    if (squadId) {
      try {
        const res = await fetch(`/api/rescue-squads/${squadId}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, divisionId, caseId }),
        });
        if (res.ok) {
          const { request } = await res.json();
          // Update with real ID from server
          setData(prev => ({
            ...prev,
            requests: prev.requests.map(r =>
              r.id === tempId ? { ...r, ...request } : r
            ),
          }));
        }
      } catch (err) {
        console.error('Failed to post request:', err);
      }
    }
  }, [data.cases, squadId]);

  // Action: Post Announcement (leads/admins only)
  const postAnnouncement = useCallback(async (title, content, divisionId = null, isPinned = false) => {
    const tempId = `ann_${Date.now()}`;
    const newAnnouncement = {
      id: tempId,
      title,
      content,
      authorId: 'current_user',
      authorName: 'You',
      createdAt: new Date().toISOString(),
      isPinned,
      divisionId,
    };

    // Optimistic update
    setData(prev => ({
      ...prev,
      announcements: [newAnnouncement, ...(prev.announcements || [])],
    }));

    // Call API
    if (squadId) {
      try {
        const res = await fetch(`/api/rescue-squads/${squadId}/announcements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, divisionId, isPinned }),
        });
        if (res.ok) {
          const { announcement } = await res.json();
          // Update with real data from server
          setData(prev => ({
            ...prev,
            announcements: prev.announcements.map(a =>
              a.id === tempId ? { ...a, ...announcement } : a
            ),
          }));
        } else {
          // Remove optimistic update on error
          setData(prev => ({
            ...prev,
            announcements: prev.announcements.filter(a => a.id !== tempId),
          }));
        }
      } catch (err) {
        console.error('Failed to post announcement:', err);
        // Remove optimistic update on error
        setData(prev => ({
          ...prev,
          announcements: prev.announcements.filter(a => a.id !== tempId),
        }));
      }
    }
  }, [squadId]);

  // Action: Select case (for map focus and detail panel)
  const selectCase = useCallback((caseId) => {
    setSelectedCaseId(caseId);
  }, []);

  // Action: Deselect case (close detail panel)
  const deselectCase = useCallback(() => {
    setSelectedCaseId(null);
  }, []);

  // Action: Send chat message
  const sendChatMessage = useCallback(async (content, divisionId = null, caseId = null) => {
    const tempId = `msg_${Date.now()}`;
    const newMessage = {
      id: tempId,
      authorId: 'current_user',
      authorName: 'You',
      authorRole: data.membership.role || 'MEMBER',
      content,
      createdAt: new Date().toISOString(),
      divisionId,
      caseId,
    };

    // Optimistic update
    setData(prev => ({
      ...prev,
      chat: {
        ...prev.chat,
        messages: [...(prev.chat?.messages || []), newMessage],
      },
    }));

    // Call API
    if (squadId) {
      try {
        const res = await fetch(`/api/rescue-squads/${squadId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, divisionId, caseId }),
        });

        if (res.ok) {
          const { message } = await res.json();
          // Replace temp message with real one
          setData(prev => ({
            ...prev,
            chat: {
              ...prev.chat,
              messages: prev.chat.messages.map(m =>
                m.id === tempId ? message : m
              ),
            },
          }));
        } else {
          // Remove failed message
          setData(prev => ({
            ...prev,
            chat: {
              ...prev.chat,
              messages: prev.chat.messages.filter(m => m.id !== tempId),
            },
          }));
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        // Remove failed message
        setData(prev => ({
          ...prev,
          chat: {
            ...prev.chat,
            messages: prev.chat.messages.filter(m => m.id !== tempId),
          },
        }));
      }
    }
  }, [data.membership.role, squadId]);

  // Action: Open case chat (navigate to Community > Chat filtered by case)
  const openCaseChat = useCallback((caseId) => {
    setMainTab('COMMUNITY');
    setCommunityTab('CHAT');
    setMobileCommunityTab('CHAT');
    setChatCaseFilterId(caseId);
  }, []);

  // Action: Open mission (navigate to case or request)
  const openMission = useCallback((mission) => {
    if (mission.type === 'CASE') {
      setMainTab('OPERATIONS');
      setCaseTab('ACTIVE');
      setSelectedCaseId(mission.id);
      setMobileTab('CASES');
    } else {
      setMainTab('COMMUNITY');
      setCommunityTab('REQUESTS');
      setMobileCommunityTab('REQUESTS');
      setHighlightRequestId(mission.id);
      // Clear highlight after a moment
      setTimeout(() => setHighlightRequestId(null), 3000);
    }
  }, []);

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
    groupedRequests,
    mapCases,
    selectedCase,
    totalActiveCases,
    yourMissions,
    casesWithChat,

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
    deselectCase,
    chatScope,
    setChatScope,
    chatCaseFilterId,
    setChatCaseFilterId,
    highlightRequestId,
    setHighlightRequestId,

    // Actions
    openCommunityView,
    openCaseChat,
    openMission,
    toggleOnDuty,
    joinSquad,
    helpOnCase,
    leaveCase,
    helpOnRequest,
    completeRequestForUser,
    leaveRequest,
    postRequest,
    postAnnouncement,
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
