'use client';

/**
 * SquadHeaderV2 - Beautiful squad header
 *
 * Shows:
 * - City name and subtitle
 * - Division selector chips
 * - Compact stats line
 * - Primary CTA button
 */

import { useState } from 'react';
import { Plus, Shield, Users, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SquadHeaderV2({
  squad,
  divisions,
  stats,
  onDivisionClick,
  membership,
  isDivisionPage = false,
  currentDivisionId = null,
}) {
  const router = useRouter();
  const cityName = squad.cityName || 'Unknown City';
  const state = squad.state || '';
  const currentDivision = divisions.find(d => d.id === currentDivisionId);

  const handleReportCase = () => {
    router.push('/cases/report');
  };

  const handleJoinSquad = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squad.id}/join`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to join squad:', error);
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900/50 to-slate-900 border-b border-orange-500/30">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.08),transparent_50%)]" />

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Title & Subtitle */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="text-orange-400" size={32} strokeWidth={2} />
            {isDivisionPage ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-1 rounded-md text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    DIVISION
                  </span>
                  <h1 className="text-3xl font-bold text-white">
                    {currentDivision?.name || 'Division'}
                  </h1>
                </div>
                <p className="text-slate-400 text-sm">
                  Division of {cityName} Rescue Squad
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-4xl font-bold text-white">
                  {cityName} <span className="text-orange-400">Rescue Squad</span>
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  Covers city limits + 1 mile surrounding area
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Division Selector */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {isDivisionPage ? (
              <>
                {/* Back to Squad Button */}
                <button
                  onClick={() => router.push(`/rescue-squads/${squad.id}`)}
                  className="
                    px-4 py-2 rounded-full text-sm font-medium
                    bg-slate-700/70 text-slate-300 hover:bg-slate-600
                    border border-slate-600
                    transition-all duration-200
                  "
                >
                  ← View Citywide Squad
                </button>

                {/* Current Division (highlighted) */}
                <DivisionChip
                  active={true}
                  onClick={() => {}}
                  label={currentDivision?.name || 'Division'}
                />

                {/* Other Divisions (navigate to their pages) */}
                {divisions.filter(d => d.id !== currentDivisionId).map(div => (
                  <DivisionChip
                    key={div.id}
                    active={false}
                    onClick={() => router.push(`/rescue-squads/${squad.id}/divisions/${div.id}`)}
                    label={div.name}
                    count={div.activeCaseCount}
                  />
                ))}
              </>
            ) : (
              <>
                {/* Squad Page: All divisions as preview triggers */}
                {divisions.length > 0 ? (
                  divisions.map(div => (
                    <DivisionChip
                      key={div.id}
                      active={false}
                      onClick={() => onDivisionClick(div.id)}
                      label={div.name}
                      count={div.activeCaseCount}
                    />
                  ))
                ) : (
                  <div className="text-slate-400 text-sm">
                    No divisions yet
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats & CTA Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Compact Stats Line */}
          <div className="flex items-center gap-6 text-sm">
            <StatItem
              label="Active"
              value={stats.active}
              color="text-red-400"
            />
            <StatItem
              label="Reunited (30 days)"
              value={stats.reunited}
              color="text-green-400"
            />
            <StatItem
              label="Members"
              value={stats.members}
              color="text-orange-400"
            />
            <StatItem
              label="On Duty"
              value={stats.onDuty}
              color="text-amber-400"
            />
          </div>

          {/* Primary CTA */}
          {membership.isMember ? (
            <button
              onClick={handleReportCase}
              className="
                flex items-center gap-2 px-6 py-3 rounded-lg
                bg-gradient-to-r from-orange-500 to-blue-500
                text-white font-semibold text-sm
                shadow-[0_0_30px_rgba(249,115,22,0.4)]
                hover:shadow-[0_0_40px_rgba(249,115,22,0.6)]
                hover:scale-105
                transition-all duration-200
              "
            >
              <Plus size={20} strokeWidth={2.5} />
              Report Lost or Found Pet
            </button>
          ) : (
            <button
              onClick={handleJoinSquad}
              className="
                flex items-center gap-2 px-6 py-3 rounded-lg
                bg-gradient-to-r from-amber-500 to-orange-500
                text-white font-semibold text-sm
                shadow-[0_0_30px_rgba(251,191,36,0.4)]
                hover:shadow-[0_0_40px_rgba(251,191,36,0.6)]
                hover:scale-105
                transition-all duration-200
              "
            >
              <Users size={20} strokeWidth={2.5} />
              Join This Squad
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DivisionChip({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-200
        ${active
          ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)]'
          : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/70 border border-slate-700'
        }
      `}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`ml-2 ${active ? 'text-white' : 'text-orange-400'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{label}:</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
