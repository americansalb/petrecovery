'use client';

/**
 * ActionsTab - SAR Coordination
 *
 * Log search activities so the team knows what's been done.
 * Tap = logged with your location (if available)
 */

import { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  Phone,
  Home,
  MapPin,
  Check,
  Clock,
  Navigation,
} from 'lucide-react';

const ACTIONS = [
  {
    id: 'searched',
    label: 'Searched This Area',
    icon: Search,
    color: 'emerald',
    useLocation: true,
  },
  {
    id: 'flyers',
    label: 'Posted Flyers Here',
    icon: FileText,
    color: 'purple',
    useLocation: true,
  },
  {
    id: 'shelter',
    label: 'Called Shelter',
    icon: Phone,
    color: 'blue',
    useLocation: false,
  },
  {
    id: 'doors',
    label: 'Knocked on Doors',
    icon: Home,
    color: 'amber',
    useLocation: true,
  },
];

const colorMap = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', solid: 'bg-emerald-500' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', solid: 'bg-purple-500' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', solid: 'bg-blue-500' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', solid: 'bg-amber-500' },
};

export default function TeamTab({ mission, showNotification, session }) {
  const [logs, setLogs] = useState([]);
  const [justLogged, setJustLogged] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Load logs
  useEffect(() => {
    if (!mission?.id) return;
    const saved = localStorage.getItem(`case_${mission.id}_sar_logs`);
    if (saved) {
      try { setLogs(JSON.parse(saved)); } catch (e) {}
    }
  }, [mission?.id]);

  // Save logs
  useEffect(() => {
    if (!mission?.id || logs.length === 0) return;
    localStorage.setItem(`case_${mission.id}_sar_logs`, JSON.stringify(logs));
  }, [logs, mission?.id]);

  // Log an action
  const logAction = async (action) => {
    let location = null;

    if (action.useLocation && navigator.geolocation) {
      setGettingLocation(true);
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      } catch (e) {
        // Location not available, that's ok
      }
      setGettingLocation(false);
    }

    const entry = {
      id: Date.now(),
      actionId: action.id,
      label: action.label,
      location,
      timestamp: new Date().toISOString(),
      user: session?.user ? {
        name: session.user.name || session.user.email?.split('@')[0] || 'You',
      } : { name: 'You' },
    };

    setLogs(prev => [entry, ...prev]);
    setJustLogged(action.id);

    const locationText = location ? ' with location' : '';
    showNotification?.('success', `Logged: ${action.label}${locationText}`);

    setTimeout(() => setJustLogged(null), 1500);
  };

  const formatTime = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Log Search Activity</h2>
        <p className="text-slate-400 text-sm">Tap to log - team sees what's been covered</p>
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const colors = colorMap[action.color];
          const isDone = justLogged === action.id;

          return (
            <button
              key={action.id}
              onClick={() => logAction(action)}
              disabled={gettingLocation}
              className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border transition-all duration-200 ${
                isDone
                  ? `${colors.solid} border-transparent text-white scale-95`
                  : `${colors.bg} ${colors.border} ${colors.text} hover:scale-[1.02] active:scale-95`
              } ${gettingLocation ? 'opacity-50' : ''}`}
            >
              {isDone ? (
                <Check size={28} className="text-white" />
              ) : (
                <Icon size={28} />
              )}
              <span className="font-semibold text-sm text-center leading-tight">
                {action.label}
              </span>
              {action.useLocation && !isDone && (
                <div className="absolute top-2 right-2">
                  <Navigation size={12} className="text-slate-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Activity Log */}
      <div className="space-y-2">
        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
          <Clock size={12} />
          Search Activity ({logs.length})
        </h3>

        {logs.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <p className="text-sm">No activity logged yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 15).map((entry) => {
              const action = ACTIONS.find(a => a.id === entry.actionId);
              const colors = action ? colorMap[action.color] : colorMap.emerald;
              const Icon = action?.icon || Check;

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
                    <p className="text-slate-500 text-xs">
                      {entry.user?.name} • {formatTime(entry.timestamp)}
                      {entry.location && (
                        <span className="ml-1 text-emerald-400">
                          <MapPin size={10} className="inline" /> GPS
                        </span>
                      )}
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
