'use client';

/**
 * YourMissionsBar - Horizontal strip showing user's active missions
 *
 * Displays a thin horizontal row of chips for:
 * - Cases where user is helping
 * - Requests where user is helping (not completed)
 *
 * Each chip is clickable and navigates to the appropriate view.
 */

import { useForceHub } from './context/ForceHubContext';
import { PawPrint, CheckCircle2, ChevronRight } from 'lucide-react';

export default function YourMissionsBar() {
  const { yourMissions, openMission, membership } = useForceHub();

  // Don't show if not a member or no missions
  if (!membership.isMember) return null;

  if (yourMissions.length === 0) {
    return (
      <div className="px-4 py-2 bg-[var(--hub-bg-panel)]/50 border-b border-[var(--hub-border)]">
        <p className="text-xs text-[var(--hub-text-muted)] text-center">
          No missions yet. Tap <span className="text-[var(--hub-accent-primary)]">Help</span> on a pet or <span className="text-[var(--hub-accent-primary)]">I'll help</span> on a request to take one on.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 bg-[var(--hub-bg-panel)]/50 border-b border-[var(--hub-border)]">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="text-[10px] font-medium text-[var(--hub-text-muted)] uppercase tracking-wider flex-shrink-0">
          Your missions
        </span>
        <ChevronRight size={12} className="text-[var(--hub-text-muted)] flex-shrink-0" />
        <div className="flex items-center gap-2">
          {yourMissions.map(mission => (
            <MissionChip
              key={`${mission.type}-${mission.id}`}
              mission={mission}
              onClick={() => openMission(mission)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MissionChip({ mission, onClick }) {
  const isCase = mission.type === 'CASE';

  // Status colors
  const getStatusColor = () => {
    if (isCase) {
      switch (mission.urgency) {
        case 'HIGH':
          return 'var(--hub-status-high)';
        case 'MEDIUM':
          return 'var(--hub-status-medium)';
        case 'LOW':
          return 'var(--hub-status-low)';
        default:
          return 'var(--hub-accent-primary)';
      }
    } else {
      switch (mission.status) {
        case 'OPEN':
          return 'var(--hub-accent-primary)';
        case 'IN_PROGRESS':
          return 'var(--hub-status-medium)';
        default:
          return 'var(--hub-status-success)';
      }
    }
  };

  const statusColor = getStatusColor();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--hub-bg-card)] border border-[var(--hub-border)] hover:border-[var(--hub-accent-primary)]/50 transition-all group flex-shrink-0"
    >
      {/* Icon */}
      {isCase ? (
        <PawPrint size={12} style={{ color: statusColor }} />
      ) : (
        <CheckCircle2 size={12} style={{ color: statusColor }} />
      )}

      {/* Label */}
      <span className="text-[11px] font-medium text-[var(--hub-text-primary)] group-hover:text-[var(--hub-accent-primary)] transition-colors max-w-[120px] truncate">
        {mission.label}
      </span>

      {/* Status dot */}
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: statusColor }}
      />
    </button>
  );
}
