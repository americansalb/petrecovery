'use client';

/**
 * SquadHeader - City name, On Duty toggle, Division chips
 *
 * Sticky header with:
 * - Squad display name and stats
 * - On Duty / Join Squad button
 * - Horizontal scrollable division filter chips
 */

import { useSquadHub } from './context/SquadHubContext';
import { Users, Radio, MapPin } from 'lucide-react';

export default function SquadHeader() {
  const {
    squad,
    membership,
    divisions,
    totalActiveCases,
    selectedDivisionId,
    setSelectedDivisionId,
    toggleOnDuty,
    joinSquad,
  } = useSquadHub();

  // Determine button state and label
  const getButtonConfig = () => {
    if (!membership.isMember) {
      return {
        label: 'Join Squad',
        onClick: joinSquad,
        className: 'bg-[var(--hub-accent-primary)]/20 border-[var(--hub-accent-primary)]/60 text-[var(--hub-accent-primary)]',
      };
    }
    if (membership.isOnDuty) {
      return {
        label: 'On Duty',
        onClick: toggleOnDuty,
        className: 'hub-on-duty-active border-[var(--hub-accent-primary)]',
      };
    }
    return {
      label: 'Go On Duty',
      onClick: toggleOnDuty,
      className: 'bg-transparent border-[var(--hub-border)] text-[var(--hub-text-secondary)] hover:border-[var(--hub-accent-primary)]/40',
    };
  };

  const buttonConfig = getButtonConfig();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hub-border)] bg-gradient-to-r from-[var(--hub-bg-root)] to-[var(--hub-bg-panel)]">
      {/* Main header row */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        {/* Left: Squad info */}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--hub-text-muted)] font-medium">
            Rescue Squad
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--hub-text-primary)] truncate">
            {squad.cityName || squad.displayName}
          </h1>
          {squad.cityName && squad.displayName !== squad.cityName && (
            <div className="text-sm text-[var(--hub-text-secondary)] font-medium">
              {squad.displayName}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-[var(--hub-text-muted)] mt-1">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {squad.memberCount.toLocaleString()} members
            </span>
            <span className="flex items-center gap-1">
              <Radio size={12} className="text-[var(--hub-status-success)]" />
              <span className="text-[var(--hub-status-success)]">{squad.onDutyCount}</span> on duty
            </span>
          </div>
        </div>

        {/* Right: On Duty button */}
        <button
          onClick={buttonConfig.onClick}
          className={`
            px-4 py-2 rounded-full text-xs font-semibold
            border transition-all duration-200
            flex items-center gap-2
            ${buttonConfig.className}
          `}
        >
          {membership.isOnDuty && (
            <span className="w-2 h-2 rounded-full bg-[var(--hub-status-success)] animate-pulse" />
          )}
          {buttonConfig.label}
        </button>
      </div>

      {/* Division chips row */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto hub-scroll-hide pb-1">
          {/* All chip */}
          <DivisionChip
            label="All"
            count={totalActiveCases}
            active={selectedDivisionId === 'ALL'}
            onClick={() => setSelectedDivisionId('ALL')}
          />

          {/* Division chips */}
          {divisions.map(div => (
            <DivisionChip
              key={div.id}
              label={div.name}
              count={div.activeCaseCount}
              active={selectedDivisionId === div.id}
              onClick={() => setSelectedDivisionId(div.id)}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

function DivisionChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        border transition-all duration-200 whitespace-nowrap flex-shrink-0
        ${active
          ? 'hub-chip-active'
          : 'bg-[var(--hub-bg-card)] border-[var(--hub-border)] text-[var(--hub-text-secondary)] hover:border-[var(--hub-accent-primary)]/30'
        }
      `}
    >
      <span>{label}</span>
      <span className={`
        text-[10px] px-1.5 py-0.5 rounded-full
        ${active
          ? 'bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]'
          : 'bg-black/30 text-[var(--hub-text-muted)]'
        }
      `}>
        {count}
      </span>
    </button>
  );
}
