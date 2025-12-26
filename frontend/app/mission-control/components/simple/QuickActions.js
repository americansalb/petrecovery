'use client';

/**
 * QuickActions - Extensible icon action bar
 *
 * Design pattern for adding new actions:
 * Just add to the `actions` array - the UI automatically adapts.
 *
 * Shows 4-5 icons by default, with a "more" button for additional actions.
 */

import { useState } from 'react';
import {
  Eye,
  MapPin,
  Share2,
  FileText,
  MoreHorizontal,
  X,
  Home,
  Activity,
  Map,
  Users,
  Clipboard,
  Settings,
  Camera,
  Bell,
  MessageCircle
} from 'lucide-react';

// Default quick actions (visible in bar)
const DEFAULT_ACTIONS = [
  { id: 'sighting', icon: Eye, label: 'Sighting', color: 'amber' },
  { id: 'lastSeen', icon: MapPin, label: 'Last Seen', color: 'red' },
  { id: 'share', icon: Share2, label: 'Share', color: 'blue' },
  { id: 'log', icon: FileText, label: 'Log', color: 'purple' },
];

// Extended actions (shown in "more" menu)
const MORE_ACTIONS = [
  { id: 'details', icon: Home, label: 'Pet Details', color: 'slate' },
  { id: 'activity', icon: Activity, label: 'Activity Log', color: 'slate' },
  { id: 'streetView', icon: Map, label: 'Street View', color: 'slate' },
  { id: 'team', icon: Users, label: 'Search Team', color: 'slate' },
  { id: 'notes', icon: Clipboard, label: 'Case Notes', color: 'slate' },
  { id: 'photo', icon: Camera, label: 'Add Photo', color: 'slate' },
  { id: 'alerts', icon: Bell, label: 'Alert Settings', color: 'slate' },
  { id: 'message', icon: MessageCircle, label: 'Team Chat', color: 'slate' },
];

const colorClasses = {
  amber: 'text-amber-400 bg-amber-500/10',
  red: 'text-red-400 bg-red-500/10',
  blue: 'text-blue-400 bg-blue-500/10',
  purple: 'text-purple-400 bg-purple-500/10',
  green: 'text-green-400 bg-green-500/10',
  slate: 'text-slate-300 bg-slate-800',
};

export default function QuickActions({
  onAction,
  disabled = false,
  customActions = [], // Allow adding custom actions
}) {
  const [showMore, setShowMore] = useState(false);

  // Merge default + custom actions
  const actions = [...DEFAULT_ACTIONS, ...customActions].slice(0, 4);
  const moreActions = [...MORE_ACTIONS];

  const handleAction = (actionId) => {
    setShowMore(false);
    onAction?.(actionId);
  };

  return (
    <>
      <div className="flex items-center justify-around py-2 px-1">
        {/* Main action buttons */}
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={disabled}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'active:scale-95'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${colorClasses[action.color] || colorClasses.slate}`}>
              <action.icon size={20} />
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              {action.label}
            </span>
          </button>
        ))}

        {/* More button */}
        <button
          onClick={() => setShowMore(true)}
          disabled={disabled}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'active:scale-95'
          }`}
        >
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-400">
            <MoreHorizontal size={20} />
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            More
          </span>
        </button>
      </div>

      {/* More Actions Modal */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={() => setShowMore(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-800 max-h-[70vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">More Actions</h2>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Action Grid */}
            <div className="p-4 grid grid-cols-4 gap-3 overflow-y-auto max-h-[50vh]">
              {moreActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800 transition active:scale-95"
                >
                  <div className={`p-3 rounded-xl ${colorClasses[action.color] || colorClasses.slate}`}>
                    <action.icon size={22} />
                  </div>
                  <span className="text-xs font-medium text-slate-300 text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Bottom safe area */}
            <div className="h-8 bg-slate-900" />
          </div>
        </div>
      )}
    </>
  );
}
