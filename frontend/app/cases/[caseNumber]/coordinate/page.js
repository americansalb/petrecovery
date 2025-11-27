'use client';

/**
 * Case Coordination Page - Phase 1.2
 *
 * Route: /cases/[caseNumber]/coordinate
 * Central hub for squad coordination on active cases
 *
 * Features:
 * - Squad Chat for real-time communication
 * - Interactive search area mapping
 * - Sighting report submission
 * - Participant management
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SquadChat from '@/app/components/coordination/SquadChat';
import SearchAreaMap from '@/app/components/coordination/SearchAreaMap';
import SightingForm from '@/app/components/coordination/SightingForm';
import ParticipantList from '@/app/components/coordination/ParticipantList';
import LoadingSpinner from '@/app/components/LoadingSpinner';

export default function CaseCoordinatePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { caseNumber } = params;

  // State
  const [activeTab, setActiveTab] = useState('chat');
  const [caseData, setCaseData] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isLeader, setIsLeader] = useState(false);

  console.log('[COORDINATE] Page rendering');
  console.log(`[COORDINATE] Case number: ${caseNumber}`);
  console.log(`[COORDINATE] Session status: ${sessionStatus}`);
  console.log(`[COORDINATE] Active tab: ${activeTab}`);

  // Fetch case and assignment data
  const fetchData = useCallback(async () => {
    if (!session?.user?.id) {
      console.log('[COORDINATE] No session, skipping fetch');
      return;
    }

    console.log('[COORDINATE] Fetching case data...');
    setLoading(true);
    setError(null);

    try {
      // Fetch case details with assignment info
      const caseRes = await fetch(`/api/cases/${caseNumber}/coordinate`);
      console.log(`[COORDINATE] Case API response status: ${caseRes.status}`);

      if (!caseRes.ok) {
        if (caseRes.status === 401) {
          setError('You must be logged in to access case coordination');
          return;
        }
        if (caseRes.status === 403) {
          setError('You are not a member of a squad assigned to this case');
          return;
        }
        if (caseRes.status === 404) {
          setError('Case not found');
          return;
        }
        throw new Error('Failed to load case data');
      }

      const data = await caseRes.json();
      console.log('[COORDINATE] Case data received:', {
        caseNumber: data.case?.caseNumber,
        assignmentId: data.assignment?.id,
        isParticipant: data.isParticipant,
        isLeader: data.isLeader,
      });

      setCaseData(data.case);
      setAssignment(data.assignment);
      setIsParticipant(data.isParticipant);
      setIsLeader(data.isLeader);
    } catch (err) {
      console.error('[COORDINATE] Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseNumber, session?.user?.id]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (sessionStatus === 'unauthenticated') {
      console.log('[COORDINATE] User not authenticated, redirecting to login');
      router.push(`/login?callbackUrl=/cases/${caseNumber}/coordinate`);
      return;
    }

    fetchData();
  }, [sessionStatus, fetchData, router, caseNumber]);

  // Handle opt-in to case
  const handleOptIn = async () => {
    if (!assignment?.id) return;

    console.log('[COORDINATE] Opting into case...');
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/participants`, {
        method: 'POST',
      });

      if (res.ok) {
        console.log('[COORDINATE] Successfully opted in');
        setIsParticipant(true);
        fetchData(); // Refresh data
      } else {
        const data = await res.json();
        console.error('[COORDINATE] Opt-in failed:', data.error);
        alert(data.error || 'Failed to opt in');
      }
    } catch (err) {
      console.error('[COORDINATE] Opt-in error:', err);
      alert('Failed to opt in to case');
    }
  };

  // Handle opt-out from case
  const handleOptOut = async () => {
    if (!assignment?.id) return;

    if (!confirm('Are you sure you want to leave this case?')) return;

    console.log('[COORDINATE] Opting out of case...');
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/participants`, {
        method: 'DELETE',
      });

      if (res.ok) {
        console.log('[COORDINATE] Successfully opted out');
        setIsParticipant(false);
        fetchData(); // Refresh data
      } else {
        const data = await res.json();
        console.error('[COORDINATE] Opt-out failed:', data.error);
        alert(data.error || 'Failed to opt out');
      }
    } catch (err) {
      console.error('[COORDINATE] Opt-out error:', err);
      alert('Failed to opt out of case');
    }
  };

  // Loading state
  if (sessionStatus === 'loading' || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
      }}>
        <LoadingSpinner size="large" text="Loading case coordination..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '4rem auto',
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ color: '#dc2626', marginBottom: '1rem' }}>Access Denied</h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => router.push('/cases')}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Back to Cases
          </button>
        </div>
      </div>
    );
  }

  // Tab configuration
  const tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'map', label: 'Search Areas', icon: '🗺️' },
    { id: 'sightings', label: 'Sightings', icon: '👁️' },
    { id: 'team', label: 'Team', icon: '👥' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1rem 1.5rem',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
        }}>
          {/* Back link and case info */}
          <button
            onClick={() => router.push(`/cases/${caseNumber}`)}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
              padding: 0,
            }}
          >
            ← Back to case details
          </button>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#0f172a',
                margin: 0,
              }}>
                {caseData?.petName || 'Unknown Pet'} - Coordination Center
              </h1>
              <p style={{
                color: '#64748b',
                fontSize: '0.875rem',
                margin: '0.25rem 0 0 0',
              }}>
                Case #{caseNumber} • {caseData?.petSpecies} • {caseData?.city}, {caseData?.state}
              </p>
            </div>

            {/* Participation status & toggle */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {isParticipant ? (
                <>
                  <span style={{
                    padding: '0.5rem 1rem',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: '2rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                  }}>
                    ✓ Active Participant
                  </span>
                  <button
                    onClick={handleOptOut}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Leave Case
                  </button>
                </>
              ) : (
                <button
                  onClick={handleOptIn}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Join This Search
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          gap: '0.5rem',
          padding: '0 1.5rem',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                console.log(`[COORDINATE] Switching to tab: ${tab.id}`);
                setActiveTab(tab.id);
              }}
              style={{
                padding: '1rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #2563eb' : '3px solid transparent',
                color: activeTab === tab.id ? '#2563eb' : '#64748b',
                fontSize: '0.95rem',
                fontWeight: activeTab === tab.id ? '600' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '1.5rem',
      }}>
        {!isParticipant && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
            <div>
              <strong style={{ color: '#92400e' }}>View Only Mode</strong>
              <p style={{ color: '#a16207', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                Join this search to send messages, mark areas, and report sightings.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <SquadChat
            assignmentId={assignment?.id}
            isParticipant={isParticipant}
            isLeader={isLeader}
            currentUserId={session?.user?.id}
          />
        )}

        {activeTab === 'map' && (
          <SearchAreaMap
            assignmentId={assignment?.id}
            isParticipant={isParticipant}
            caseData={caseData}
            currentUserId={session?.user?.id}
          />
        )}

        {activeTab === 'sightings' && (
          <SightingForm
            assignmentId={assignment?.id}
            isParticipant={isParticipant}
            caseData={caseData}
            currentUserId={session?.user?.id}
          />
        )}

        {activeTab === 'team' && (
          <ParticipantList
            assignmentId={assignment?.id}
            isLeader={isLeader}
            currentUserId={session?.user?.id}
          />
        )}
      </div>
    </div>
  );
}
