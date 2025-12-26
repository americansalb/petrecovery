'use client';

/**
 * BottomNav - Main navigation for Mission Control
 *
 * 5-tab focused structure:
 * - Home: Overview with key info at a glance
 * - Search: Map + GPS tracking
 * - Team: Members + Chat combined
 * - Actions: Shelters, flyers, share
 * - Tips: Search strategies
 */

import { Home, Navigation, Users, ClipboardList, Lightbulb } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'search', icon: Navigation, label: 'Search' },
  { id: 'team', icon: Users, label: 'Team' },
  { id: 'actions', icon: ClipboardList, label: 'Actions' },
  { id: 'tips', icon: Lightbulb, label: 'Tips' },
];

export default function BottomNav({
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
          // Show live indicator on Search when GPS is active
          const showLive = isSearching && item.id === 'search';

          return (
            <button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={`
                flex flex-col items-center py-2 px-4 min-w-[64px] relative
                transition-colors
                ${isActive
                  ? showLive ? 'text-red-400' : 'text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
                }
              `}
            >
              <div className="relative">
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {showLive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                {showLive ? 'LIVE' : item.label}
              </span>
              {isActive && (
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${
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
