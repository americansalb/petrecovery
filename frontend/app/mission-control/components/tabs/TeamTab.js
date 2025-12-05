'use client';

/**
 * ActionsTab - Actions that DO things and auto-log
 *
 * Tap = Action happens + gets logged automatically
 * No manual tracking, the app helps you DO the thing
 */

import { useState, useEffect } from 'react';
import {
  Phone,
  Share2,
  FileText,
  Search,
  ExternalLink,
  Check,
  Clock,
  User,
  Copy,
} from 'lucide-react';

// Actions that actually DO things
const getActions = (mission) => [
  {
    id: 'share',
    label: 'Share to Social',
    icon: Share2,
    color: 'blue',
    description: 'Post to Facebook, Nextdoor, etc.',
    action: 'share',
  },
  {
    id: 'flyer',
    label: 'Get Flyer',
    icon: FileText,
    color: 'purple',
    description: 'Download printable flyer',
    action: 'flyer',
    url: `/cases/${mission?.id}/flyer`,
  },
  {
    id: 'shelter',
    label: 'Call Local Shelter',
    icon: Phone,
    color: 'emerald',
    description: 'Check if they have your pet',
    action: 'call',
    phone: '311', // TODO: Get local shelter number
  },
  {
    id: 'craigslist',
    label: 'Search Craigslist',
    icon: Search,
    color: 'orange',
    description: 'Check lost & found listings',
    action: 'link',
    url: `https://craigslist.org/search/laf?query=${encodeURIComponent(mission?.petName || 'lost pet')}`,
  },
  {
    id: 'pawboost',
    label: 'Post to PawBoost',
    icon: ExternalLink,
    color: 'pink',
    description: 'Free lost pet alert service',
    action: 'link',
    url: 'https://www.pawboost.com/post-lost-pet',
  },
  {
    id: 'nextdoor',
    label: 'Post to Nextdoor',
    icon: ExternalLink,
    color: 'amber',
    description: 'Alert your neighbors',
    action: 'link',
    url: 'https://nextdoor.com/post/create/',
  },
];

const colorMap = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', activeBg: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', activeBg: 'bg-amber-500' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', activeBg: 'bg-blue-500' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', activeBg: 'bg-purple-500' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/50', text: 'text-pink-400', activeBg: 'bg-pink-500' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', activeBg: 'bg-orange-500' },
};

export default function TeamTab({ mission, showNotification, session }) {
  const [actions, setActions] = useState([]);
  const [justDone, setJustDone] = useState(null);

  const ACTIONS = getActions(mission);

  // Load action history
  useEffect(() => {
    if (!mission?.id) return;
    const saved = localStorage.getItem(`case_${mission.id}_actions`);
    if (saved) {
      try { setActions(JSON.parse(saved)); } catch (e) {}
    }
  }, [mission?.id]);

  // Save action history
  useEffect(() => {
    if (!mission?.id || actions.length === 0) return;
    localStorage.setItem(`case_${mission.id}_actions`, JSON.stringify(actions));
  }, [actions, mission?.id]);

  // Auto-log after action
  const logAction = (actionDef) => {
    const entry = {
      id: Date.now(),
      actionId: actionDef.id,
      label: actionDef.label,
      timestamp: new Date().toISOString(),
      user: session?.user ? {
        name: session.user.name || session.user.email?.split('@')[0] || 'You',
      } : { name: 'You' },
    };
    setActions(prev => [entry, ...prev]);
    setJustDone(actionDef.id);
    setTimeout(() => setJustDone(null), 2000);
  };

  // Execute action
  const doAction = async (actionDef) => {
    switch (actionDef.action) {
      case 'share':
        const shareData = {
          title: `Help find ${mission?.petName}!`,
          text: `Lost ${mission?.petSpecies?.toLowerCase() || 'pet'}: ${mission?.petName}. Last seen near ${mission?.lastSeenAddress || 'unknown location'}. Please share!`,
          url: window.location.href,
        };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
            logAction(actionDef);
            showNotification?.('success', 'Shared! Auto-logged.');
          } catch (e) {
            if (e.name !== 'AbortError') {
              // Fallback: copy to clipboard
              await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
              logAction(actionDef);
              showNotification?.('success', 'Copied to clipboard! Auto-logged.');
            }
          }
        } else {
          await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
          logAction(actionDef);
          showNotification?.('success', 'Copied to clipboard! Auto-logged.');
        }
        break;

      case 'flyer':
        window.open(actionDef.url, '_blank');
        logAction(actionDef);
        showNotification?.('success', 'Opening flyer! Auto-logged.');
        break;

      case 'call':
        window.location.href = `tel:${actionDef.phone}`;
        logAction(actionDef);
        showNotification?.('success', 'Calling! Auto-logged.');
        break;

      case 'link':
        window.open(actionDef.url, '_blank');
        logAction(actionDef);
        showNotification?.('success', 'Opened! Auto-logged.');
        break;
    }
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
        <h2 className="text-lg font-bold text-white mb-1">Take Action</h2>
        <p className="text-slate-400 text-sm">Tap to do it - auto-logged for the team</p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {ACTIONS.map((actionDef) => {
          const Icon = actionDef.icon;
          const colors = colorMap[actionDef.color];
          const isDone = justDone === actionDef.id;

          return (
            <button
              key={actionDef.id}
              onClick={() => doAction(actionDef)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
                isDone
                  ? `${colors.activeBg} border-transparent text-white`
                  : `${colors.bg} ${colors.border} hover:scale-[1.01] active:scale-[0.99]`
              }`}
            >
              <div className={`p-3 rounded-xl ${isDone ? 'bg-white/20' : colors.bg}`}>
                {isDone ? <Check size={24} className="text-white" /> : <Icon size={24} className={colors.text} />}
              </div>
              <div className="flex-1">
                <p className={`font-bold ${isDone ? 'text-white' : 'text-white'}`}>{actionDef.label}</p>
                <p className={`text-sm ${isDone ? 'text-white/80' : 'text-slate-400'}`}>{actionDef.description}</p>
              </div>
              <ExternalLink size={18} className={isDone ? 'text-white/60' : 'text-slate-500'} />
            </button>
          );
        })}
      </div>

      {/* Recent Activity */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
            <Clock size={12} />
            Team Activity
          </h3>
          <div className="space-y-1">
            {actions.slice(0, 10).map((entry) => {
              const def = ACTIONS.find(a => a.id === entry.actionId);
              const colors = def ? colorMap[def.color] : colorMap.blue;
              return (
                <div key={entry.id} className="flex items-center gap-2 py-2 px-3 bg-slate-800/30 rounded-lg text-sm">
                  <div className={`w-2 h-2 rounded-full ${colors.activeBg}`} />
                  <span className="text-white">{entry.label}</span>
                  <span className="text-slate-500 text-xs ml-auto">{entry.user?.name} • {formatTime(entry.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
