'use client';

/**
 * Dashboard Page - Clean, Intuitive Design
 *
 * Clear user journeys:
 * 1. Lost my pet → Report
 * 2. Found a pet → Report
 * 3. Want to help → Mission Control
 * 4. View activity → My Cases / My Squads
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MapPin, Search, Clock, Award, Bell, ChevronRight,
  AlertCircle, Target, PawPrint, Heart, Eye, Navigation
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

  // Active mission count (user's own cases that are still active)
  const myCases = missions.filter(m => m.isOwner);
  const helpingCases = missions.filter(m => !m.isOwner);

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Hi, {firstName}
          </h1>
          <p className="text-slate-500">What would you like to do?</p>
        </div>

        {/* Primary Actions - What users come here to do */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {/* Lost Pet */}
          <Link href="/report/new" className="group">
            <div className="bg-red-500 hover:bg-red-600 text-white rounded-2xl p-6 transition-all group-hover:shadow-lg group-hover:-translate-y-1">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-lg">I Lost My Pet</div>
                  <div className="text-red-100 text-sm">Create a lost pet report</div>
                </div>
              </div>
            </div>
          </Link>

          {/* Found Pet */}
          <Link href="/found" className="group">
            <div className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl p-6 transition-all group-hover:shadow-lg group-hover:-translate-y-1">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-lg">I Found a Pet</div>
                  <div className="text-emerald-100 text-sm">Report a found animal</div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Secondary Actions */}
        <div className="grid sm:grid-cols-3 gap-3 mb-10">
          <Link href="/database" className="group">
            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
              <Search className="w-5 h-5 text-slate-400 mb-2" />
              <div className="font-semibold text-slate-900">Search Database</div>
              <div className="text-sm text-slate-500">Browse lost & found</div>
            </div>
          </Link>
          <Link href="/rescue-squads/search" className="group">
            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
              <Users className="w-5 h-5 text-slate-400 mb-2" />
              <div className="font-semibold text-slate-900">Find Squads</div>
              <div className="text-sm text-slate-500">Join local teams</div>
            </div>
          </Link>
          <Link href="/mission-control" className="group">
            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
              <Navigation className="w-5 h-5 text-slate-400 mb-2" />
              <div className="font-semibold text-slate-900">Mission Control</div>
              <div className="text-sm text-slate-500">GPS search & track</div>
            </div>
          </Link>
        </div>

        {/* Nearby Alerts - If any pets are lost nearby, show prominently */}
        {nearbyAlerts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
              Lost Pets Nearby
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              {nearbyAlerts.slice(0, 3).map((alert, i) => (
                <Link
                  key={alert.id}
                  href={`/missions/${alert.id}`}
                  className={`flex items-center justify-between p-4 hover:bg-amber-100 transition-colors ${
                    i > 0 ? 'border-t border-amber-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center">
                      <PawPrint className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <div className="font-semibold text-amber-900">{alert.petName}</div>
                      <div className="text-sm text-amber-700">{alert.distance} away</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-amber-400" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Activity Section */}
        <div className="space-y-6">
          {/* My Cases */}
          {myCases.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
                My Lost Pet Cases
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {myCases.map((mission, i) => (
                  <Link
                    key={mission.id}
                    href={`/mission-control?mission=${mission.id}`}
                    className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {mission.petPhotoUrl ? (
                        <img
                          src={mission.petPhotoUrl}
                          alt={mission.petName}
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">
                          {mission.petSpecies === 'DOG' ? '🐕' : mission.petSpecies === 'CAT' ? '🐈' : '🐾'}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900">{mission.petName}</div>
                        <div className="text-sm text-slate-500">
                          {mission.hoursMissing < 24
                            ? `${mission.hoursMissing}h missing`
                            : `${Math.floor(mission.hoursMissing / 24)}d missing`}
                          {mission.totalVolunteers > 0 && ` • ${mission.totalVolunteers} helping`}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Helping Cases */}
          {helpingCases.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
                Cases I'm Helping
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {helpingCases.slice(0, 5).map((mission, i) => (
                  <Link
                    key={mission.id}
                    href={`/mission-control?mission=${mission.id}`}
                    className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {mission.petPhotoUrl ? (
                        <img
                          src={mission.petPhotoUrl}
                          alt={mission.petName}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                          {mission.petSpecies === 'DOG' ? '🐕' : mission.petSpecies === 'CAT' ? '🐈' : '🐾'}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-slate-900">{mission.petName}</div>
                        <div className="text-sm text-slate-500">
                          {mission.hoursMissing < 24
                            ? `${mission.hoursMissing}h`
                            : `${Math.floor(mission.hoursMissing / 24)}d`} missing
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </Link>
                ))}
                {helpingCases.length > 5 && (
                  <div className="p-3 bg-slate-50 text-center text-sm text-slate-500">
                    +{helpingCases.length - 5} more cases
                  </div>
                )}
              </div>
            </div>
          )}

          {/* My Squads */}
          {squads.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
                My Squads
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {squads.slice(0, 5).map((squad, i) => (
                  <Link
                    key={squad.id}
                    href={`/rescue-squads/${squad.id}`}
                    className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {squad.logoUrl || squad.photoUrl ? (
                        <img
                          src={squad.logoUrl || squad.photoUrl}
                          alt={squad.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-slate-900">{squad.name}</div>
                        <div className="text-sm text-slate-500">
                          {squad.memberCount} member{squad.memberCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty State - No activity yet */}
          {myCases.length === 0 && helpingCases.length === 0 && squads.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">Welcome to ReunitePets</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                You haven't started any cases or joined any squads yet.
                Use the actions above to get started!
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/rescue-squads/search">
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600">
                    Join a Squad
                  </button>
                </Link>
                <Link href="/database">
                  <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">
                    Browse Lost Pets
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Stats - Subtle footer instead of prominent hero */}
        {(user?.areasMarkedCount > 0 || user?.totalAcreageSearched > 0 || user?.successfulReunions > 0) && (
          <div className="mt-10 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-center gap-8 text-center">
              {user?.areasMarkedCount > 0 && (
                <div>
                  <div className="text-2xl font-bold text-slate-900">{user.areasMarkedCount}</div>
                  <div className="text-xs text-slate-500">Areas Marked</div>
                </div>
              )}
              {user?.totalAcreageSearched > 0 && (
                <div>
                  <div className="text-2xl font-bold text-slate-900">{Math.round(user.totalAcreageSearched)}</div>
                  <div className="text-xs text-slate-500">Acres Searched</div>
                </div>
              )}
              {user?.successfulReunions > 0 && (
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{user.successfulReunions}</div>
                  <div className="text-xs text-slate-500">Reunions</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
