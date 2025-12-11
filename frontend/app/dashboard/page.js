'use client';

/**
 * Dashboard Page - Redesigned with PetRecovery Design System
 *
 * Uses: Midnight Blue + Flashlight Yellow color palette
 * Components: Card, Button, Badge, EmptyState from @/components/ui
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MapPin, Search, Clock, Award, Shield,
  ChevronRight, Plus, AlertCircle, CheckCircle2,
  Target, TrendingUp, Star, Zap, PawPrint, Bell, Building2
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, StatusBadge, EmptyState } from '@/components/ui';

// Rescue level configuration
const RESCUE_LEVELS = {
  PET_OWNER: { label: 'Pet Owner', color: 'bg-midnight-500', icon: PawPrint, next: 'SCOUT' },
  SCOUT: { label: 'Scout', color: 'bg-green-500', icon: Search, next: 'SENTRY' },
  SENTRY: { label: 'Sentry', color: 'bg-blue-500', icon: Shield, next: 'SHEPHERD' },
  SHEPHERD: { label: 'Shepherd', color: 'bg-purple-500', icon: Target, next: 'PATHFINDER' },
  PATHFINDER: { label: 'Pathfinder', color: 'bg-amber-500', icon: MapPin, next: 'PACK_GUARDIAN' },
  PACK_GUARDIAN: { label: 'Pack Guardian', color: 'bg-pink-500', icon: Shield, next: 'PACK_LEGEND' },
  PACK_LEGEND: { label: 'Pack Legend', color: 'bg-red-500', icon: Award, next: null },
};

const SQUAD_ROLES = {
  FOUNDER: { label: 'Founder', color: 'text-red-600 bg-red-50', icon: Award },
  LEADER: { label: 'Leader', color: 'text-amber-600 bg-amber-50', icon: Shield },
  COORDINATOR: { label: 'Coordinator', color: 'text-purple-600 bg-purple-50', icon: Target },
  MEMBER: { label: 'Member', color: 'text-blue-600 bg-blue-50', icon: Users },
};

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
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        const data = await res.json();
        setUserData(data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchData();
    }
  }, [session, status]);

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-midnight-200 border-t-midnight-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-midnight-500 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-midnight-900 mb-2">Dashboard Error</h2>
          <p className="text-midnight-500 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!session || !userData) {
    return null;
  }

  const { user, squads = [], activeCases = [], reports = [], nearbyAlerts = [] } = userData;
  const rescueLevel = RESCUE_LEVELS[user?.rescueLevel] || RESCUE_LEVELS.PET_OWNER;
  const LevelIcon = rescueLevel.icon;

  return (
    <div className="min-h-screen bg-midnight-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Welcome */}
            <div>
              <p className="text-midnight-400 text-sm uppercase tracking-wider mb-1">
                Welcome back
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                {user?.firstName || session.user?.name || 'Rescuer'}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm font-medium">
                  <LevelIcon className="w-4 h-4" />
                  {rescueLevel.label}
                </span>
                {squads.length > 0 && (
                  <span className="px-3 py-1.5 bg-white/10 rounded-full text-sm">
                    {squads.length} Squad{squads.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {[
                { label: 'Cases Helped', value: activeCases.length, icon: Target },
                { label: 'Areas Marked', value: user?.areasMarkedCount || 0, icon: MapPin },
                { label: 'Acres Searched', value: Math.round(user?.totalAcreageSearched || 0), icon: Search },
                { label: 'Reunions', value: user?.successfulReunions || 0, icon: Award },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <stat.icon className="w-5 h-5 mx-auto mb-1 text-flash-400" />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-midnight-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left Column - Main Content */}
          <div className="space-y-6">
            {/* Active Cases Section */}
            <Card padding="none">
              <CardHeader
                icon={Zap}
                iconColor="bg-red-100 text-red-600"
                title="Active Searches"
                description="Cases you're helping with"
                action={
                  <Link href="/cases" className="flex items-center gap-1 text-midnight-900 text-sm font-semibold hover:text-flash-600 transition-colors">
                    Browse Cases <ChevronRight className="w-4 h-4" />
                  </Link>
                }
                className="px-5 py-4 border-b border-midnight-100"
              />

              {activeCases.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No Active Searches"
                  description="Join a rescue squad to help find lost pets in your area"
                  action={{
                    label: 'Find a Squad',
                    href: '/rescue-squads/search',
                    icon: Users,
                  }}
                  className="py-10"
                />
              ) : (
                <div className="divide-y divide-midnight-100">
                  {activeCases.slice(0, 5).map((caseItem) => (
                    <Link
                      key={caseItem.id}
                      href={`/cases/${caseItem.caseNumber}/coordinate`}
                      className="flex items-center justify-between p-4 hover:bg-midnight-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-2xl">
                          {caseItem.petSpecies === 'DOG' ? '🐕' : caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}
                        </div>
                        <div>
                          <div className="font-semibold text-midnight-900 flex items-center gap-2">
                            {caseItem.petName}
                            <StatusBadge status="active" />
                          </div>
                          <div className="text-sm text-midnight-500 mt-0.5">
                            {caseItem.city}, {caseItem.state} • {caseItem.activeVolunteers} volunteers
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-midnight-400" />
                    </Link>
                  ))}
                  {activeCases.length > 5 && (
                    <div className="p-4 text-center">
                      <Link href="/cases" className="text-midnight-900 font-semibold text-sm hover:text-flash-600">
                        View all {activeCases.length} cases
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* My Squads Section */}
            <Card padding="none">
              <CardHeader
                icon={Users}
                iconColor="bg-midnight-100 text-midnight-600"
                title="My Rescue Squads"
                description="Teams you're part of"
                action={
                  <Link href="/rescue-squads/search">
                    <Button variant="outline" size="sm" leftIcon={Plus}>
                      Join Squad
                    </Button>
                  </Link>
                }
                className="px-5 py-4 border-b border-midnight-100"
              />

              {squads.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Not in Any Squads Yet"
                  description="Join a local rescue squad to coordinate searches with your community"
                  action={{
                    label: 'Find Squads Near You',
                    href: '/rescue-squads/search',
                    icon: Search,
                  }}
                  className="py-10"
                />
              ) : (
                <div className="divide-y divide-midnight-100">
                  {squads.map((squad) => {
                    const roleConfig = SQUAD_ROLES[squad.myRole] || SQUAD_ROLES.MEMBER;
                    const RoleIcon = roleConfig.icon;
                    return (
                      <Link
                        key={squad.id}
                        href={`/rescue-squads/${squad.id}`}
                        className="flex items-center justify-between p-4 hover:bg-midnight-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-midnight-800 to-midnight-900 rounded-xl flex items-center justify-center text-white text-xl">
                            🚨
                          </div>
                          <div>
                            <div className="font-semibold text-midnight-900">
                              {squad.name}
                            </div>
                            <div className="text-sm text-midnight-500 mt-0.5">
                              {squad.city}, {squad.state} • {squad.memberCount} members
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={roleConfig.color}>
                            <RoleIcon className="w-3 h-3" />
                            {roleConfig.label}
                          </Badge>
                          <ChevronRight className="w-5 h-5 text-midnight-400" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Lost Pet Reports */}
            {reports.length > 0 && (
              <Card padding="none">
                <CardHeader
                  icon={AlertCircle}
                  iconColor="bg-amber-100 text-amber-600"
                  title="Your Lost Pet Reports"
                  description="Pets you've reported missing"
                  className="px-5 py-4 border-b border-midnight-100"
                />
                <div className="divide-y divide-midnight-100">
                  {reports.map((report) => (
                    <div key={report.id} className="p-4">
                      <Link
                        href={`/cases/${report.caseNumber}`}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {report.petPhotoUrl ? (
                            <img
                              src={report.petPhotoUrl}
                              alt={report.petName}
                              className="w-12 h-12 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-2xl">
                              {report.petSpecies === 'DOG' ? '🐕' : report.petSpecies === 'CAT' ? '🐈' : '🐾'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-midnight-900 flex items-center gap-2">
                              {report.petName}
                              {report.isLive && <StatusBadge status="live" />}
                            </div>
                            <div className="text-sm text-midnight-500 mt-0.5">
                              {report.status === 'RESOLVED' ? (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                                </span>
                              ) : (
                                <>
                                  Missing {report.hoursMissing < 24 ? `${report.hoursMissing}h` : `${Math.floor(report.hoursMissing / 24)}d`}
                                  {report.activeVolunteers > 0 && ` • ${report.activeVolunteers} searching`}
                                  {report.sightings > 0 && ` • ${report.sightings} sightings`}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-midnight-400" />
                      </Link>

                      {/* Mission Control Quick Actions */}
                      {report.status !== 'RESOLVED' && report.status !== 'CLOSED_OTHER' && (
                        <div className="flex gap-2 mt-3 ml-15 pl-15">
                          {report.isLive ? (
                            <Link href={`/cases/${report.caseNumber}`}>
                              <Button variant="danger" size="sm" leftIcon={Zap}>
                                Continue Search
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/cases/${report.caseNumber}`}>
                              <Button size="sm" leftIcon={Zap}>
                                Start Live Search
                              </Button>
                            </Link>
                          )}
                          <Link href={`/cases/${report.caseNumber}/coordinate`}>
                            <Button variant="outline" size="sm" leftIcon={Target}>
                              Coordinate
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Rescue Level Progress */}
            <Card>
              <h3 className="text-xs font-semibold text-midnight-500 uppercase tracking-wider mb-4">
                Your Rescue Level
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-full ${rescueLevel.color} bg-opacity-20 flex items-center justify-center border-3 border-current`}>
                  <LevelIcon className={`w-7 h-7 ${rescueLevel.color.replace('bg-', 'text-')}`} />
                </div>
                <div>
                  <div className={`text-lg font-bold ${rescueLevel.color.replace('bg-', 'text-')}`}>
                    {rescueLevel.label}
                  </div>
                  {rescueLevel.next && (
                    <div className="text-sm text-midnight-500">
                      Next: {RESCUE_LEVELS[rescueLevel.next]?.label}
                    </div>
                  )}
                </div>
              </div>
              {rescueLevel.next && (
                <div className="h-2 bg-midnight-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${rescueLevel.color} rounded-full transition-all duration-500`}
                    style={{ width: '35%' }}
                  />
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card>
              <h3 className="text-xs font-semibold text-midnight-500 uppercase tracking-wider mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <Link href="/report/new" className="block">
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-semibold hover:bg-red-100 transition-colors">
                    <Bell className="w-5 h-5" />
                    Report Lost Pet
                  </div>
                </Link>
                <Link href="/found" className="block">
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 font-semibold hover:bg-green-100 transition-colors">
                    <CheckCircle2 className="w-5 h-5" />
                    Report Found Pet
                  </div>
                </Link>
                <Link href="/rescue-squads/search" className="block">
                  <div className="flex items-center gap-3 p-3 bg-midnight-50 border border-midnight-200 rounded-xl text-midnight-700 font-semibold hover:bg-midnight-100 transition-colors">
                    <Search className="w-5 h-5" />
                    Find Rescue Squads
                  </div>
                </Link>
                <Link href="/shelters" className="block">
                  <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 font-semibold hover:bg-purple-100 transition-colors">
                    <Building2 className="w-5 h-5" />
                    Search Nearby Shelters
                  </div>
                </Link>
              </div>
            </Card>

            {/* Nearby Alerts */}
            {nearbyAlerts.length > 0 && (
              <Card>
                <h3 className="text-xs font-semibold text-midnight-500 uppercase tracking-wider mb-4">
                  Nearby Lost Pets
                </h3>
                <div className="space-y-2">
                  {nearbyAlerts.slice(0, 5).map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/cases/${alert.id}`}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-red-700">{alert.petName}</div>
                        <div className="text-xs text-midnight-500">{alert.distance} away</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-red-600" />
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Tips Card */}
            <Card className="bg-gradient-to-br from-flash-50 to-flash-100 border-flash-300">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-flash-600" />
                <span className="font-bold text-flash-800">Pro Tip</span>
              </div>
              <p className="text-sm text-flash-900 leading-relaxed">
                Join your local rescue squad to get notified about lost pets in your area and help coordinate searches with your neighbors.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
