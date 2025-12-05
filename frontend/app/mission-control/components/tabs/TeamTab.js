'use client';

/**
 * ActionsTab (formerly TeamTab) - One-Tap Action Logger
 *
 * CORE PURPOSE: Quick action logging for team visibility
 * - Tap an action = logged immediately
 * - Everyone sees what's been done
 * - No forms, no friction
 */

import { useState, useEffect } from 'react';
import {
  Phone,
  Share2,
  FileText,
  Search,
  Eye,
  MessageCircle,
  MapPin,
  Check,
  Clock,
  User,
} from 'lucide-react';

// Quick action definitions
const QUICK_ACTIONS = [
  { id: 'shelter', label: 'Called Shelter', icon: Phone, color: 'emerald' },
  { id: 'nextdoor', label: 'Posted Nextdoor', icon: MessageCircle, color: 'amber' },
  { id: 'facebook', label: 'Shared Facebook', icon: Share2, color: 'blue' },
  { id: 'flyers', label: 'Put Up Flyers', icon: FileText, color: 'purple' },
  { id: 'searched', label: 'Searched Area', icon: Search, color: 'pink' },
  { id: 'craigslist', label: 'Checked Craigslist', icon: Eye, color: 'orange' },
  { id: 'doors', label: 'Knocked Doors', icon: MapPin, color: 'cyan' },
  { id: 'vet', label: 'Called Vet', icon: Phone, color: 'teal' },
];

const colorMap = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', activeBg: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', activeBg: 'bg-amber-500' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', activeBg: 'bg-blue-500' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', activeBg: 'bg-purple-500' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/50', text: 'text-pink-400', activeBg: 'bg-pink-500' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', activeBg: 'bg-orange-500' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', text: 'text-cyan-400', activeBg: 'bg-cyan-500' },
  teal: { bg: 'bg-teal-500/20', border: 'border-teal-500/50', text: 'text-teal-400', activeBg: 'bg-teal-500' },
};

export default function TeamTab({
  mission,
  showNotification,
  session,
}) {
  const [actions, setActions] = useState([]);
  const [justLogged, setJustLogged] = useState(null);

  // Load actions from localStorage
  useEffect(() => {
    if (!mission?.id) return;
    const storageKey = `case_${mission.id}_actions`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { setActions(JSON.parse(saved)); } catch (e) {}
    }
  }, [mission?.id]);

  // Save actions to localStorage
  useEffect(() => {
    if (!mission?.id || actions.length === 0) return;
    localStorage.setItem(`case_${mission.id}_actions`, JSON.stringify(actions));
  }, [actions, mission?.id]);

  // One-tap action logging
  const logAction = (action) => {
    const newEntry = {
      id: Date.now(),
      actionId: action.id,
      label: action.label,
      timestamp: new Date().toISOString(),
      user: session?.user ? {
        id: session.user.id,
        name: session.user.name || session.user.email?.split('@')[0] || 'You',
      } : { name: 'You' },
    };

    setActions(prev => [newEntry, ...prev]);
    setJustLogged(action.id);
    showNotification?.('success', `${action.label} - logged!`);

    // Clear the "just logged" indicator after animation
    setTimeout(() => setJustLogged(null), 1500);
  };

  // Format relative time
  const formatTime = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Log Your Actions</h2>
        <p className="text-slate-400 text-sm">Tap to log - everyone sees what's been done</p>
      </div>

      {/* Quick Action Grid - 2x4 */}
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const colors = colorMap[action.color];
          const wasJustLogged = justLogged === action.id;

          return (
            <button
              key={action.id}
              onClick={() => logAction(action)}
              className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                wasJustLogged
                  ? `${colors.activeBg} border-transparent text-white scale-95`
                  : `${colors.bg} ${colors.border} ${colors.text} hover:scale-[1.02] active:scale-95`
              }`}
            >
              <Icon size={24} className={wasJustLogged ? 'text-white' : ''} />
              <span className="font-semibold text-sm">{action.label}</span>
              {wasJustLogged && (
                <div className="absolute right-3">
                  <Check size={20} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Action Feed */}
      <div className="space-y-2">
        <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
          <Clock size={14} />
          Recent Actions
        </h3>

        {actions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No actions logged yet</p>
            <p className="text-sm mt-1">Tap a button above to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.slice(0, 20).map((entry) => {
              const actionDef = QUICK_ACTIONS.find(a => a.id === entry.actionId);
              const colors = actionDef ? colorMap[actionDef.color] : colorMap.emerald;
              const Icon = actionDef?.icon || Check;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50"
                >
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <Icon size={16} className={colors.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{entry.label}</p>
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                      <User size={10} />
                      {entry.user?.name || 'Someone'} • {formatTime(entry.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
