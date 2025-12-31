'use client';

/**
 * BottomNav3Tab - Simplified 3-tab navigation for Mission Control
 *
 * Replaces the 5-tab navigation with:
 * - Home: Overview with key info at a glance
 * - Map: GPS tracking + map view
 * - Crew: Team + chat + sharing + shelters
 *
 * Tips are distributed as contextual hints in each tab.
 */

import { Home, Map, Users } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'team', icon: Users, label: 'Team' },
];

export default function BottomNav3Tab({
  activeTab = 'home',
  onTabChange,
  unreadChat = 0,
  isSearching = false,
}) {
  return (
    <nav className={`border-t px-2 pb-[env(safe-area-inset-bottom)] ${
      isSearching ? 'bg-red-900/50 border-red-800' : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.id;

          // Show badge on Team tab for unread messages
          const badge = item.id === 'team' ? unreadChat : 0;

          // Show live indicator on Map when GPS is active
          const showLive = isSearching && item.id === 'map';

          return (
            <button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={`
                flex flex-col items-center py-3 px-6 min-w-[80px] relative
                transition-all duration-200
                ${isActive
                  ? showLive
                    ? 'text-red-400'
                    : 'text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
                }
              `}
            >
              <div className="relative">
                <item.icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'drop-shadow-glow' : ''}
                />

                {/* Unread badge */}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}

                {/* Live indicator */}
                {showLive && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-red-500/30" />
                )}
              </div>

              <span className={`text-xs mt-1.5 font-medium ${isActive ? 'font-semibold' : ''}`}>
                {showLive ? 'LIVE' : item.label}
              </span>

              {/* Active indicator bar */}
              {isActive && (
                <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full ${
                  showLive ? 'bg-red-400' : 'bg-amber-400'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Tab IDs for type safety and consistency
 */
export const TAB_IDS = {
  HOME: 'home',
  MAP: 'map',
  TEAM: 'team',
};

/**
 * Map old 5-tab IDs to new 3-tab IDs (for backwards compatibility)
 */
export function migrateTabId(oldTabId) {
  const migration = {
    'home': 'home',
    'search': 'map',
    'team': 'team',
    'actions': 'team',
    'tips': 'home', // Tips distributed, default to home
  };
  return migration[oldTabId] || 'home';
}
