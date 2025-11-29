'use client';

/**
 * SquadHub - Main layout component
 *
 * Responsive layout:
 * - Desktop (1024px+): Three-panel layout
 * - Mobile: Tab-based navigation
 *
 * Wraps everything in SquadHubProvider for state management.
 */

import { SquadHubProvider } from './context/SquadHubContext';
import SquadHeader from './SquadHeader';
import SquadTabsMobile from './SquadTabsMobile';
import CaseQueuePanel from './CaseQueuePanel';
import MapPanel from './MapPanel';
import ActivityPanel from './ActivityPanel';
import { useMediaQuery } from '@/lib/useMediaQuery';

export default function SquadHub({ initialData }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <SquadHubProvider initialData={initialData}>
      <div className="squad-hub min-h-screen flex flex-col">
        {/* Header - always visible */}
        <SquadHeader />

        {/* Content area - responsive */}
        {isDesktop ? (
          /* Desktop: Three-panel layout */
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Case Queue */}
            <div className="w-80 flex-shrink-0 border-r border-[var(--hub-border)] overflow-hidden">
              <CaseQueuePanel />
            </div>

            {/* Center: Map */}
            <div className="flex-1 overflow-hidden">
              <MapPanel />
            </div>

            {/* Right: Activity */}
            <div className="w-80 flex-shrink-0 border-l border-[var(--hub-border)] overflow-hidden">
              <ActivityPanel />
            </div>
          </div>
        ) : (
          /* Mobile: Tab-based navigation */
          <SquadTabsMobile />
        )}
      </div>
    </SquadHubProvider>
  );
}
