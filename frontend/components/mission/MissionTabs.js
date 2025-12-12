'use client';

/**
 * Mission Tabs - Simplified wrapper around CaseCommandCenterV2
 * Mobile-first design - just the tabs, no extra clutter
 */

import MissionCommandCenterV2 from '@/app/components/mission/CaseCommandCenterV2';

export default function MissionTabs({ mission, onRefresh, session }) {
  return (
    <MissionCommandCenterV2
      missionNumber={mission?.missionNumber || mission?.id}
      initialData={mission}
      onClose={null}
      hideHeader={true}
    />
  );
}
