'use client';

/**
 * Mission Tabs - Simplified wrapper around CaseCommandCenterV2
 * Mobile-first design - just the tabs, no extra clutter
 */

import CaseCommandCenterV2 from '@/app/components/case/CaseCommandCenterV2';

export default function MissionTabs({ mission, onRefresh, session }) {
  return (
    <CaseCommandCenterV2
      caseNumber={mission?.caseNumber || mission?.id}
      initialData={mission}
      onClose={null}
      hideHeader={true}
    />
  );
}
