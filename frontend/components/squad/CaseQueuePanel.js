'use client';

/**
 * CaseQueuePanel - Left panel with case queue
 *
 * Tabs: Incoming | Active | Reunited
 * Shows filtered case cards based on selected division and tab
 */

import { useSquadHub } from './context/SquadHubContext';
import CaseCard from './CaseCard';
import { Inbox, Zap, Heart, PartyPopper } from 'lucide-react';

const tabs = [
  { id: 'INCOMING', label: 'Incoming', icon: Inbox },
  { id: 'ACTIVE', label: 'Active', icon: Zap },
  { id: 'REUNITED', label: 'Reunited', icon: Heart },
];

export default function CaseQueuePanel() {
  const { filteredCases, caseTab, setCaseTab, selectedDivisionId, divisions } = useSquadHub();

  // Get division name for empty state
  const divisionName = selectedDivisionId === 'ALL'
    ? 'your area'
    : divisions.find(d => d.id === selectedDivisionId)?.name || 'this division';

  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-[var(--hub-border)]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = caseTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setCaseTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5
                py-2 px-3 rounded-lg text-xs font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-[var(--hub-bg-card)] text-[var(--hub-text-primary)]'
                  : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-card)]/50'
                }
              `}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Case list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredCases.length === 0 ? (
          <EmptyState tab={caseTab} divisionName={divisionName} />
        ) : (
          filteredCases.map(caseItem => (
            <CaseCard key={caseItem.id} caseItem={caseItem} />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({ tab, divisionName }) {
  if (tab === 'INCOMING') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <div className="w-16 h-16 rounded-full bg-[var(--hub-status-success)]/10 flex items-center justify-center mb-4">
          <PartyPopper size={32} className="text-[var(--hub-status-success)]" />
        </div>
        <h3 className="text-[var(--hub-text-primary)] font-semibold mb-2">
          All clear in {divisionName}!
        </h3>
        <p className="text-xs text-[var(--hub-text-muted)] max-w-[200px]">
          No new cases need help right now. Check back later or browse active cases.
        </p>
      </div>
    );
  }

  if (tab === 'ACTIVE') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <div className="w-16 h-16 rounded-full bg-[var(--hub-accent-primary)]/10 flex items-center justify-center mb-4">
          <Zap size={32} className="text-[var(--hub-accent-primary)]" />
        </div>
        <h3 className="text-[var(--hub-text-primary)] font-semibold mb-2">
          No active cases
        </h3>
        <p className="text-xs text-[var(--hub-text-muted)] max-w-[200px]">
          There are no active search operations in {divisionName} right now.
        </p>
      </div>
    );
  }

  if (tab === 'REUNITED') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <div className="w-16 h-16 rounded-full bg-[var(--hub-status-success)]/10 flex items-center justify-center mb-4">
          <Heart size={32} className="text-[var(--hub-status-success)]" />
        </div>
        <h3 className="text-[var(--hub-text-primary)] font-semibold mb-2">
          Success stories coming soon
        </h3>
        <p className="text-xs text-[var(--hub-text-muted)] max-w-[200px]">
          When pets are reunited with their families, they'll appear here.
        </p>
      </div>
    );
  }

  return null;
}
