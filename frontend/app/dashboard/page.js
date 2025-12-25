'use client';

/**
 * Dashboard Page - COMMUNITY FIRST Design
 *
 * Priority order:
 * 1. Urgent missions nearby that need help NOW
 * 2. Your squad's active missions
 * 3. Join a squad (if not in one)
 * 4. Personal cases (secondary)
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MapPin, Search, Clock, Bell, ChevronRight,
  AlertCircle, Target, PawPrint, Heart, Eye, Navigation,
  Flame, UserPlus, Siren
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
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setUserData(data);
      } catch (err) {
        setError('Failed to load dashboard');
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

  // Separate user's own cases from cases they're helping with
  const myCases = missions.filter(m => m.isOwner);
  const helpingCases = missions.filter(m => !m.isOwner);

  // Urgent nearby cases (first 24 hours are critical)
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Hi, {firstName}
          </h1>
          <p className="text-slate-500">
            {hasSquads
              ? `You're part of ${squads.length} rescue squad${squads.length > 1 ? 's' : ''}`
              : 'Join a rescue squad to help find lost pets in your area'
            }
          </p>
        </div>

        {/* ============================================ */}
        {/* SECTION 1: URGENT - PETS THAT NEED HELP NOW */}
        {/* ============================================ */}
        {urgentNearby.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Siren className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold text-slate-900">Pets Need Help Near You</h2>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl overflow-hidden">
              {urgentNearby.slice(0, 3).map((alert, i) => (
                <Link
                  key={alert.id}
                  href={`/mission-control?mission=${alert.id}`}
                  className={`flex items-center justify-between p-4 hover:bg-red-100/50 transition-colors ${
                    i > 0 ? 'border-t border-red-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                      {alert.petPhotoUrl ? (
                        <img src={alert.petPhotoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      ) : (
                        <PawPrint className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{alert.petName}</div>
                      <div className="text-sm text-red-600 font-medium">
                        {alert.distance} away • {alert.hoursMissing < 24 ? `${alert.hoursMissing}h` : `${Math.floor(alert.hoursMissing / 24)}d`} missing
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg">
                      Help Search
                    </span>
                    <ChevronRight className="w-5 h-5 text-red-400" />
                  </div>
                </Link>
              ))}
              {urgentNearby.length > 3 && (
                <Link
                  href="/database?filter=nearby"
                  className="block p-3 bg-red-100/50 text-center text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  View all {urgentNearby.length} nearby cases →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SECTION 2: YOUR SQUADS / JOIN A SQUAD       */}
        {/* ============================================ */}
        {!hasSquads ? (
          // No squads - Prominent CTA to join one
          <div className="mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">Join a Rescue Squad</h2>
                  <p className="text-blue-100 mb-4">
                    Connect with neighbors and volunteers in your area. Get notified when pets go missing nearby and coordinate searches together.
                  </p>
                  <Link href="/rescue-squads/search">
                    <button className="px-5 py-2.5 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors">
                      Find Squads Near Me
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Has squads - Show squad activity
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold text-slate-900">Your Squads</h2>
              </div>
              <Link href="/rescue-squads/search" className="text-sm text-blue-600 font-medium hover:text-blue-700">
                + Join More
              </Link>
            </div>
            <div className="grid gap-3">
              {squads.slice(0, 3).map((squad) => (
                <Link
                  key={squad.id}
                  href={`/rescue-squads/${squad.id}`}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between"
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
                          <span className="text-amber-600 font-medium"> • {squad.activeMissions} active mission{squad.activeMissions > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SECTION 3: QUICK ACTIONS                    */}
        {/* ============================================ */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {/* Lost Pet - Important but not the primary focus */}
          <Link href="/report/new" className="group">
            <div className="bg-white border-2 border-slate-200 hover:border-red-300 rounded-xl p-5 transition-all group-hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Report Lost Pet</div>
                  <div className="text-sm text-slate-500">Create an alert</div>
                </div>
              </div>
            </div>
          </Link>

          {/* Found Pet */}
          <Link href="/found" className="group">
            <div className="bg-white border-2 border-slate-200 hover:border-emerald-300 rounded-xl p-5 transition-all group-hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Found a Pet?</div>
                  <div className="text-sm text-slate-500">Help reunite them</div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Secondary Actions */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          <Link href="/database" className="flex-shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-all flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Search Database</span>
            </div>
          </Link>
          <Link href="/mission-control" className="flex-shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-all flex items-center gap-2">
              <Navigation className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Mission Control</span>
            </div>
          </Link>
          <Link href="/rescue-squads/search" className="flex-shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-all flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Find Squads</span>
            </div>
          </Link>
        </div>

        {/* ============================================ */}
        {/* SECTION 4: PERSONAL CASES (SECONDARY)       */}
        {/* ============================================ */}
        {(myCases.length > 0 || helpingCases.length > 0) && (
          <div className="border-t border-slate-200 pt-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">
              Your Activity
            </h2>

            {/* My Cases */}
            {myCases.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">My Lost Pet Reports</h3>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {myCases.slice(0, 3).map((mission, i) => (
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
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                            {mission.petSpecies === 'DOG' ? '🐕' : mission.petSpecies === 'CAT' ? '🐈' : '🐾'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{mission.petName}</div>
                          <div className="text-xs text-slate-500">
                            {mission.hoursMissing < 24 ? `${mission.hoursMissing}h` : `${Math.floor(mission.hoursMissing / 24)}d`} missing
                            {mission.totalVolunteers > 0 && ` • ${mission.totalVolunteers} helping`}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Cases I'm Helping */}
            {helpingCases.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Cases I'm Helping</h3>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {helpingCases.slice(0, 3).map((mission, i) => (
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
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                            {mission.petSpecies === 'DOG' ? '🐕' : mission.petSpecies === 'CAT' ? '🐈' : '🐾'}
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
          </div>
        )}

        {/* Empty State - New User */}
        {!hasSquads && urgentNearby.length === 0 && myCases.length === 0 && (
          <div className="bg-slate-100 rounded-2xl p-8 text-center">
            <Heart className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">Welcome to the Community</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              ReunitePets connects pet owners with volunteers who help search.
              Join a rescue squad to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
