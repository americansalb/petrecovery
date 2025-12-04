'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Search, Plus } from 'lucide-react';

export default function CaseRail({
  missions = [],
  activeMissionId,
  onSelectMission
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      initial={{ width: 256 }}
      animate={{ width: collapsed ? 80 : 256 }}
      className="h-full bg-slate-900 border-r border-slate-800 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!collapsed && (
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Your Missions
          </h2>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <ChevronRight size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Mission List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {missions.map((mission) => {
          const isActive = mission.id === activeMissionId;
          const hours = mission.hoursMissing || 0;
          const urgencyColor = hours < 4 ? 'bg-red-500' : hours < 24 ? 'bg-amber-500' : 'bg-green-500';

          return (
            <button
              key={mission.id}
              onClick={() => onSelectMission(mission.id)}
              className={`
                w-full flex items-center gap-3 p-2 rounded-xl transition-all
                ${isActive
                  ? 'bg-slate-800 border border-slate-700 shadow-lg'
                  : 'hover:bg-slate-800/50 border border-transparent'
                }
              `}
            >
              <div className="relative flex-shrink-0">
                {mission.photoUrl ? (
                  <img
                    src={mission.photoUrl}
                    alt={mission.petName}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-lg">
                    {mission.petSpecies === 'DOG' ? '🐕' : '🐈'}
                  </div>
                )}
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${urgencyColor}`} />
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-bold text-white truncate">{mission.petName}</div>
                  <div className="text-xs text-slate-400 truncate">{mission.timeMissing}</div>
                </div>
              )}
            </button>
          );
        })}

        {/* Add New / Search */}
        <div className="pt-2 border-t border-slate-800 mt-2">
          <button className={`
            w-full flex items-center gap-3 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}>
            <div className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center">
              <Plus size={20} />
            </div>
            {!collapsed && <span className="text-sm font-medium">Join Mission</span>}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
