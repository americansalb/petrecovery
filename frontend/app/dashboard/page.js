'use client';

/**
 * Dashboard Page - Balanced Community Design
 *
 * Priority order:
 * 1. My Missions (your pets) - always visible at top
 * 2. My Rescue Forces (your community)
 * 3. Help Nearby (other missions you can help with)
 * 4. Quick Actions
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MapPin, Search, Clock, Bell, ChevronRight,
  AlertCircle, PawPrint, Heart, Eye, Plus,
  Siren, UserPlus
} from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchData() {
      if (!session?.user) return;
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          const body = await res.json().catch(() => ({}));
          throw new Error(body.details || body.error || 'Server error');
        }
        const data = await res.json();
        setUserData(data);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    if (status === 'authenticated') fetchData();
  }, [session, status]);

  // Loading
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!session || !userData) return null;

  const { user, squads = [], missions = [], activeSearches = [], nearbyAlerts = [] } = userData;
  const firstName = user?.firstName || session.user?.name?.split(' ')[0] || 'there';
  const hasSquads = squads.length > 0;

  // Separate user's own missions from missions they're helping with
  const myMissions = missions.filter(m => m.isOwner);
  const helpingMissions = missions.filter(m => !m.isOwner);

  // Urgent nearby missions (first 48 hours are critical)
  const urgentNearby = nearbyAlerts.filter(a => {
    const hours = parseInt(a.hoursMissing) || 999;
    return hours < 48;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Active Search Banner */}
      {activeSearches.length > 0 && (
        <Link
          href={`/mission-control?mission=${activeSearches[0].missionId}`}
          className="block bg-red-500 hover:bg-red-600 transition-colors"
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="font-bold">GPS Search Active</span>
              <span className="opacity-80">
                {activeSearches[0].petName} • {activeSearches[0].durationMinutes}m
              </span>
            </div>
            <span className="text-sm opacity-80">View →</span>
          </div>
        </Link>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Hi, {firstName}
          </h1>
        </div>

        {/* ============================================ */}
        {/* SECTION 1: MY MISSIONS (Your Pets)          */}
        {/* ============================================ */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900">My Pets</h2>
            </div>
            <Link
              href="/report/new"
              className="flex items-center gap-1 text-sm text-amber-600 font-medium hover:text-amber-700"
            >
              <Plus className="w-4 h-4" />
              Report Lost Pet
            </Link>
          </div>
          <p className="text-xs text-slate-500 mb-3 ml-7">Lost pets you reported</p>

          {myMissions.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {myMissions.map((mission, i) => (
                <Link
                  key={mission.id}
                  href={`/mission-control?mission=${mission.id}`}
                  className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                    i > 0 ? 'border-t border-slate-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {mission.petPhotoUrl ? (
                      <img src={mission.petPhotoUrl} alt={mission.petName} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                        <PawPrint className="w-6 h-6 text-amber-600" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">{mission.petName}</div>
                      <div className="text-sm text-slate-500">
                        {mission.status === 'ACTIVE' ? (
                          <span className="text-amber-600 font-medium">
                            Missing {mission.hoursMissing < 24 ? `${mission.hoursMissing}h` : `${Math.floor(mission.hoursMissing / 24)}d`}
                          </span>
                        ) : mission.status === 'RESOLVED' ? (
                          <span className="text-green-600 font-medium">Reunited!</span>
                        ) : (
                          <span className="text-slate-500">Safe at home</span>
                        )}
                        {mission.totalVolunteers > 0 && (
                          <span className="text-slate-400"> • {mission.totalVolunteers} helping</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-slate-100 rounded-xl p-6 text-center">
              <PawPrint className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No active missions</p>
              <p className="text-slate-400 text-xs mt-1">Your lost pet reports will appear here</p>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION 2: MY SQUADS                        */}
        {/* ============================================ */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-slate-900">My Rescue Forces</h2>
            </div>
            <Link
              href="/rescue-forces/search"
              className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700"
            >
              <Plus className="w-4 h-4" />
              Find Rescue Forces
            </Link>
          </div>

          {hasSquads ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {squads.slice(0, 3).map((squad, i) => (
                <Link
                  key={squad.id}
                  href={`/rescue-forces/${squad.id}`}
                  className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                    i > 0 ? 'border-t border-slate-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {squad.logoUrl || squad.photoUrl ? (
                      <img
                        src={squad.logoUrl || squad.photoUrl}
                        alt={squad.name}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">{squad.name}</div>
                      <div className="text-sm text-slate-500">
                        {squad.memberCount} members
                        {squad.activeMissions > 0 && (
                          <span className="text-amber-600 font-medium"> • {squad.activeMissions} active</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-1">Join a Rescue Force</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Connect with volunteers in your area to help find lost pets together.
                  </p>
                  <Link href="/rescue-forces/search">
                    <button className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors">
                      Find Rescue Forces Near Me
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SECTION 3: HELP NEARBY                      */}
        {/* ============================================ */}
        {urgentNearby.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Siren className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-bold text-slate-900">Urgent Nearby</h2>
              </div>
              <Link
                href="/database?filter=nearby"
                className="text-sm text-red-600 font-medium hover:text-red-700"
              >
                View All →
              </Link>
            </div>
            <p className="text-xs text-slate-500 mb-3 ml-7">Pets near you that need help now</p>
            <div className="bg-white border-2 border-red-200 rounded-xl overflow-hidden">
              {urgentNearby.slice(0, 3).map((alert, i) => (
                <Link
                  key={alert.id}
                  href={`/mission-control?mission=${alert.id}`}
                  className={`flex items-center justify-between p-4 hover:bg-red-50 transition-colors ${
                    i > 0 ? 'border-t border-red-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {alert.petPhotoUrl ? (
                      <img src={alert.petPhotoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                        <PawPrint className="w-6 h-6 text-red-600" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">{alert.petName}</div>
                      <div className="text-sm text-red-600 font-medium">
                        {alert.distance} • {alert.hoursMissing < 24 ? `${alert.hoursMissing}h` : `${Math.floor(alert.hoursMissing / 24)}d`} missing
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg">
                    Help
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SECTION 4: QUICK ACTIONS                    */}
        {/* ============================================ */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/report/found" className="group">
            <div className="bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-4 transition-all group-hover:shadow-md text-center">
              <Eye className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              <div className="font-semibold text-slate-900 text-sm">Found a Pet?</div>
            </div>
          </Link>
          <Link href="/database" className="group">
            <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all group-hover:shadow-md text-center">
              <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <div className="font-semibold text-slate-900 text-sm">Search Database</div>
            </div>
          </Link>
        </div>

        {/* Missions I'm Helping */}
        {helpingMissions.length > 0 && (
          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5 text-pink-500" />
              <h2 className="text-lg font-bold text-slate-900">Helping Find</h2>
            </div>
            <p className="text-xs text-slate-500 mb-3 ml-7">Other people&apos;s pets you&apos;re searching for</p>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {helpingMissions.slice(0, 3).map((mission, i) => (
                <Link
                  key={mission.id}
                  href={`/mission-control?mission=${mission.id}`}
                  className={`flex items-center justify-between p-3 hover:bg-slate-50 transition-colors ${
                    i > 0 ? 'border-t border-slate-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {mission.petPhotoUrl ? (
                      <img src={mission.petPhotoUrl} alt={mission.petName} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                        <PawPrint className="w-5 h-5 text-pink-600" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-900">{mission.petName}</div>
                      <div className="text-xs text-slate-500">
                        {mission.hoursMissing < 24 ? `${mission.hoursMissing}h` : `${Math.floor(mission.hoursMissing / 24)}d`} missing
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty State - New User */}
        {!hasSquads && urgentNearby.length === 0 && myMissions.length === 0 && helpingMissions.length === 0 && (
          <div className="bg-slate-100 rounded-xl p-8 text-center">
            <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">Welcome!</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Join a rescue force to connect with volunteers in your area and help find lost pets together.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
