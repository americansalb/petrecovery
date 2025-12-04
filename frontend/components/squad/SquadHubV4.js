'use client';

/**
 * SquadHubV4 - Three-Tab Squad Interface
 *
 * Clean three-tab design:
 * - Feed Tab (default): Case updates, new cases, activity feed
 * - Map Tab: Full-screen satellite map with case pins
 * - Community Tab: Chat, posts, announcements
 *
 * Responsive:
 * - Desktop: Horizontal tabs in header
 * - Mobile: Bottom navigation bar
 */

import { useState, useMemo } from 'react';
import { Newspaper, Map as MapIcon, Users, Shield, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import FeedTabV4 from './FeedTabV4';
import CommunityTabV4 from './CommunityTabV4';

// Lazy load map component
const MapTabV4 = dynamic(() => import('./MapTabV4'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-flash-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

export default function SquadHubV4({ initialData, squadId, isDivisionPage = false, currentDivisionId = null }) {
  // Default to 'feed' tab
  const [activeTab, setActiveTab] = useState('feed');

  // Extract data
  const squad = initialData?.squad || {};
  const divisions = initialData?.divisions || [];
  const allCases = initialData?.cases || [];
  const chatMessages = initialData?.chat?.messages || [];
  const announcements = initialData?.announcements || [];
  const membership = initialData?.membership || {};

  // Filter cases by division if on division page
  const cases = useMemo(() => {
    if (isDivisionPage && currentDivisionId) {
      return allCases.filter(c => c.divisionId === currentDivisionId);
    }
    return allCases;
  }, [allCases, isDivisionPage, currentDivisionId]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeCases = allCases.filter(c =>
      c.status === 'PENDING' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE'
    ).length;
    const reunitedCases = allCases.filter(c => c.status === 'REUNITED').length;

    return {
      active: activeCases,
      reunited: reunitedCases,
      members: squad.memberCount || 0,
      onDuty: squad.onDutyCount || 0,
    };
  }, [allCases, squad]);

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header with Desktop Tabs */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 z-40">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Squad Identity */}
          <div className="flex items-center gap-3">
            {squad.photoUrl ? (
              <img
                src={squad.photoUrl}
                alt={squad.cityName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                <Shield className="text-flash-400" size={20} />
              </div>
            )}
            <div>
              <h1 className="font-bold text-white text-base md:text-lg leading-tight">
                {squad.cityName || 'Rescue Squad'}
              </h1>
              <p className="text-xs text-slate-500">
                {stats.active} active · {stats.members} members
              </p>
            </div>
          </div>

          {/* Desktop Tabs - Hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-xl p-1">
            <DesktopTab
              active={activeTab === 'feed'}
              onClick={() => setActiveTab('feed')}
              icon={Newspaper}
              label="Feed"
              badge={stats.active}
            />
            <DesktopTab
              active={activeTab === 'map'}
              onClick={() => setActiveTab('map')}
              icon={MapIcon}
              label="Map"
            />
            <DesktopTab
              active={activeTab === 'community'}
              onClick={() => setActiveTab('community')}
              icon={Users}
              label="Community"
            />
          </nav>

          {/* Report Button */}
          {membership?.isMember && (
            <a
              href="/cases/report"
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-flash-500 text-slate-900 font-bold text-sm hover:bg-flash-400 transition-colors"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Report</span>
            </a>
          )}
        </div>
      </header>

      {/* Main Content - Takes remaining height */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'feed' && (
          <FeedTabV4
            squad={squad}
            cases={cases}
            announcements={announcements}
            chatMessages={chatMessages}
            membership={membership}
            stats={stats}
            divisions={divisions}
          />
        )}

        {activeTab === 'map' && (
          <MapTabV4
            cases={cases}
            divisions={divisions}
            squad={squad}
            membership={membership}
            stats={stats}
          />
        )}

        {activeTab === 'community' && (
          <CommunityTabV4
            squadId={squadId}
            squad={squad}
            cases={cases}
            divisions={divisions}
            chatMessages={chatMessages}
            announcements={announcements}
            membership={membership}
            stats={stats}
            isDivisionPage={isDivisionPage}
            divisionId={currentDivisionId}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar - Hidden on desktop */}
      <nav className="md:hidden flex-shrink-0 bg-slate-900 border-t border-slate-800 px-2 py-2 pb-safe z-40">
        <div className="flex justify-around max-w-md mx-auto">
          <MobileTab
            active={activeTab === 'feed'}
            onClick={() => setActiveTab('feed')}
            icon={Newspaper}
            label="Feed"
            badge={stats.active}
          />
          <MobileTab
            active={activeTab === 'map'}
            onClick={() => setActiveTab('map')}
            icon={MapIcon}
            label="Map"
          />
          <MobileTab
            active={activeTab === 'community'}
            onClick={() => setActiveTab('community')}
            icon={Users}
            label="Community"
          />
        </div>
      </nav>

      {/* Safe area padding for iOS */}
      <style jsx global>{`
        .pb-safe {
          padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
}

// Desktop Tab - Horizontal pill style in header
function DesktopTab({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all
        ${active
          ? 'bg-flash-500 text-slate-900 font-bold'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }
      `}
    >
      <div className="relative">
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        {badge > 0 && !active && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center px-1 text-[9px] font-bold bg-red-500 text-white rounded-full">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-sm">{label}</span>
      {badge > 0 && active && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-slate-900/20 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

// Mobile Tab - Vertical icon + label for bottom bar
function MobileTab({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all min-w-[72px]
        ${active
          ? 'text-flash-400 bg-flash-500/10'
          : 'text-slate-500 hover:text-slate-300'
        }
      `}
    >
      <div className="relative">
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-bold bg-red-500 text-white rounded-full">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}
