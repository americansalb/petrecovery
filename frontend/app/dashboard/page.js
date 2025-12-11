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
  Target, TrendingUp, Star, Zap, PawPrint, Bell, Building2,
  ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Mail, Calendar, UserCheck
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

  // Sorting and display states
  const [squadSort, setSquadSort] = useState({ field: 'activity', asc: false });
  const [missionSort, setMissionSort] = useState({ field: 'activity', asc: false });
  const [showAllSquads, setShowAllSquads] = useState(false);
  const MAX_SQUADS_DISPLAY = 5;

  // Admin members state
  const [memberSort, setMemberSort] = useState({ field: 'recent', asc: false });
  const [memberSearch, setMemberSearch] = useState('');
  const [showAllMembers, setShowAllMembers] = useState(false);
  const MAX_MEMBERS_DISPLAY = 10;

  // Toggle sort function
  const toggleSort = (current, setCurrent, field) => {
    if (current.field === field) {
      setCurrent({ field, asc: !current.asc });
    } else {
      setCurrent({ field, asc: false });
    }
  };

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

  const { user, squads = [], activeCases = [], reports = [], nearbyAlerts = [], missions = [], allMembers = [] } = userData;
  const rescueLevel = RESCUE_LEVELS[user?.rescueLevel] || RESCUE_LEVELS.PET_OWNER;
  const LevelIcon = rescueLevel.icon;
  const isAdmin = user?.role === 'ADMIN';

  // Sort squads
  const sortedSquads = [...squads].sort((a, b) => {
    let result = 0;
    switch (squadSort.field) {
      case 'name':
        result = a.name.localeCompare(b.name);
        break;
      case 'members':
        result = (b.memberCount || 0) - (a.memberCount || 0);
        break;
      case 'activity':
      default:
        result = new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0);
    }
    return squadSort.asc ? -result : result;
  });

  // Sort missions
  const sortedMissions = [...missions].sort((a, b) => {
    let result = 0;
    switch (missionSort.field) {
      case 'name':
        result = a.petName.localeCompare(b.petName);
        break;
      case 'missing':
        result = (b.hoursMissing || 0) - (a.hoursMissing || 0);
        break;
      case 'activity':
      default:
        result = (a.hoursMissing || 0) - (b.hoursMissing || 0);
    }
    return missionSort.asc ? -result : result;
  });

  // Squads to display (limited or all)
  const displayedSquads = showAllSquads ? sortedSquads : sortedSquads.slice(0, MAX_SQUADS_DISPLAY);
  const hasMoreSquads = sortedSquads.length > MAX_SQUADS_DISPLAY;

  // Filter and sort members (admin only)
  const filteredMembers = allMembers.filter(member => {
    if (!memberSearch) return true;
    const search = memberSearch.toLowerCase();
    return (
      member.firstName?.toLowerCase().includes(search) ||
      member.lastName?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search)
    );
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    let result = 0;
    switch (memberSort.field) {
      case 'name':
        result = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        break;
      case 'email':
        result = (a.email || '').localeCompare(b.email || '');
        break;
      case 'activity':
        result = new Date(b.lastLoginAt || 0) - new Date(a.lastLoginAt || 0);
        break;
      case 'recent':
      default:
        result = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    return memberSort.asc ? -result : result;
  });

  const displayedMembers = showAllMembers ? sortedMembers : sortedMembers.slice(0, MAX_MEMBERS_DISPLAY);
  const hasMoreMembers = sortedMembers.length > MAX_MEMBERS_DISPLAY;

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
            {/* Active Squads */}
            <Card padding="none" accent="blue" className="animate-fade-in">
              <div className="px-5 py-4 border-b border-midnight-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-midnight-900">Active Squads</h3>
                      <p className="text-sm text-midnight-500">Teams you're part of</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {squads.length > 0 && (
                      <div className="flex items-center gap-1 mr-2">
                        {[
                          { field: 'activity', label: 'Recent' },
                          { field: 'name', label: 'Name' },
                          { field: 'members', label: 'Size' },
                        ].map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => toggleSort(squadSort, setSquadSort, field)}
                            className={`px-2 py-1 text-xs rounded-md flex items-center gap-0.5 transition-colors ${
                              squadSort.field === field
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-midnight-500 hover:bg-midnight-100'
                            }`}
                          >
                            {label}
                            {squadSort.field === field && (
                              squadSort.asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <Link href="/rescue-squads/search">
                      <Button variant="outline" size="sm" leftIcon={Plus}>
                        Join
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {squads.length === 0 ? (
                <EmptyState
                  icon={Users}
                  iconColor="blue"
                  title="No Squads Yet"
                  description="Join a local rescue squad to help find lost pets"
                  action={{
                    label: 'Find Squads',
                    href: '/rescue-squads/search',
                    icon: Search,
                  }}
                  compact
                  className="py-6"
                />
              ) : (
                <>
                  <div className="divide-y divide-midnight-100">
                    {displayedSquads.map((squad) => {
                      const roleConfig = SQUAD_ROLES[squad.myRole] || SQUAD_ROLES.MEMBER;
                      return (
                        <Link
                          key={squad.id}
                          href={`/rescue-squads/${squad.id}`}
                          className="flex items-center justify-between p-4 hover:bg-midnight-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {squad.logoUrl || squad.photoUrl ? (
                              <img
                                src={squad.logoUrl || squad.photoUrl}
                                alt={squad.name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white">
                                <Users className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-midnight-900">
                                {squad.name}
                              </div>
                              <div className="text-sm text-midnight-500">
                                {squad.memberCount} member{squad.memberCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={roleConfig.color}>
                              {roleConfig.label}
                            </Badge>
                            <ChevronRight className="w-5 h-5 text-midnight-300" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {hasMoreSquads && (
                    <button
                      onClick={() => setShowAllSquads(!showAllSquads)}
                      className="w-full py-3 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                    >
                      {showAllSquads ? (
                        <>Show Less</>
                      ) : (
                        <>Show {sortedSquads.length - MAX_SQUADS_DISPLAY} More</>
                      )}
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAllSquads ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </>
              )}
            </Card>

            {/* Active Missions */}
            <Card padding="none" accent="amber" className="animate-fade-in">
              <div className="px-5 py-4 border-b border-midnight-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Target className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-midnight-900">Active Missions</h3>
                      <p className="text-sm text-midnight-500">Cases you're involved with</p>
                    </div>
                  </div>
                  {missions.length > 0 && (
                    <div className="flex items-center gap-1">
                      {[
                        { field: 'activity', label: 'Recent' },
                        { field: 'name', label: 'Name' },
                        { field: 'missing', label: 'Missing' },
                      ].map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => toggleSort(missionSort, setMissionSort, field)}
                          className={`px-2 py-1 text-xs rounded-md flex items-center gap-0.5 transition-colors ${
                            missionSort.field === field
                              ? 'bg-amber-100 text-amber-700 font-medium'
                              : 'text-midnight-500 hover:bg-midnight-100'
                          }`}
                        >
                          {label}
                          {missionSort.field === field && (
                            missionSort.asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {missions.length === 0 ? (
                <EmptyState
                  icon={Target}
                  iconColor="amber"
                  title="No Active Missions"
                  description="Report a lost pet or join a squad to help with searches"
                  action={{
                    label: 'Report Lost Pet',
                    href: '/report/new',
                    icon: Bell,
                  }}
                  compact
                  className="py-6"
                />
              ) : (
                <div className="divide-y divide-midnight-100">
                  {sortedMissions.map((mission) => (
                    <Link
                      key={mission.id}
                      href={`/cases/${mission.caseNumber}`}
                      className="block p-4 hover:bg-midnight-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* Pet Photo/Icon */}
                        {mission.petPhotoUrl ? (
                          <img
                            src={mission.petPhotoUrl}
                            alt={mission.petName}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-2xl">
                            {mission.petSpecies === 'DOG' ? '🐕' : mission.petSpecies === 'CAT' ? '🐈' : '🐾'}
                          </div>
                        )}

                        {/* Mission Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-midnight-900 truncate">
                              {mission.petName}
                            </span>
                            {mission.isOwner && (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">Owner</Badge>
                            )}
                            {mission.isLive && <StatusBadge status="live" />}
                          </div>
                          <div className="text-sm text-midnight-500 mt-0.5">
                            {mission.hoursMissing < 24
                              ? `${mission.hoursMissing}h missing`
                              : `${Math.floor(mission.hoursMissing / 24)}d missing`}
                            {mission.squadsHelping.length > 0 && (
                              <span> · {mission.squadsHelping.length} squad{mission.squadsHelping.length !== 1 ? 's' : ''}</span>
                            )}
                            {mission.totalVolunteers > 0 && (
                              <span> · {mission.totalVolunteers} volunteer{mission.totalVolunteers !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-midnight-300 flex-shrink-0" />
                      </div>

                      {/* Squads helping - compact list */}
                      {mission.squadsHelping.length > 0 && (
                        <div className="mt-2 ml-15 flex flex-wrap gap-1">
                          {mission.squadsHelping.slice(0, 3).map((squad) => (
                            <span
                              key={squad.squadId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                            >
                              <Users className="w-3 h-3" />
                              {squad.squadName}
                            </span>
                          ))}
                          {mission.squadsHelping.length > 3 && (
                            <span className="px-2 py-0.5 bg-midnight-100 text-midnight-600 text-xs rounded-full">
                              +{mission.squadsHelping.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Admin: All Members List */}
            {isAdmin && (
              <Card padding="none" accent="purple" className="animate-fade-in">
                <div className="px-5 py-4 border-b border-midnight-100">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-midnight-900">All Registered Members</h3>
                        <p className="text-sm text-midnight-500">{allMembers.length} total users</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {[
                        { field: 'recent', label: 'Newest' },
                        { field: 'name', label: 'Name' },
                        { field: 'activity', label: 'Active' },
                      ].map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => toggleSort(memberSort, setMemberSort, field)}
                          className={`px-2 py-1 text-xs rounded-md flex items-center gap-0.5 transition-colors ${
                            memberSort.field === field
                              ? 'bg-purple-100 text-purple-700 font-medium'
                              : 'text-midnight-500 hover:bg-midnight-100'
                          }`}
                        >
                          {label}
                          {memberSort.field === field && (
                            memberSort.asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Search input */}
                  <div className="mt-3">
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-midnight-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {displayedMembers.length === 0 ? (
                  <div className="p-6 text-center text-midnight-500">
                    {memberSearch ? 'No members match your search' : 'No registered members'}
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-midnight-100">
                      {displayedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 hover:bg-midnight-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {member.profileImage ? (
                              <img
                                src={member.profileImage}
                                alt={`${member.firstName} ${member.lastName}`}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                                {member.firstName?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-midnight-900">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-midnight-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {member.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <div className="text-right hidden sm:block">
                              <div className="text-midnight-500 flex items-center gap-1 justify-end">
                                <Calendar className="w-3 h-3" />
                                Joined {new Date(member.createdAt).toLocaleDateString()}
                              </div>
                              {member.lastLoginAt && (
                                <div className="text-xs text-midnight-400">
                                  Last active: {new Date(member.lastLoginAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {member.role === 'ADMIN' && (
                                <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                              )}
                              {member.emailVerified && (
                                <Badge className="bg-green-100 text-green-700 text-xs">Verified</Badge>
                              )}
                            </div>
                            <div className="text-midnight-400 text-xs text-right">
                              <div>{member.squadsCount} squad{member.squadsCount !== 1 ? 's' : ''}</div>
                              <div>{member.casesCount} case{member.casesCount !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {hasMoreMembers && (
                      <button
                        onClick={() => setShowAllMembers(!showAllMembers)}
                        className="w-full py-3 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-colors flex items-center justify-center gap-1"
                      >
                        {showAllMembers ? (
                          <>Show Less</>
                        ) : (
                          <>Show {sortedMembers.length - MAX_MEMBERS_DISPLAY} More</>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${showAllMembers ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </>
                )}
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
