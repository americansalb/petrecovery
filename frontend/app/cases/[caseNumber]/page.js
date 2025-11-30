'use client';

/**
 * Case Detail Page with Command Center
 *
 * Two view modes:
 * - Public view: Basic case info for unauthenticated/visitors
 * - Command Center: Full coordination interface for participants
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import MatchesPanel from '@/app/components/MatchesPanel';
import MissionControl from '@/app/components/missionControl/MissionControl';
import CaseCommandCenter from '@/app/components/case/CaseCommandCenter';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { caseNumber } = params;

  const [caseData, setCaseData] = useState(null);
  const [missionState, setMissionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState('VISITOR');
  const [showMissionControl, setShowMissionControl] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (caseNumber) {
      fetchCaseDetail();
    }
  }, [caseNumber]);

  // Determine user role when session/case data changes
  useEffect(() => {
    if (session?.user && caseData) {
      determineUserRole();
    }
  }, [session, caseData]);

  const fetchCaseDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/cases/${caseNumber}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setError('Case not found or not publicly available');
        } else {
          throw new Error(data.message || 'Failed to load case');
        }
        return;
      }

      setCaseData(data);

      // Fetch mission state if case has one
      if (data.id) {
        fetchMissionState(data.id);
      }
    } catch (err) {
      console.error('Error fetching case detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMissionState = async (caseId) => {
    try {
      const res = await fetch(`/api/mission/${caseId}`);
      if (res.ok) {
        const mission = await res.json();
        setMissionState(mission);

        // Auto-show Mission Control if live
        if (mission.isLive) {
          setShowMissionControl(true);
        }
      }
    } catch (err) {
      console.error('Error fetching mission state:', err);
    }
  };

  const determineUserRole = async () => {
    if (!session?.user?.id || !caseData) {
      setUserRole('VISITOR');
      return;
    }

    // Check if owner
    if (caseData.reporterId === session.user.id) {
      setUserRole('OWNER');
      return;
    }

    // Check if squad/division leader
    try {
      const res = await fetch(`/api/cases/${caseData.id}/user-role`);
      if (res.ok) {
        const { role } = await res.json();
        setUserRole(role || 'VOLUNTEER');
      }
    } catch {
      setUserRole('VOLUNTEER');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-cyan-100 text-cyan-800 animate-pulse';
      case 'SIGHTING_REPORTED': return 'bg-yellow-100 text-yellow-800 animate-pulse';
      case 'REUNITED': return 'bg-emerald-100 text-emerald-800';
      case 'CLOSED_OTHER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'ACTIVE': return 'Active';
      case 'IN_PROGRESS': return '🔍 Searching';
      case 'SIGHTING_REPORTED': return '👁️ Sighting!';
      case 'REUNITED': return '🎉 Reunited';
      case 'CLOSED_OTHER': return 'Closed';
      default: return status;
    }
  };

  // Should show Command Center for authenticated users with roles
  const shouldShowCommandCenter = session?.user &&
    (userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'PARTICIPANT' || userRole === 'LEADER');

  const handleShare = async () => {
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Lost Pet: ${caseData.petName || 'Unknown Pet'}`,
          text: `Help find this lost ${caseData.petSpecies}!`,
          url: shareUrl
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleJoinSearch = () => {
    router.push(`/join/${caseData.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-400">Loading case...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="container mx-auto px-4 max-w-4xl py-12">
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-red-300 mb-4">Case Not Found</h1>
            <p className="text-red-400 mb-6">{error || 'This case does not exist.'}</p>
            <button
              onClick={() => router.push('/cases')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Back to Cases
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show Mission Control if live or user toggled it
  if (showMissionControl && missionState) {
    return (
      <div className="min-h-screen bg-gray-900">
        {/* Exit Mission Control button */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          <button
            onClick={() => setShowMissionControl(false)}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-2"
          >
            ← View Case Info
          </button>
        </div>

        <MissionControl
          caseId={caseData.id}
          userRole={userRole}
          initialState={missionState}
        />
      </div>
    );
  }

  // Show Command Center for authenticated users with appropriate roles
  if (showCommandCenter && caseData?.id) {
    return (
      <CaseCommandCenter
        caseId={caseData.id}
        caseNumber={caseData.caseNumber}
      />
    );
  }

  // Time since missing
  const hoursMissing = caseData.lastSeenAt
    ? Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000)
    : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Active Search Banner */}
      {caseData.status === 'IN_PROGRESS' && (
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="animate-pulse text-2xl">🔍</span>
            <span className="font-bold text-lg">ACTIVE SEARCH IN PROGRESS</span>
            <button
              onClick={() => setShowCommandCenter(true)}
              className="ml-4 px-4 py-2 bg-white text-cyan-600 rounded-full font-bold text-sm hover:bg-gray-100 transition"
            >
              Open Command Center →
            </button>
          </div>
        </div>
      )}

      {/* Sighting Reported Banner */}
      {caseData.status === 'SIGHTING_REPORTED' && (
        <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="animate-pulse text-2xl">👁️</span>
            <span className="font-bold text-lg">SIGHTING REPORTED!</span>
            <button
              onClick={() => setShowCommandCenter(true)}
              className="ml-4 px-4 py-2 bg-white text-amber-600 rounded-full font-bold text-sm hover:bg-gray-100 transition"
            >
              View Details →
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 max-w-4xl py-6">
          <button
            onClick={() => router.push('/cases')}
            className="text-blue-400 hover:text-blue-300 mb-4 inline-flex items-center"
          >
            ← Back to Cases
          </button>

          <div className="flex gap-6 items-start">
            {/* Pet Photo */}
            {caseData.petPhotoUrl && caseData.petPhotoUrl.length > 10 && (
              <img
                src={caseData.petPhotoUrl}
                alt={caseData.petName || 'Pet photo'}
                className="w-24 h-24 rounded-xl object-cover border-2 border-gray-600"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            {/* Fallback if no photo */}
            {(!caseData.petPhotoUrl || caseData.petPhotoUrl.length <= 10) && (
              <div className="w-24 h-24 rounded-xl bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                <span className="text-4xl">
                  {caseData.petSpecies === 'DOG' ? '🐕' : caseData.petSpecies === 'CAT' ? '🐈' : '🐾'}
                </span>
              </div>
            )}

            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-1">
                    {caseData.petName || 'Unknown Pet'}
                  </h1>
                  <p className="text-gray-400">
                    {caseData.petColor} {caseData.petSpecies}
                    {caseData.petBreed && ` • ${caseData.petBreed}`}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">Case #{caseData.caseNumber}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(caseData.status)}`}>
                  {getStatusLabel(caseData.status)}
                </span>
              </div>

              {/* Time Missing */}
              {hoursMissing !== null && caseData.status !== 'REUNITED' && caseData.status !== 'CLOSED_OTHER' && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-2xl">⏱</span>
                  <span className={`text-lg font-semibold ${hoursMissing < 24 ? 'text-red-400' : 'text-orange-400'}`}>
                    Missing for {hoursMissing < 24 ? `${hoursMissing} hours` : `${Math.floor(hoursMissing / 24)} days`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-6 space-y-6">
        {/* Command Center Access - for authenticated users */}
        {shouldShowCommandCenter && caseData.status !== 'REUNITED' && caseData.status !== 'CLOSED_OTHER' && (
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">🎯</span> Case Command Center
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Full coordination dashboard with map, timeline, and chat
                </p>
              </div>
              <button
                onClick={() => setShowCommandCenter(true)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-400 transition shadow-lg shadow-cyan-500/30"
              >
                Open Command Center →
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {caseData.status !== 'REUNITED' && caseData.status !== 'CLOSED_OTHER' && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">How You Can Help</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Join Search */}
              {missionState?.isLive ? (
                <button
                  onClick={() => setShowMissionControl(true)}
                  className="flex flex-col items-center p-4 bg-red-600 hover:bg-red-700 rounded-xl transition"
                >
                  <span className="text-3xl mb-2">🔍</span>
                  <span className="font-bold">Join Live Search</span>
                  <span className="text-sm text-red-200">{missionState.stats.activeVolunteers} searching now</span>
                </button>
              ) : (
                <button
                  onClick={handleJoinSearch}
                  className="flex flex-col items-center p-4 bg-blue-600 hover:bg-blue-700 rounded-xl transition"
                >
                  <span className="text-3xl mb-2">🔍</span>
                  <span className="font-bold">Help Search</span>
                  <span className="text-sm text-blue-200">Volunteer your time</span>
                </button>
              )}

              {/* Report Sighting */}
              <button
                onClick={() => router.push(`/report/sighting/${caseData.id}`)}
                className="flex flex-col items-center p-4 bg-green-600 hover:bg-green-700 rounded-xl transition"
              >
                <span className="text-3xl mb-2">👁</span>
                <span className="font-bold">Report Sighting</span>
                <span className="text-sm text-green-200">I saw this pet</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex flex-col items-center p-4 bg-purple-600 hover:bg-purple-700 rounded-xl transition"
              >
                <span className="text-3xl mb-2">📤</span>
                <span className="font-bold">{copySuccess ? 'Copied!' : 'Share Case'}</span>
                <span className="text-sm text-purple-200">Spread the word</span>
              </button>
            </div>

            {/* Owner/Leader: Go Live Button */}
            {(userRole === 'OWNER' || userRole === 'LEADER') && !missionState?.isLive && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowMissionControl(true)}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-lg flex items-center justify-center gap-3"
                >
                  <span className="animate-pulse">●</span>
                  Start Live Search
                </button>
                <p className="text-center text-gray-500 text-sm mt-2">
                  Activate Mission Control to coordinate volunteers in real-time
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pet Details */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Pet Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-500 text-sm">Species</p>
              <p className="font-semibold">{caseData.petSpecies}</p>
            </div>
            {caseData.petBreed && (
              <div>
                <p className="text-gray-500 text-sm">Breed</p>
                <p className="font-semibold">{caseData.petBreed}</p>
              </div>
            )}
            {caseData.petColor && (
              <div>
                <p className="text-gray-500 text-sm">Color</p>
                <p className="font-semibold">{caseData.petColor}</p>
              </div>
            )}
            {caseData.petSize && (
              <div>
                <p className="text-gray-500 text-sm">Size</p>
                <p className="font-semibold">{caseData.petSize}</p>
              </div>
            )}
          </div>
          {caseData.petDescription && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-gray-500 text-sm mb-1">Description</p>
              <p className="text-gray-300">{caseData.petDescription}</p>
            </div>
          )}
        </div>

        {/* Last Seen Location */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Last Seen Location</h2>
          <div className="space-y-3">
            {caseData.lastSeenAddress && (
              <div>
                <p className="text-gray-500 text-sm">Address</p>
                <p className="font-semibold">{caseData.lastSeenAddress}</p>
              </div>
            )}
            {caseData.lastSeenAt && (
              <div>
                <p className="text-gray-500 text-sm">When</p>
                <p className="font-semibold">
                  {new Date(caseData.lastSeenAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Map placeholder */}
          <div className="mt-4 bg-gray-700 rounded-lg h-48 flex items-center justify-center">
            <span className="text-gray-500">Map View</span>
          </div>
        </div>

        {/* Search Stats (if mission exists) */}
        {missionState && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Search Progress</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-blue-400">{missionState.stats.totalVolunteers}</p>
                <p className="text-gray-500 text-sm">Volunteers</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-400">
                  {Math.round((missionState.stats.zonesSearched / missionState.stats.totalZones) * 100) || 0}%
                </p>
                <p className="text-gray-500 text-sm">Area Searched</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-orange-400">{missionState.stats.sightingsCount}</p>
                <p className="text-gray-500 text-sm">Sightings</p>
              </div>
            </div>
          </div>
        )}

        {/* Contact Info */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Contact</h2>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4">
            <p className="text-yellow-300 text-sm">
              ⚠️ Please exercise caution when meeting strangers. Meet in public places.
            </p>
          </div>
          {caseData.contact?.phone && (
            <a
              href={`tel:${caseData.contact.phone}`}
              className="block w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-center font-bold transition"
            >
              📞 Call Owner
            </a>
          )}
        </div>

        {/* Matches Panel */}
        {caseData.status !== 'REUNITED' && caseData.status !== 'CLOSED_OTHER' && (
          <MatchesPanel caseNumber={caseNumber} />
        )}
      </div>
    </div>
  );
}
