'use client';

/**
 * SquadTabsMobile - Mobile tab navigation
 *
 * Bottom tab bar for mobile:
 * - Cases (case queue)
 * - Map (full screen map)
 * - Squad (activity panel)
 *
 * Renders the appropriate panel based on selected tab.
 */

import { useSquadHub } from './context/SquadHubContext';
import CaseQueuePanel from './CaseQueuePanel';
import MapPanel from './MapPanel';
import ActivityPanel from './ActivityPanel';
import MissionDetailPanel from './MissionDetailPanel';
import { List, Map, Users } from 'lucide-react';

const tabs = [
  { id: 'CASES', label: 'Cases', icon: List },
  { id: 'MAP', label: 'Map', icon: Map },
  { id: 'SQUAD', label: 'Rescue Force', icon: Users },
];

export default function SquadTabsMobile() {
  const { mobileTab, setMobileTab, selectedMissionId } = useSquadHub();

  // If a case is selected, show the detail panel as full screen
  if (selectedMissionId) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <MissionDetailPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {mobileTab === 'CASES' && <CaseQueuePanel />}
        {mobileTab === 'MAP' && <MapPanel />}
        {mobileTab === 'SQUAD' && <ActivityPanel />}
      </div>

      {/* Bottom tab bar */}
      <div className="hub-mobile-tabs flex items-center justify-around py-2 safe-bottom">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = mobileTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`
                flex flex-col items-center gap-1 px-6 py-2 rounded-lg
                transition-all duration-200
                ${isActive ? 'hub-mobile-tab-active' : 'hub-mobile-tab'}
              `}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
