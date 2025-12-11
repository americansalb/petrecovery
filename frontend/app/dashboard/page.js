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
import { Card, CardHeader, Button, Badge, StatusBadge, EmptyState, CardSkeleton, ListItemSkeleton } from '@/components/ui';

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

  // Loading state - Show skeleton UI for better perceived performance
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50">
        {/* Skeleton Hero */}
        <div className="bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="animate-pulse">
              <div className="h-4 bg-white/20 rounded w-24 mb-2" />
              <div className="h-10 bg-white/20 rounded w-48 mb-4" />
              <div className="flex gap-2">
                <div className="h-8 bg-white/10 rounded-full w-24" />
                <div className="h-8 bg-white/10 rounded-full w-20" />
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton Quick Actions */}
        <div className="bg-white border-b border-midnight-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-14 bg-midnight-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
        {/* Skeleton Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid lg:grid-cols-[1fr_380px] gap-6">
            <div className="space-y-6">
              <Card padding="md">
                <CardSkeleton rows={2} />
              </Card>
              <Card padding="md">
                <CardSkeleton rows={2} />
              </Card>
            </div>
            <div className="space-y-6">
              <Card padding="md">
                <div className="animate-pulse">
                  <div className="h-4 bg-midnight-200 rounded w-1/2 mb-4" />
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-midnight-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-5 bg-midnight-200 rounded w-24 mb-2" />
                      <div className="h-3 bg-midnight-100 rounded w-32" />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
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

      {/* Quick Actions Bar - High visibility placement */}
      <div className="bg-white border-b border-midnight-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-midnight-600 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-flash-500" />
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/report/new" className="block group">
              <div className="flex items-center gap-3 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 font-semibold hover:bg-red-100 hover:border-red-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
                <Bell className="w-5 h-5" />
                <span className="truncate">Report Lost Pet</span>
              </div>
            </Link>
            <Link href="/found" className="block group">
              <div className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-xl text-green-700 font-semibold hover:bg-green-100 hover:border-green-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
                <CheckCircle2 className="w-5 h-5" />
                <span className="truncate">Report Found Pet</span>
              </div>
            </Link>
            <Link href="/rescue-squads/search" className="block group">
              <div className="flex items-center gap-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-700 font-semibold hover:bg-blue-100 hover:border-blue-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
                <Users className="w-5 h-5" />
                <span className="truncate">Find Squads</span>
              </div>
            </Link>
            <Link href="/shelters" className="block group">
              <div className="flex items-center gap-3 p-3 bg-purple-50 border-2 border-purple-200 rounded-xl text-purple-700 font-semibold hover:bg-purple-100 hover:border-purple-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
                <Building2 className="w-5 h-5" />
                <span className="truncate">Search Shelters</span>
              </div>
            </Link>
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
            {/* When both are empty, show side-by-side on desktop */}
            {activeCases.length === 0 && squads.length === 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Active Cases Section - Compact */}
                <Card padding="none" accent="red" className="animate-fade-in">
                  <CardHeader
                    icon={Zap}
                    iconColor="bg-red-100 text-red-600"
                    title="Active Searches"
                    description="Cases you're helping with"
                    className="px-5 py-4 border-b border-midnight-100"
                  />
                  <EmptyState
                    icon={Search}
                    iconColor="red"
                    title="No Active Searches"
                    description="Join a rescue squad to help find lost pets"
                    tip="Rescue squads notify you when pets go missing nearby!"
                    action={{
                      label: 'Find a Squad',
                      href: '/rescue-squads/search',
                      icon: Users,
                    }}
                    compact
                    className="py-6"
                  />
                </Card>

                {/* My Squads Section - Compact */}
                <Card padding="none" accent="blue" className="animate-fade-in">
                  <CardHeader
                    icon={Users}
                    iconColor="bg-blue-100 text-blue-600"
                    title="My Rescue Squads"
                    description="Teams you're part of"
                    className="px-5 py-4 border-b border-midnight-100"
                  />
                  <EmptyState
                    icon={Users}
                    iconColor="blue"
                    title="Not in Any Squads"
                    description="Join a local rescue squad to help your community"
                    tip="Many pet reunions happen thanks to squad coordination!"
                    action={{
                      label: 'Find Squads',
                      href: '/rescue-squads/search',
                      icon: Search,
                    }}
                    compact
                    className="py-6"
                  />
                </Card>
              </div>
            ) : (
              <>
            {/* Active Cases Section */}
            <Card padding="none" accent="red" className="animate-fade-in">
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
                  iconColor="red"
                  title="No Active Searches"
                  description="Join a rescue squad to help find lost pets in your area"
                  tip="Rescue squads notify you when pets go missing nearby. Join one to start helping!"
                  action={{
                    label: 'Find a Squad',
                    href: '/rescue-squads/search',
                    icon: Users,
                  }}
                  compact={squads.length === 0}
                  className="py-8"
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
            <Card padding="none" accent="blue">
              <CardHeader
                icon={Users}
                iconColor="bg-blue-100 text-blue-600"
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
                  iconColor="blue"
                  title="Not in Any Squads Yet"
                  description="Join a local rescue squad to coordinate searches with your community"
                  tip="Squads are community teams that help find lost pets. Many reunions happen thanks to squad coordination!"
                  action={{
                    label: 'Find Squads Near You',
                    href: '/rescue-squads/search',
                    icon: Search,
                  }}
                  compact={activeCases.length === 0}
                  className="py-8"
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
              </>
            )}

            {/* Lost Pet Reports */}
            {reports.length > 0 && (
              <Card padding="none" accent="amber">
                <CardHeader
                  icon={AlertCircle}
                  iconColor="bg-amber-100 text-amber-600"
                  title="Your Lost Pet Reports"
                  description="Pets you've reported missing"
                  className="px-5 py-4 border-b border-midnight-100"
                />
                <div className="divide-y divide-midnight-100">
                  {reports.map((report) => (
                    <div key={report.id} className="p-5 hover:bg-midnight-50/50 transition-colors">
                      {/* Pet Info - Larger layout */}
                      <Link
                        href={`/cases/${report.caseNumber}`}
                        className="flex gap-4 group"
                      >
                        {/* Larger Pet Photo */}
                        {report.petPhotoUrl ? (
                          <img
                            src={report.petPhotoUrl}
                            alt={report.petName}
                            className="w-20 h-20 rounded-2xl object-cover shadow-sm flex-shrink-0 group-hover:shadow-md transition-shadow"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl flex items-center justify-center text-4xl shadow-sm flex-shrink-0">
                            {report.petSpecies === 'DOG' ? '🐕' : report.petSpecies === 'CAT' ? '🐈' : '🐾'}
                          </div>
                        )}

                        {/* Pet Details - Better hierarchy */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-midnight-900 text-lg flex items-center gap-2">
                                {report.petName}
                                {report.isLive && <StatusBadge status="live" />}
                              </h4>
                              <p className="text-xs text-midnight-400 mt-0.5">
                                Case #{report.caseNumber}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-midnight-400 group-hover:text-midnight-600 flex-shrink-0" />
                          </div>

                          {/* Status Info */}
                          <div className="mt-2 text-sm">
                            {report.status === 'RESOLVED' ? (
                              <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                                <CheckCircle2 className="w-4 h-4" /> Resolved - Pet Found!
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-midnight-600">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  Missing {report.hoursMissing < 24 ? `${report.hoursMissing}h` : `${Math.floor(report.hoursMissing / 24)}d`}
                                </span>
                                {report.activeVolunteers > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />
                                    {report.activeVolunteers} helping
                                  </span>
                                )}
                                {report.sightings > 0 && (
                                  <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {report.sightings} sighting{report.sightings !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Action Buttons - Full width for mobile */}
                      {report.status !== 'RESOLVED' && report.status !== 'CLOSED_OTHER' && (
                        <div className="flex gap-2 mt-4">
                          {report.isLive ? (
                            <Link href={`/cases/${report.caseNumber}`} className="flex-1">
                              <Button variant="danger" size="sm" leftIcon={Zap} className="w-full justify-center">
                                Continue Search
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/cases/${report.caseNumber}`} className="flex-1">
                              <Button size="sm" leftIcon={Zap} className="w-full justify-center">
                                Start Live Search
                              </Button>
                            </Link>
                          )}
                          <Link href={`/cases/${report.caseNumber}/coordinate`} className="flex-1">
                            <Button variant="outline" size="sm" leftIcon={Target} className="w-full justify-center">
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
            <Card accent="green">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-bold text-midnight-700">Your Rescue Level</h3>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-full ${rescueLevel.color} bg-opacity-20 flex items-center justify-center border-3 border-current shadow-sm`}>
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

            {/* Nearby Alerts */}
            {nearbyAlerts.length > 0 && (
              <Card accent="orange">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-midnight-700">Nearby Lost Pets</h3>
                </div>
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
