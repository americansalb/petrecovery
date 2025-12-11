'use client';

/**
 * ContextBar - Persistent navigation context showing squad/case hierarchy
 *
 * Shows: Squad Name → Pet Name
 * Provides clear "back to squad" navigation
 * Helps users understand where they are in the app
 */

import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function ContextBar({ mission, onBackToSquad }) {
  // Extract squad info from mission assignments
  const squad = mission?.assignments?.[0]?.rescueSquad;
  const squadId = squad?.id || mission?.rescueSquadId || mission?.squadId;
  const squadName = squad?.name || squad?.city;

  // If no squad assigned, show link to find squads instead
  if (!squadId) {
    return (
      <div className="bg-slate-950/95 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Find Squads */}
            <Link
              href="/rescue-squads/search"
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition group min-w-0"
            >
              <ChevronLeft size={18} className="flex-shrink-0 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-sm font-medium truncate">
                Find Rescue Squads
              </span>
            </Link>

            {/* Separator */}
            <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />

            {/* Right: Current Pet/Mission */}
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              <span className="text-sm font-semibold text-white truncate">
                {mission?.petName || 'Mission'}
              </span>
              {mission?.lastSeenAddress && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 truncate">
                  <MapPin size={12} />
                  <span className="truncate max-w-[150px]">
                    {mission.lastSeenAddress.split(',')[0]}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/95 border-b border-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Back to Squad */}
          <Link
            href={`/rescue-squads/${squadId}`}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition group min-w-0"
          >
            <ChevronLeft size={18} className="flex-shrink-0 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium truncate">
              {squadName || 'Rescue Squad'}
            </span>
          </Link>

          {/* Separator */}
          <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />

          {/* Right: Current Pet/Mission */}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-sm font-semibold text-white truncate">
              {mission?.petName || 'Mission'}
            </span>
            {mission?.lastSeenAddress && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 truncate">
                <MapPin size={12} />
                <span className="truncate max-w-[150px]">
                  {mission.lastSeenAddress.split(',')[0]}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
