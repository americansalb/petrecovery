'use client';

/**
 * ActionsTab - Guided SAR Actions
 *
 * Tells people what to do next and makes it easy to do it.
 * Smart prioritization based on what's already been done.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  FileText,
  Search,
  Camera,
  Users,
  Clock,
  ChevronRight,
  Check,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

// Guided actions with priority and context
const ALL_ACTIONS = [
  {
    id: 'photo',
    label: 'Share a clear photo',
    why: 'People need to know what to look for',
    icon: Camera,
    color: 'amber',
    priority: 1,
    action: 'share',
  },
  {
    id: 'neighbors',
    label: 'Alert your neighbors',
    why: 'They may have seen something',
    icon: Users,
    color: 'blue',
    priority: 2,
    action: 'share',
  },
  {
    id: 'shelters',
    label: 'Call nearby shelters',
    why: 'Pets are often brought there first',
    icon: Phone,
    color: 'emerald',
    priority: 3,
    action: 'call',
    details: 'Check daily - new animals arrive constantly',
  },
  {
    id: 'flyers',
    label: 'Put up flyers nearby',
    why: 'Within 1 mile of where they went missing',
    icon: FileText,
    color: 'purple',
    priority: 4,
    action: 'flyer',
  },
  {
    id: 'search_dawn',
    label: 'Search at dawn or dusk',
    why: 'Pets are most active during these times',
    icon: Search,
    color: 'pink',
    priority: 5,
    action: 'search',
    details: 'Bring treats and their favorite toy',
  },
  {
    id: 'litter',
    label: 'Put their litter box outside',
    why: 'Cats can smell it from up to a mile away',
    icon: Sparkles,
    color: 'teal',
    priority: 6,
    action: 'tip',
    petType: 'CAT',
  },
  {
    id: 'scent',
    label: 'Leave your worn clothes outside',
    why: 'Your scent helps them find home',
    icon: Sparkles,
    color: 'teal',
    priority: 6,
    action: 'tip',
  },
];

const colorMap = {
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', solid: 'bg-amber-500' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', solid: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', solid: 'bg-emerald-500' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', solid: 'bg-purple-500' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', solid: 'bg-pink-500' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400', solid: 'bg-teal-500' },
};

export default function TeamTab({ mission, showNotification, session }) {
  const [completed, setCompleted] = useState([]);

  // Load completed state
  useEffect(() => {
    if (!mission?.id) return;
    const saved = localStorage.getItem(`case_${mission.id}_guide_done`);
    if (saved) {
      try { setCompleted(JSON.parse(saved)); } catch (e) {}
    }
  }, [mission?.id]);

  // Save completed state
  useEffect(() => {
    if (!mission?.id) return;
    localStorage.setItem(`case_${mission.id}_guide_done`, JSON.stringify(completed));
  }, [completed, mission?.id]);

  // Filter and sort actions
  const actions = useMemo(() => {
    return ALL_ACTIONS
      .filter(a => !a.petType || a.petType === mission?.petSpecies)
      .sort((a, b) => a.priority - b.priority);
  }, [mission?.petSpecies]);

  const pendingActions = actions.filter(a => !completed.includes(a.id));
  const completedActions = actions.filter(a => completed.includes(a.id));
  const nextAction = pendingActions[0];

  // Mark action as done
  const markDone = (actionId) => {
    if (!completed.includes(actionId)) {
      setCompleted(prev => [...prev, actionId]);
      showNotification?.('success', 'Nice! Moving to next step...');
    }
  };

  // Undo completion
  const undoDone = (actionId) => {
    setCompleted(prev => prev.filter(id => id !== actionId));
  };

  // Handle action tap
  const handleAction = async (action) => {
    switch (action.action) {
      case 'share':
        const shareData = {
          title: `Help find ${mission?.petName}!`,
          text: `Lost ${mission?.petSpecies?.toLowerCase()}: ${mission?.petName}. Last seen: ${mission?.lastSeenAddress || 'unknown'}. Please share!`,
          url: window.location.href,
        };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
            markDone(action.id);
          } catch (e) {
            if (e.name !== 'AbortError') {
              await navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`);
              showNotification?.('success', 'Copied to clipboard!');
              markDone(action.id);
            }
          }
        } else {
          await navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`);
          showNotification?.('success', 'Copied to clipboard - paste anywhere!');
          markDone(action.id);
        }
        break;

      case 'flyer':
        window.open(`/cases/${mission?.id}/flyer`, '_blank');
        markDone(action.id);
        break;

      case 'call':
      case 'search':
      case 'tip':
        markDone(action.id);
        break;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">What to do</h2>
        <span className="text-sm text-slate-400">
          {completedActions.length}/{actions.length} done
        </span>
      </div>

      {/* Next Action - Highlighted */}
      {nextAction && (
        <div className="relative">
          <div className="absolute -top-2 left-4 px-2 py-0.5 bg-flash-500 text-slate-900 text-xs font-bold rounded-full">
            DO THIS NEXT
          </div>
          <button
            onClick={() => handleAction(nextAction)}
            className="w-full p-5 pt-6 bg-gradient-to-br from-flash-500/20 to-flash-600/10 border-2 border-flash-500/50 rounded-2xl text-left hover:border-flash-400 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-flash-500/20 rounded-xl">
                <nextAction.icon size={28} className="text-flash-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-lg">{nextAction.label}</p>
                <p className="text-flash-300 text-sm mt-1">{nextAction.why}</p>
                {nextAction.details && (
                  <p className="text-slate-400 text-xs mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {nextAction.details}
                  </p>
                )}
              </div>
              <ChevronRight size={24} className="text-flash-400 mt-1" />
            </div>
          </button>
        </div>
      )}

      {/* Other Pending Actions */}
      {pendingActions.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
            Also Important
          </h3>
          <div className="space-y-2">
            {pendingActions.slice(1).map((action) => {
              const Icon = action.icon;
              const colors = colorMap[action.color];

              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border ${colors.bg} ${colors.border} text-left hover:scale-[1.01] active:scale-[0.99] transition-all`}
                >
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <Icon size={20} className={colors.text} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{action.label}</p>
                    <p className="text-slate-400 text-sm">{action.why}</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-500" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedActions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
            <Check size={12} />
            Done
          </h3>
          <div className="space-y-1">
            {completedActions.map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.id}
                  onClick={() => undoDone(action.id)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 cursor-pointer hover:bg-slate-800/50"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-500/20">
                    <Check size={14} className="text-emerald-400" />
                  </div>
                  <span className="text-slate-400 line-through">{action.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Done */}
      {pendingActions.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-4">
            <Check size={32} className="text-emerald-400" />
          </div>
          <p className="text-white font-bold">You've done everything!</p>
          <p className="text-slate-400 text-sm mt-1">Keep searching and stay hopeful</p>
        </div>
      )}
    </div>
  );
}
