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
import { Shield, Radio, Crown } from 'lucide-react';

export default function MissionTabs({ mission, onRefresh, session }) {
  // Check deployment status
  const isDeployed = session && mission.helpers?.some(h => h.userId === session.user.id);
  const isOwner = session && mission.ownerId === session.user.id;

  return (
    <div className="mission-tabs-wrapper">
      {/* Deployment Status Banner */}
      {session && (isDeployed || isOwner) && (
        <div className="bg-slate-900/50 border-b border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-sm">
              {isOwner ? (
                <>
                  <Crown size={16} className="text-flash-400" />
                  <span className="text-flash-400 font-bold">MISSION COMMANDER</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">You initiated this rescue operation</span>
                </>
              ) : (
                <>
                  <Radio size={16} className="text-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold">DEPLOYED</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">You're actively helping with this mission</span>
                  <Shield size={16} className="text-emerald-400" />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <CaseCommandCenterV2
        caseNumber={mission?.caseNumber || mission?.id}
        initialData={mission}
        onClose={null}
        hideHeader={true}
      />
    </div>
  );
}
