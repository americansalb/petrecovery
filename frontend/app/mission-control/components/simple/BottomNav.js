'use client';

/**
 * BottomNav - Main navigation for Mission Control
 *
 * Provides quick access to all key sections:
 * - Map: GPS search, sightings, location tracking
 * - Team: Squad members, coordination
 * - Chat: Communication with team
 * - Tasks: Actions and assignments
 * - More: Settings, details, share
 */

import { Map, Users, MessageCircle, ClipboardList, MoreHorizontal } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'team', icon: Users, label: 'Team' },
  { id: 'chat', icon: MessageCircle, label: 'Chat' },
  { id: 'tasks', icon: ClipboardList, label: 'Tasks' },
  { id: 'more', icon: MoreHorizontal, label: 'More' },
];

export default function BottomNav({
  activeTab = 'map',
  onTabChange,
  unreadChat = 0,
  pendingTasks = 0,
  isSearching = false,
}) {
  return (
    <nav className={`border-t px-2 pb-[env(safe-area-inset-bottom)] ${
      isSearching ? 'bg-red-900/50 border-red-800' : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.id;
          const badge = item.id === 'chat' ? unreadChat : item.id === 'tasks' ? pendingTasks : 0;
          // Show live indicator on Map when searching
          const showLive = isSearching && item.id === 'map';

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
