'use client';

/**
 * MenuDrawer - Slide-out menu for Mission Control V4
 *
 * Features:
 * - Activity history link
 * - Team members link
 * - Mission details
 * - Owner controls (close case, edit, etc.)
 */

import {
  X,
  Clock,
  Users,
  Info,
  Settings,
  LogOut,
  Crown,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

export default function MenuDrawer({ mission, isOwner, onClose, onNavigate, router }) {
  const menuItems = [
    {
      id: 'activity',
      label: 'Activity History',
      icon: Clock,
      description: 'View all case activity',
      onClick: () => onNavigate('actions'),
    },
    {
      id: 'team',
      label: 'Team Members',
      icon: Users,
      description: `${mission?.helperCount || 0} helpers`,
      onClick: () => onNavigate('actions'),
    },
    {
      id: 'details',
      label: 'Case Details',
      icon: Info,
      description: 'View full pet information',
      onClick: () => router?.push(`/cases/${mission?.caseNumber}`),
    },
  ];

  const ownerItems = [
    {
      id: 'edit',
      label: 'Edit Case',
      icon: Settings,
      description: 'Update pet info or location',
      onClick: () => router?.push(`/cases/${mission?.caseNumber}/edit`),
    },
    {
      id: 'close',
      label: 'Close Case',
      icon: CheckCircle,
      description: 'Mark as reunited or close',
      color: 'text-emerald-400',
      onClick: () => router?.push(`/cases/${mission?.caseNumber}/close`),
    },
  ];

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-slate-900 border-l border-slate-700 shadow-xl animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* General Menu Items */}
          <div className="space-y-1">
            {menuItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition text-left"
                >
                  <Icon className="text-slate-400" size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">{item.label}</div>
                    <div className="text-slate-500 text-xs">{item.description}</div>
                  </div>
                  <ChevronRight className="text-slate-500" size={16} />
                </button>
              );
            })}
          </div>

          {/* Owner Controls */}
          {isOwner && (
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Crown className="text-flash-400" size={16} />
                <span className="text-sm font-medium text-flash-400">Owner Controls</span>
              </div>
              <div className="space-y-1">
                {ownerItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        item.onClick();
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition text-left"
                    >
                      <Icon className={item.color || 'text-slate-400'} size={20} />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium">{item.label}</div>
                        <div className="text-slate-500 text-xs">{item.description}</div>
                      </div>
                      <ChevronRight className="text-slate-500" size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leave Mission */}
          <div className="pt-4 border-t border-slate-700">
            <button
              onClick={() => {
                // TODO: Implement leave mission
                router?.push('/mission-control');
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition text-left"
            >
              <LogOut className="text-red-400" size={20} />
              <div className="flex-1 min-w-0">
                <div className="text-red-400 font-medium">Leave Mission</div>
                <div className="text-slate-500 text-xs">Return to mission list</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700 bg-slate-900">
          <div className="text-center">
            <div className="text-slate-500 text-xs">My Missions</div>
            <div className="text-slate-600 text-xs mt-1">Case #{mission?.missionNumber}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
