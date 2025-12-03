'use client';

/**
 * Mission Tabs - All mission functionality preserved
 *
 * This is a wrapper around CaseCommandCenterV2 that preserves 100% of functionality.
 * Instead of duplicating 1964 lines of code, we import and reuse the existing component.
 *
 * All features preserved:
 * - GPS tracking with localStorage
 * - Task completion modals
 * - Sighting reporting
 * - Team coordination
 * - Map visualization
 * - Activity timeline
 * - Management controls
 */

import CaseCommandCenterV2 from '@/app/components/case/CaseCommandCenterV2';

export default function MissionTabs({ mission, onRefresh, session }) {
  // Simply render the existing CaseCommandCenterV2 without the header wrapper
  // We pass onClose as null since we're in mission control mode
  return (
    <div className="mission-tabs-wrapper">
      <CaseCommandCenterV2
        caseNumber={mission?.caseNumber || mission?.id}
        initialData={mission}
        onClose={null}
        hideHeader={true}
      />
    </div>
  );
}
