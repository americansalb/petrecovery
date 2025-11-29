'use client';

/**
 * SquadHub - Main layout component
 *
 * Two top-level tabs:
 * - Operations (default): Three-panel layout for rescue coordination
 * - Community: Social/community features
 *
 * Responsive layout:
 * - Desktop (1024px+): Three-panel or two-column layout
 * - Mobile: Tab-based navigation
 */

import { SquadHubProvider, useSquadHub } from './context/SquadHubContext';
import SquadHeader from './SquadHeader';
import YourMissionsBar from './YourMissionsBar';
import SquadTabsMobile from './SquadTabsMobile';
import CaseQueuePanel from './CaseQueuePanel';
import MapPanel from './MapPanel';
import ActivityPanel from './ActivityPanel';
import CommunityView from './CommunityView';
import CommunityTabsMobile from './CommunityTabsMobile';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Radar, Users } from 'lucide-react';

export default function SquadHub({ initialData }) {
  return (
    <SquadHubProvider initialData={initialData}>
      <SquadHubContent />
    </SquadHubProvider>
  );
}

function SquadHubContent() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { mainTab, setMainTab } = useSquadHub();

  return (
    <div className="squad-hub min-h-screen flex flex-col">
      {/* Header - always visible */}
      <SquadHeader />

      {/* Your Missions bar - shows user's active commitments */}
      <YourMissionsBar />

      {/* Top-level tabs */}
      <div className="border-b border-[var(--hub-border)] bg-[var(--hub-bg-panel)]">
        <div className="flex gap-1 px-4 py-2">
          <MainTabButton
            active={mainTab === 'OPERATIONS'}
            onClick={() => setMainTab('OPERATIONS')}
            icon={Radar}
            label="Operations"
          />
          <MainTabButton
            active={mainTab === 'COMMUNITY'}
            onClick={() => setMainTab('COMMUNITY')}
            icon={Users}
            label="Community"
          />
        </div>
      </div>

      {/* Content area - responsive */}
      {mainTab === 'OPERATIONS' ? (
        // Operations View
        isDesktop ? (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-80 flex-shrink-0 border-r border-[var(--hub-border)] overflow-hidden">
              <CaseQueuePanel />
            </div>
            <div className="flex-1 overflow-hidden">
              <MapPanel />
            </div>
            <div className="w-80 flex-shrink-0 border-l border-[var(--hub-border)] overflow-hidden">
              <ActivityPanel compact />
            </div>
          </div>
        ) : (
          <SquadTabsMobile />
        )
      ) : (
        // Community View
        isDesktop ? (
          <CommunityView />
        ) : (
          <CommunityTabsMobile />
        )
      )}
    </div>
  );
}

function MainTabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
        transition-all duration-200
        ${active
          ? 'bg-[var(--hub-accent-primary)]/15 text-[var(--hub-accent-primary)] shadow-[0_0_12px_rgba(34,211,238,0.2)]'
          : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-card)]/50'
        }
      `}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
