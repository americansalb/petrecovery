'use client';

/**
 * SquadHubV2 - Complete redesign based on new vision
 *
 * Simple, tab-based interface:
 * - Squad Header (city, divisions, stats, CTA)
 * - Mode Tabs (Cases, Map, Community)
 * - Mode Content Area (only one visible at a time)
 *
 * Beautiful, intuitive, mobile-first design
 */

import { useState, useMemo } from 'react';
import { MapPin, List, MessageSquare, Plus, ChevronDown } from 'lucide-react';
import SquadHeaderV2 from './SquadHeaderV2';
import CasesModeV2 from './CasesModeV2';
import MapModeV2 from './MapModeV2';
import CommunityModeV2 from './CommunityModeV2';

export default function SquadHubV2({ initialData, squadId }) {
  // Active mode: 'cases', 'map', or 'community'
  const [activeMode, setActiveMode] = useState('cases');

  // Selected division filter (null = "All {City}")
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);

  // Selected status filter for Cases mode
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE');

  // Extract data from API response
  const squad = initialData?.squad || {};
  const divisions = initialData?.divisions || [];
  const allCases = initialData?.cases || [];
  const chatMessages = initialData?.chat?.messages || [];
  const announcements = initialData?.announcements || [];
  const membership = initialData?.membership || {};

  // Filter cases by division and status
  const filteredCases = useMemo(() => {
    let filtered = allCases;

    // Filter by division
    if (selectedDivisionId) {
      filtered = filtered.filter(c => c.divisionId === selectedDivisionId);
    }

    // Filter by status
    if (selectedStatus === 'INCOMING') {
      filtered = filtered.filter(c => c.status === 'PENDING');
    } else if (selectedStatus === 'ACTIVE') {
      filtered = filtered.filter(c =>
        c.status === 'IN_PROGRESS' || c.status === 'ACTIVE'
      );
    } else if (selectedStatus === 'REUNITED') {
      filtered = filtered.filter(c => c.status === 'REUNITED');
    }

    return filtered;
  }, [allCases, selectedDivisionId, selectedStatus]);

  // Calculate stats for header
  const stats = useMemo(() => {
    const activeCases = allCases.filter(c =>
      c.status === 'IN_PROGRESS' || c.status === 'ACTIVE'
    ).length;

    const reunitedCases = allCases.filter(c => c.status === 'REUNITED').length;

    return {
      active: activeCases,
      reunited: reunitedCases,
      members: squad.memberCount || 0,
      onDuty: squad.onDutyCount || 0,
    };
  }, [allCases, squad]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Squad Header */}
      <SquadHeaderV2
        squad={squad}
        divisions={divisions}
        stats={stats}
        selectedDivisionId={selectedDivisionId}
        onDivisionChange={setSelectedDivisionId}
        membership={membership}
      />

      {/* Mode Tabs */}
      <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-3">
            <ModeTab
              active={activeMode === 'cases'}
              onClick={() => setActiveMode('cases')}
              icon={List}
              label="Cases"
              count={filteredCases.length}
            />
            <ModeTab
              active={activeMode === 'map'}
              onClick={() => setActiveMode('map')}
              icon={MapPin}
              label="Map"
            />
            <ModeTab
              active={activeMode === 'community'}
              onClick={() => setActiveMode('community')}
              icon={MessageSquare}
              label="Community"
              count={chatMessages.length}
            />
          </div>
        </div>
      </div>

      {/* Mode Content Area - Only one visible at a time */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeMode === 'cases' && (
          <CasesModeV2
            cases={filteredCases}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            cityName={squad.cityName}
          />
        )}

        {activeMode === 'map' && (
          <MapModeV2
            cases={filteredCases}
            divisions={divisions}
            selectedDivisionId={selectedDivisionId}
            squad={squad}
          />
        )}

        {activeMode === 'community' && (
          <CommunityModeV2
            squadId={squadId}
            messages={chatMessages}
            announcements={announcements}
            membership={membership}
          />
        )}
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold
        transition-all duration-200 relative
        ${active
          ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
          : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
        }
      `}
    >
      <Icon size={18} strokeWidth={2.5} />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`
          ml-1 px-2 py-0.5 rounded-full text-xs font-bold
          ${active
            ? 'bg-cyan-400 text-slate-900'
            : 'bg-slate-700 text-slate-300'
          }
        `}>
          {count}
        </span>
      )}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
      )}
    </button>
  );
}
