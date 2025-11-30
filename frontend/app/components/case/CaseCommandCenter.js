'use client';

/**
 * Case Command Center - Layer B
 *
 * The mission control interface for active case coordination.
 *
 * Layout:
 * - Left: Case summary, status, people involved, reward
 * - Center: Interactive map with markers (last seen, sightings, shelters)
 * - Right: Timeline/activity feed + chat
 *
 * Theme: "Bioluminescent" dark mode with glowing accents
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import CaseInfoPanel from './CaseInfoPanel';
import CaseMapPanel from './CaseMapPanel';
import CaseActivityPanel from './CaseActivityPanel';

export default function CaseCommandCenter({ caseId, caseNumber }) {
  const { data: session } = useSession();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePanel, setActivePanel] = useState('map'); // Mobile panel selector
  const [userRole, setUserRole] = useState('VISITOR');

  // Fetch case data
  const fetchCase = useCallback(async () => {
    try {
      const identifier = caseId || caseNumber;
      const res = await fetch(`/api/cases/${identifier}`);

      if (!res.ok) {
        if (res.status === 404) throw new Error('Case not found');
        throw new Error('Failed to load case');
      }

      const data = await res.json();
      setCaseData(data);

      // Determine user role
      if (session?.user?.id) {
        if (data.reporterId === session.user.id) {
          setUserRole('OWNER');
        } else if (session.user.role === 'ADMIN' || session.user.role === 'MODERATOR') {
          setUserRole('ADMIN');
        } else {
          // Check if participant
          const isParticipant = data.assignments?.some(a =>
            a.participants?.some(p => p.userId === session.user.id)
          );
          setUserRole(isParticipant ? 'PARTICIPANT' : 'VOLUNTEER');
        }
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching case:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, caseNumber, session?.user?.id]);

  useEffect(() => {
    fetchCase();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchCase, 30000);
    return () => clearInterval(interval);
  }, [fetchCase]);

  // Time calculations
  const getTimeElapsed = () => {
    if (!caseData?.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getUrgencyLevel = () => {
    if (!caseData?.lastSeenAt) return 'UNKNOWN';
    const hours = Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000);
    if (hours < 6) return 'CRITICAL';
    if (hours < 24) return 'HIGH';
    if (hours < 72) return 'ELEVATED';
    if (hours < 168) return 'MODERATE';
    return 'EXTENDED';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-cyan-400/50 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-cyan-500/20" />
          </div>
          <p className="text-cyan-400/80 text-sm">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/80 border border-red-500/30 rounded-2xl p-8 max-w-md text-center backdrop-blur">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Unable to Load Case</h2>
          <p className="text-slate-400 mb-6">{error || 'Case data unavailable'}</p>
          <button
            onClick={fetchCase}
            className="px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl hover:bg-cyan-500/30 transition font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const urgency = getUrgencyLevel();
  const timeElapsed = getTimeElapsed();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Command Header */}
      <header className="bg-slate-900/90 border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Pet info */}
            <div className="flex items-center gap-3">
              {caseData.petPhotoUrl && caseData.petPhotoUrl.length > 10 ? (
                <img
                  src={caseData.petPhotoUrl}
                  alt={caseData.petName || 'Pet photo'}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-cyan-500/50"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center ring-2 ring-cyan-500/30">
                  <span className="text-2xl">
                    {caseData.petSpecies === 'DOG' ? '🐕' : caseData.petSpecies === 'CAT' ? '🐈' : '🐾'}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-bold text-lg leading-tight">
                  {caseData.petName || 'Unknown Pet'}
                </h1>
                <p className="text-sm text-slate-400">
                  {caseData.petColor} {caseData.petSpecies?.toLowerCase()} • #{caseData.caseNumber}
                </p>
              </div>
            </div>

            {/* Time elapsed badge */}
            <div className={`
              flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
              ${urgency === 'CRITICAL' ? 'bg-red-500/20 text-red-400 animate-pulse' : ''}
              ${urgency === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : ''}
              ${urgency === 'ELEVATED' ? 'bg-yellow-500/20 text-yellow-400' : ''}
              ${urgency === 'MODERATE' ? 'bg-cyan-500/20 text-cyan-400' : ''}
              ${urgency === 'EXTENDED' ? 'bg-slate-500/20 text-slate-400' : ''}
            `}>
              <span className="text-lg">⏱</span>
              <span>{timeElapsed || 'Unknown'}</span>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <StatusBadge status={caseData.status} />
            {caseData.assignments?.[0]?.rescueSquad && (
              <span className="text-slate-400">
                Squad: <span className="text-cyan-400">{caseData.assignments[0].rescueSquad.name}</span>
              </span>
            )}
            <span className="text-slate-500">
              {caseData._count?.sightings || 0} sightings • {caseData._count?.updates || 0} updates
            </span>
          </div>
        </div>

        {/* Mobile panel selector */}
        <div className="lg:hidden flex border-t border-slate-700/50">
          {['info', 'map', 'activity'].map((panel) => (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              className={`
                flex-1 py-3 text-sm font-medium capitalize transition
                ${activePanel === panel
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-400 hover:text-slate-300'}
              `}
            >
              {panel === 'info' && '📋 '}
              {panel === 'map' && '🗺️ '}
              {panel === 'activity' && '💬 '}
              {panel}
            </button>
          ))}
        </div>
      </header>

      {/* Main content - three columns on desktop */}
      <main className="lg:flex lg:h-[calc(100vh-120px)]">
        {/* Left Panel - Case Info */}
        <aside className={`
          lg:w-80 lg:border-r lg:border-slate-700/50 lg:overflow-y-auto
          ${activePanel === 'info' ? 'block' : 'hidden lg:block'}
        `}>
          <CaseInfoPanel
            caseData={caseData}
            userRole={userRole}
            onUpdate={fetchCase}
          />
        </aside>

        {/* Center Panel - Map */}
        <section className={`
          lg:flex-1 lg:overflow-hidden
          ${activePanel === 'map' ? 'block' : 'hidden lg:block'}
        `}>
          <CaseMapPanel
            caseData={caseData}
            onSightingClick={(sighting) => {
              // Could open sighting detail modal
              console.log('Sighting clicked:', sighting);
            }}
          />
        </section>

        {/* Right Panel - Activity/Chat */}
        <aside className={`
          lg:w-96 lg:border-l lg:border-slate-700/50 lg:overflow-hidden lg:flex lg:flex-col
          ${activePanel === 'activity' ? 'block' : 'hidden lg:block'}
        `}>
          <CaseActivityPanel
            caseData={caseData}
            userRole={userRole}
            currentUserId={session?.user?.id}
            onUpdate={fetchCase}
          />
        </aside>
      </main>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }) {
  const config = {
    ACTIVE: { label: 'Active', bg: 'bg-green-500/20', text: 'text-green-400', glow: 'shadow-green-500/20' },
    IN_PROGRESS: { label: 'Searching', bg: 'bg-cyan-500/20', text: 'text-cyan-400', glow: 'shadow-cyan-500/20', pulse: true },
    SIGHTING_REPORTED: { label: 'Sighting!', bg: 'bg-yellow-500/20', text: 'text-yellow-400', glow: 'shadow-yellow-500/20', pulse: true },
    REUNITED: { label: 'Reunited', bg: 'bg-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    CLOSED_OTHER: { label: 'Closed', bg: 'bg-slate-500/20', text: 'text-slate-400' },
  };

  const cfg = config[status] || config.ACTIVE;

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
      ${cfg.bg} ${cfg.text} ${cfg.glow ? `shadow-lg ${cfg.glow}` : ''}
      ${cfg.pulse ? 'animate-pulse' : ''}
    `}>
      {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {cfg.label}
    </span>
  );
}
