'use client';

/**
 * Case Command Center - SAR Operations Interface
 *
 * Purpose-built for Search and Rescue operations with responsive design:
 * - Mobile: Field searcher view (full map + floating actions)
 * - Tablet: Team lead view (map + side panel)
 * - Desktop: Coordinator view (full dashboard)
 *
 * Design Philosophy: "Calm Urgency" - Clear, focused, minimal cognitive load
 *
 * Per spec: This is the tactical page for ONE lost pet - mission control for one case.
 * All interactions here are case-specific, not city-wide.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Lazy load map for better performance
const MapView = dynamic(() => import('./SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  )
});

// Standard checklist tasks for lost pet cases (per spec: concrete, actionable items)
const DEFAULT_CHECKLIST = [
  { id: 'alert_neighbors', label: 'Alert neighbors & nearby residents', icon: '🏠', category: 'immediate' },
  { id: 'post_flyers', label: 'Post flyers in the area', icon: '📄', category: 'immediate' },
  { id: 'call_shelters', label: 'Call local shelters', icon: '📞', category: 'immediate' },
  { id: 'check_yard', label: 'Search your property thoroughly', icon: '🔍', category: 'immediate' },
  { id: 'social_media', label: 'Post on social media', icon: '📱', category: 'outreach' },
  { id: 'check_shelters', label: 'Visit shelters in person', icon: '🏥', category: 'outreach' },
  { id: 'night_search', label: 'Search at dawn/dusk (quiet time)', icon: '🌙', category: 'search' },
  { id: 'leave_items', label: 'Leave familiar items outside', icon: '👕', category: 'search' },
];

export default function CaseCommandCenter({ caseId, caseNumber, onClose }) {
  const { data: session } = useSession();
  const router = useRouter();

  // Core state
  const [caseData, setCaseData] = useState(null);
  const [sightings, setSightings] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [activeView, setActiveView] = useState('map'); // map | timeline | checklist | team
  const [activePanel, setActivePanel] = useState('activity'); // activity | checklist | info (for desktop right panel)
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [userStatus, setUserStatus] = useState('READY'); // READY | SEARCHING | BREAK | DONE
  const [showPetCard, setShowPetCard] = useState(true);

  // Responsive detection
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1280);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Fetch case data
  const fetchCase = useCallback(async () => {
    try {
      const identifier = caseId || caseNumber;
      const res = await fetch(`/api/cases/${identifier}`);
      if (!res.ok) throw new Error('Case not found');
      const data = await res.json();
      setCaseData(data);
      setError(null);

      // Initialize checklist from case data or defaults
      initializeChecklist(data);

      // Build initial timeline
      buildTimeline(data, []);
    } catch (err) {
      console.error('Error fetching case:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, caseNumber]);

  // Initialize checklist with saved state or defaults
  const initializeChecklist = (data) => {
    const savedChecklist = data.checklist || [];
    const initialChecklist = DEFAULT_CHECKLIST.map(item => ({
      ...item,
      completed: savedChecklist.includes(item.id),
      completedAt: null,
    }));
    setChecklist(initialChecklist);
  };

  // Build timeline from case events
  const buildTimeline = useCallback((data, sightingsList) => {
    const events = [];

    // Case created
    if (data?.createdAt) {
      events.push({
        id: 'case_created',
        type: 'system',
        icon: '📋',
        title: 'Case reported',
        description: `${data.petName || 'Pet'} reported missing`,
        timestamp: new Date(data.createdAt),
      });
    }

    // Last seen event
    if (data?.lastSeenAt) {
      events.push({
        id: 'last_seen',
        type: 'location',
        icon: '📍',
        title: 'Last seen',
        description: data.lastSeenAddress || 'Location recorded',
        timestamp: new Date(data.lastSeenAt),
      });
    }

    // Squad assigned
    if (data?.squadId && data?.squad) {
      events.push({
        id: 'squad_assigned',
        type: 'team',
        icon: '👥',
        title: 'Squad assigned',
        description: `${data.squad.displayName || data.squad.name} joined`,
        timestamp: new Date(data.updatedAt || data.createdAt),
      });
    }

    // Sightings
    sightingsList.forEach((sighting, index) => {
      events.push({
        id: `sighting_${sighting.id}`,
        type: 'sighting',
        icon: '👁️',
        title: `Sighting #${index + 1}`,
        description: sighting.description || sighting.address || 'Sighting reported',
        timestamp: new Date(sighting.createdAt || sighting.sightedAt),
        confidence: sighting.confidence,
      });
    });

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);
    setTimeline(events);
  }, []);

  // Fetch sightings
  const fetchSightings = useCallback(async () => {
    if (!caseData?.id) return;
    try {
      const res = await fetch(`/api/cases/${caseData.id}/sightings`);
      if (res.ok) {
        const data = await res.json();
        const sightingsList = data.sightings || [];
        setSightings(sightingsList);

        // Update timeline with sightings
        buildTimeline(caseData, sightingsList);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    }
  }, [caseData, buildTimeline]);

  // Toggle checklist item
  const toggleChecklistItem = async (itemId) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date() : null }
        : item
    ));

    // Persist to backend (fire and forget)
    if (caseData?.id) {
      try {
        await fetch(`/api/cases/${caseData.id}/checklist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, completed: !checklist.find(i => i.id === itemId)?.completed }),
        });
      } catch (err) {
        console.error('Error saving checklist:', err);
      }
    }
  };

  // Navigate back to Squad Hub
  const handleBackToSquad = () => {
    if (caseData?.squad?.id) {
      router.push(`/rescue-squads/${caseData.squad.id}`);
    } else if (caseData?.squadId) {
      router.push(`/rescue-squads/${caseData.squadId}`);
    } else {
      // Fallback to cases list
      router.push('/cases');
    }
  };

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  useEffect(() => {
    if (caseData?.id) {
      fetchSightings();
      // Poll for updates every 30 seconds
      const interval = setInterval(fetchSightings, 30000);
      return () => clearInterval(interval);
    }
  }, [caseData?.id, fetchSightings]);

  // Calculate time missing
  const getTimeMissing = () => {
    if (!caseData?.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50 p-4">
        <div className="bg-red-900/30 border border-red-500/50 rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Case</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={onClose || (() => window.history.back())}
            className="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const timeMissing = getTimeMissing();
  const isUrgent = timeMissing && parseInt(timeMissing) < 24;

  // ============================================================================
  // MOBILE VIEW - Field Searcher Interface
  // ============================================================================
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
        {/* Compact Header */}
        <div className="bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-2 flex items-center justify-between safe-area-top">
          <button
            onClick={onClose || (() => window.history.back())}
            className="p-2 -ml-2 text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 text-center">
            <span className="text-white font-bold">{caseData?.petName || 'Unknown'}</span>
            {timeMissing && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {timeMissing} missing
              </span>
            )}
          </div>

          <button
            onClick={() => setShowPetCard(!showPetCard)}
            className="p-2 -mr-2 text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Collapsible Pet Card */}
        {showPetCard && (
          <div className="bg-slate-900 border-b border-slate-800 p-3">
            <div className="flex items-center gap-3">
              {caseData?.petPhotoUrl ? (
                <img src={caseData.petPhotoUrl} alt={caseData.petName} className="w-14 h-14 rounded-xl object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center text-2xl">
                  {caseData?.petSpecies === 'DOG' ? '🐕' : caseData?.petSpecies === 'CAT' ? '🐈' : '🐾'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white truncate">{caseData?.petName}</span>
                  <span className="text-xs text-slate-500">{caseData?.petBreed}</span>
                </div>
                <p className="text-sm text-slate-400 truncate">
                  {caseData?.petColor} {caseData?.petSpecies?.toLowerCase()}
                </p>
                <p className="text-xs text-slate-500 truncate">{caseData?.lastSeenAddress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Full-Screen Map */}
        <div className="flex-1 relative">
          <MapView
            center={caseData?.lastSeenLatitude && caseData?.lastSeenLongitude
              ? [caseData.lastSeenLatitude, caseData.lastSeenLongitude]
              : [41.8781, -87.6298]}
            lastSeen={caseData?.lastSeenLatitude ? {
              lat: caseData.lastSeenLatitude,
              lng: caseData.lastSeenLongitude,
              address: caseData.lastSeenAddress
            } : null}
            sightings={sightings}
            petSpecies={caseData?.petSpecies}
            hoursElapsed={timeMissing ? parseInt(timeMissing) : 24}
          />

          {/* Status Toggle (top-left) */}
          <div className="absolute top-4 left-4 z-10">
            <select
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value)}
              className="bg-slate-900/90 backdrop-blur text-white text-sm font-semibold rounded-xl px-3 py-2 border border-slate-700"
            >
              <option value="READY">🔵 Ready</option>
              <option value="SEARCHING">🟢 Searching</option>
              <option value="BREAK">🟡 On Break</option>
              <option value="DONE">⚫ Done</option>
            </select>
          </div>

          {/* Sighting Count Badge (top-right) */}
          {sightings.length > 0 && (
            <div className="absolute top-4 right-4 z-10">
              <div className="bg-amber-500/90 backdrop-blur text-white text-sm font-bold rounded-xl px-3 py-2">
                👁 {sightings.length} sighting{sightings.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4 safe-area-bottom">
          <div className="flex gap-3">
            {/* Report Sighting - Primary Action */}
            <button
              onClick={() => setShowSightingForm(true)}
              className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-2xl shadow-lg shadow-amber-500/30 active:scale-95 transition"
            >
              👁 Report Sighting
            </button>

            {/* More Actions */}
            <button
              onClick={() => setActiveView(activeView === 'activity' ? 'map' : 'activity')}
              className="p-4 bg-slate-800 text-slate-300 rounded-2xl border border-slate-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sighting Form Modal */}
        {showSightingForm && (
          <SightingFormModal
            caseId={caseData?.id}
            onClose={() => setShowSightingForm(false)}
            onSuccess={() => {
              setShowSightingForm(false);
              fetchSightings();
            }}
          />
        )}

        {/* Activity Sheet (slides up) */}
        {activeView === 'activity' && (
          <div className="absolute inset-0 bg-slate-950/80 z-40" onClick={() => setActiveView('map')}>
            <div
              className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl max-h-[70vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-slate-900 p-4 border-b border-slate-800">
                <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Recent Activity</h3>
              </div>
              <div className="p-4 space-y-3">
                {sightings.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No sightings reported yet</p>
                ) : (
                  sightings.map((s, i) => (
                    <div key={s.id || i} className="bg-slate-800/50 rounded-xl p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                          👁
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm">{s.description || 'Sighting reported'}</p>
                          <p className="text-slate-500 text-xs mt-1">{s.address}</p>
                          <p className="text-slate-600 text-xs">
                            {new Date(s.sightedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // TABLET VIEW - Team Lead Interface
  // ============================================================================
  if (isTablet) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex">
        {/* Map Section (60%) */}
        <div className="w-[60%] relative">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-slate-950 to-transparent p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose || (() => window.history.back())}
                className="p-2 bg-slate-900/80 backdrop-blur rounded-xl text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur rounded-xl px-4 py-2">
                {caseData?.petPhotoUrl ? (
                  <img src={caseData.petPhotoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    {caseData?.petSpecies === 'DOG' ? '🐕' : '🐈'}
                  </div>
                )}
                <div>
                  <div className="font-bold text-white">{caseData?.petName}</div>
                  <div className="text-xs text-slate-400">{caseData?.petBreed} • {caseData?.petColor}</div>
                </div>
                {timeMissing && (
                  <div className={`ml-2 px-2 py-1 rounded-lg text-xs font-bold ${isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {timeMissing}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <MapView
            center={caseData?.lastSeenLatitude && caseData?.lastSeenLongitude
              ? [caseData.lastSeenLatitude, caseData.lastSeenLongitude]
              : [41.8781, -87.6298]}
            lastSeen={caseData?.lastSeenLatitude ? {
              lat: caseData.lastSeenLatitude,
              lng: caseData.lastSeenLongitude,
              address: caseData.lastSeenAddress
            } : null}
            sightings={sightings}
            petSpecies={caseData?.petSpecies}
            hoursElapsed={timeMissing ? parseInt(timeMissing) : 24}
          />

          {/* Report Button */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={() => setShowSightingForm(true)}
              className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition flex items-center gap-2"
            >
              <span className="text-xl">👁</span>
              Report Sighting
            </button>
          </div>
        </div>

        {/* Side Panel (40%) */}
        <div className="w-[40%] bg-slate-900 border-l border-slate-800 flex flex-col">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-800">
            {['activity', 'team', 'info'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveView(tab)}
                className={`flex-1 py-4 text-sm font-semibold capitalize transition ${
                  activeView === tab
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'activity' && '📋 '}
                {tab === 'team' && '👥 '}
                {tab === 'info' && '📍 '}
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeView === 'activity' && (
              <div className="space-y-3">
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
                  Recent Sightings ({sightings.length})
                </h3>
                {sightings.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    <div className="text-4xl mb-3">👀</div>
                    <p>No sightings yet</p>
                  </div>
                ) : (
                  sightings.map((s, i) => (
                    <div key={s.id || i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                          👁
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">{s.description || 'Possible sighting'}</p>
                          <p className="text-slate-500 text-xs mt-1 truncate">{s.address}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-slate-600 text-xs">
                              {new Date(s.sightedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {s.isVerified && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">✓ Verified</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeView === 'team' && (
              <div className="space-y-3">
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
                  Search Team
                </h3>
                <div className="text-center py-12 text-slate-600">
                  <div className="text-4xl mb-3">👥</div>
                  <p>No team members assigned</p>
                  <button className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-semibold">
                    + Invite Volunteers
                  </button>
                </div>
              </div>
            )}

            {activeView === 'info' && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h4 className="text-slate-400 text-xs font-semibold uppercase mb-3">Last Seen</h4>
                  <p className="text-white">{caseData?.lastSeenAddress || 'Unknown'}</p>
                  {caseData?.lastSeenAt && (
                    <p className="text-slate-500 text-sm mt-1">
                      {new Date(caseData.lastSeenAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h4 className="text-slate-400 text-xs font-semibold uppercase mb-3">Description</h4>
                  <p className="text-white text-sm">{caseData?.petDescription || 'No description provided'}</p>
                </div>

                {caseData?.ownerPhone && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <h4 className="text-slate-400 text-xs font-semibold uppercase mb-3">Contact</h4>
                    <a href={`tel:${caseData.ownerPhone}`} className="text-cyan-400 font-semibold">
                      📞 {caseData.ownerPhone}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sighting Form Modal */}
        {showSightingForm && (
          <SightingFormModal
            caseId={caseData?.id}
            onClose={() => setShowSightingForm(false)}
            onSuccess={() => {
              setShowSightingForm(false);
              fetchSightings();
            }}
          />
        )}
      </div>
    );
  }

  // Calculate checklist progress
  const checklistProgress = checklist.filter(i => i.completed).length;
  const checklistTotal = checklist.length;

  // ============================================================================
  // DESKTOP VIEW - Coordinator Dashboard
  // ============================================================================
  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex">
      {/* Left Panel - Pet Info & Stats */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <button
            onClick={handleBackToSquad}
            className="text-slate-400 hover:text-white text-sm flex items-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {caseData?.squad ? `Back to ${caseData.squad.displayName || caseData.squad.name}` : 'Back to Cases'}
          </button>

          {/* Pet Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-start gap-4">
              {caseData?.petPhotoUrl ? (
                <img src={caseData.petPhotoUrl} alt={caseData.petName} className="w-20 h-20 rounded-xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-700 flex items-center justify-center text-3xl">
                  {caseData?.petSpecies === 'DOG' ? '🐕' : caseData?.petSpecies === 'CAT' ? '🐈' : '🐾'}
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{caseData?.petName || 'Unknown'}</h2>
                <p className="text-slate-400 text-sm">{caseData?.petBreed}</p>
                <p className="text-slate-500 text-sm">{caseData?.petColor} • {caseData?.petSize}</p>
              </div>
            </div>

            {timeMissing && (
              <div className={`mt-4 py-2 px-3 rounded-xl text-center font-bold ${
                isUrgent
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                ⏱ Missing for {timeMissing}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-cyan-400">{sightings.length}</div>
              <div className="text-xs text-slate-500">Sightings</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">0</div>
              <div className="text-xs text-slate-500">Searchers</div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="text-xs text-slate-500 mb-1">Last Seen</div>
            <div className="text-white text-sm">{caseData?.lastSeenAddress || 'Unknown'}</div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="text-xs text-slate-500 mb-1">Description</div>
            <div className="text-white text-sm line-clamp-3">{caseData?.petDescription || 'No description'}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-auto p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setShowSightingForm(true)}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl"
          >
            👁 Report Sighting
          </button>
          <button className="w-full py-3 bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-700 hover:bg-slate-700">
            📤 Share Case
          </button>
        </div>
      </div>

      {/* Center - Map */}
      <div className="flex-1 relative">
        <MapView
          center={caseData?.lastSeenLatitude && caseData?.lastSeenLongitude
            ? [caseData.lastSeenLatitude, caseData.lastSeenLongitude]
            : [41.8781, -87.6298]}
          lastSeen={caseData?.lastSeenLatitude ? {
            lat: caseData.lastSeenLatitude,
            lng: caseData.lastSeenLongitude,
            address: caseData.lastSeenAddress
          } : null}
          sightings={sightings}
          petSpecies={caseData?.petSpecies}
          hoursElapsed={timeMissing ? parseInt(timeMissing) : 24}
          showControls
        />
      </div>

      {/* Right Panel - Activity, Timeline, Checklist */}
      <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800">
          {[
            { id: 'activity', label: 'Activity', icon: '📋' },
            { id: 'timeline', label: 'Timeline', icon: '⏱️' },
            { id: 'checklist', label: 'Tasks', icon: '✅' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={`flex-1 py-3 px-2 text-sm font-semibold transition ${
                activePanel === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* Activity Tab - Sightings */}
          {activePanel === 'activity' && (
            <div className="p-4">
              {sightings.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  <div className="text-5xl mb-4">👀</div>
                  <p className="text-lg font-semibold">No sightings yet</p>
                  <p className="text-sm mt-2">Reported sightings will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sightings.map((s, i) => (
                    <div key={s.id || i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                          👁
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-semibold text-sm">Sighting #{sightings.length - i}</span>
                            <span className="text-slate-600 text-xs">
                              {new Date(s.sightedAt || s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1">{s.description || 'No details'}</p>
                          <p className="text-slate-600 text-xs mt-2">{s.address}</p>
                          {s.confidence && (
                            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                              s.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                              s.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {s.confidence} confidence
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab - Case Events */}
          {activePanel === 'timeline' && (
            <div className="p-4">
              {timeline.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  <div className="text-5xl mb-4">⏱️</div>
                  <p className="text-lg font-semibold">No events yet</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />

                  <div className="space-y-4">
                    {timeline.map((event, i) => (
                      <div key={event.id} className="relative pl-10">
                        {/* Timeline dot */}
                        <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                          event.type === 'sighting' ? 'bg-amber-500/30 border-2 border-amber-500' :
                          event.type === 'location' ? 'bg-red-500/30 border-2 border-red-500' :
                          event.type === 'team' ? 'bg-green-500/30 border-2 border-green-500' :
                          'bg-slate-700 border-2 border-slate-600'
                        }`}>
                          {event.icon}
                        </div>

                        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-semibold text-sm">{event.title}</span>
                            <span className="text-slate-600 text-xs">
                              {event.timestamp.toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1">{event.description}</p>
                          {event.confidence && (
                            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                              event.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                              event.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {event.confidence} confidence
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Checklist Tab - Action Items */}
          {activePanel === 'checklist' && (
            <div className="p-4">
              {/* Progress bar */}
              <div className="mb-4 bg-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">Progress</span>
                  <span className="text-white font-bold">{checklistProgress} / {checklistTotal}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${(checklistProgress / checklistTotal) * 100}%` }}
                  />
                </div>
              </div>

              {/* Grouped checklist items */}
              <div className="space-y-4">
                {/* Immediate Actions */}
                <div>
                  <h4 className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>⚡</span> Do First
                  </h4>
                  <div className="space-y-2">
                    {checklist.filter(i => i.category === 'immediate').map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleChecklistItem(item.id)}
                        className={`w-full text-left p-3 rounded-xl transition flex items-center gap-3 ${
                          item.completed
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                          item.completed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 border-2 border-slate-600'
                        }`}>
                          {item.completed ? '✓' : item.icon}
                        </span>
                        <span className={`flex-1 text-sm ${item.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outreach */}
                <div>
                  <h4 className="text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>📢</span> Outreach
                  </h4>
                  <div className="space-y-2">
                    {checklist.filter(i => i.category === 'outreach').map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleChecklistItem(item.id)}
                        className={`w-full text-left p-3 rounded-xl transition flex items-center gap-3 ${
                          item.completed
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                          item.completed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 border-2 border-slate-600'
                        }`}>
                          {item.completed ? '✓' : item.icon}
                        </span>
                        <span className={`flex-1 text-sm ${item.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div>
                  <h4 className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>🔍</span> Search Tips
                  </h4>
                  <div className="space-y-2">
                    {checklist.filter(i => i.category === 'search').map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleChecklistItem(item.id)}
                        className={`w-full text-left p-3 rounded-xl transition flex items-center gap-3 ${
                          item.completed
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                          item.completed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 border-2 border-slate-600'
                        }`}>
                          {item.completed ? '✓' : item.icon}
                        </span>
                        <span className={`flex-1 text-sm ${item.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sighting Form Modal */}
      {showSightingForm && (
        <SightingFormModal
          caseId={caseData?.id}
          onClose={() => setShowSightingForm(false)}
          onSuccess={() => {
            setShowSightingForm(false);
            fetchSightings();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sighting Form Modal Component
// ============================================================================
function SightingFormModal({ caseId, onClose, onSuccess }) {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [confidence, setConfidence] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGettingLocation(false);
          // Reverse geocode for address
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
            .then(r => r.json())
            .then(data => setAddress(data.display_name || ''))
            .catch(() => {});
        },
        () => setGettingLocation(false),
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = async () => {
    if (!location) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/cases/${caseId}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          address,
          description,
          confidence
        })
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert('Failed to submit sighting. Please try again.');
      }
    } catch (err) {
      alert('Error submitting sighting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Report Sighting</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Location */}
          <div>
            <label className="text-slate-400 text-sm font-semibold block mb-2">Location *</label>
            {location ? (
              <div className="bg-slate-800 rounded-xl p-3">
                <div className="text-emerald-400 text-sm font-semibold">✓ Location captured</div>
                <div className="text-slate-500 text-xs mt-1">{address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</div>
              </div>
            ) : (
              <button
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                className="w-full py-3 bg-cyan-500/20 text-cyan-400 font-semibold rounded-xl border border-cyan-500/30 hover:bg-cyan-500/30 transition"
              >
                {gettingLocation ? '📍 Getting location...' : '📍 Use My Current Location'}
              </button>
            )}
          </div>

          {/* Confidence */}
          <div>
            <label className="text-slate-400 text-sm font-semibold block mb-2">How sure are you?</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'HIGH', label: "It's them!", color: 'emerald' },
                { value: 'MEDIUM', label: 'Looks like them', color: 'amber' },
                { value: 'LOW', label: 'Maybe', color: 'slate' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfidence(opt.value)}
                  className={`py-2 px-3 rounded-xl text-sm font-semibold transition ${
                    confidence === opt.value
                      ? opt.color === 'emerald' ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                        : opt.color === 'amber' ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                        : 'bg-slate-700 text-slate-300 border border-slate-600'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-slate-400 text-sm font-semibold block mb-2">What did you see?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Direction they were heading, behavior, any other details..."
              className="w-full bg-slate-800 text-white rounded-xl p-3 border border-slate-700 focus:border-cyan-500 focus:outline-none resize-none h-24"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleSubmit}
            disabled={!location || submitting}
            className={`w-full py-4 font-bold rounded-xl transition ${
              location && !submitting
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit Sighting'}
          </button>
        </div>
      </div>
    </div>
  );
}
