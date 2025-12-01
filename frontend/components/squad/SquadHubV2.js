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
import DivisionPreviewCard from './DivisionPreviewCard';

export default function SquadHubV2({ initialData, squadId, isDivisionPage = false, currentDivisionId = null }) {
  // Active mode: 'cases', 'map', or 'community'
  const [activeMode, setActiveMode] = useState('cases');

  // Preview division (for showing preview card)
  const [previewDivisionId, setPreviewDivisionId] = useState(null);

  // Selected status filter for Cases mode
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE');

  // Extract data from API response
  const squad = initialData?.squad || {};
  const divisions = initialData?.divisions || [];
  const allCases = initialData?.cases || [];
  const chatMessages = initialData?.chat?.messages || [];
  const announcements = initialData?.announcements || [];
  const membership = initialData?.membership || {};

  // Filter cases by division (if on division page) or status
  const filteredCases = useMemo(() => {
    let filtered = allCases;

    // If on division page, only show that division's cases
    if (isDivisionPage && currentDivisionId) {
      filtered = filtered.filter(c => c.divisionId === currentDivisionId);
    }

    // Filter by status
    if (selectedStatus === 'ACTIVE') {
      filtered = filtered.filter(c =>
        c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.status === 'PENDING'
      );
    } else if (selectedStatus === 'REUNITED') {
      filtered = filtered.filter(c => c.status === 'REUNITED');
    }

    return filtered;
  }, [allCases, isDivisionPage, currentDivisionId, selectedStatus]);

  // Handler for division chip click
  const handleDivisionClick = (divisionId) => {
    setPreviewDivisionId(divisionId);
  };

  const handleClosePreview = () => {
    setPreviewDivisionId(null);
  };

  // Get preview division object
  const previewDivision = divisions.find(d => d.id === previewDivisionId);

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
        onDivisionClick={handleDivisionClick}
        membership={membership}
        isDivisionPage={isDivisionPage}
        currentDivisionId={currentDivisionId}
      />

      {/* Mode Tabs */}
      <div className="sticky top-0 z-30 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border-b-2 border-yellow-600/30 shadow-lg shadow-slate-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 py-4">
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
      <div className="max-w-7xl mx-auto px-6 py-8">
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
            squad={squad}
          />
        )}

        {activeMode === 'community' && (
          <CommunityModeV2
            squadId={squadId}
            messages={chatMessages}
            announcements={announcements}
            membership={membership}
            isDivisionPage={isDivisionPage}
            divisionId={currentDivisionId}
            divisions={divisions}
          />
        )}
      </div>

      {/* Division Preview Card */}
      {previewDivision && !isDivisionPage && (
        <DivisionPreviewCard
          division={previewDivision}
          cases={allCases}
          squadId={squadId}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
}

function ModeTab({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 px-8 py-4 rounded-xl text-base font-bold
        backdrop-blur-sm transition-all duration-300 relative
        ${active
          ? 'bg-gradient-to-r from-yellow-600/30 to-amber-500/30 text-yellow-400 border-2 border-yellow-600/60 shadow-lg shadow-yellow-600/30 scale-105'
          : 'text-slate-400 border-2 border-slate-700/40 bg-slate-800/30 hover:text-slate-200 hover:bg-slate-800/50 hover:border-slate-600/50 hover:scale-102'
        }
      `}
    >
      <Icon size={20} strokeWidth={2.5} />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`
          px-2.5 py-1 rounded-full text-xs font-bold
          ${active
            ? 'bg-gradient-to-r from-yellow-500 to-amber-400 text-slate-900 shadow-sm'
            : 'bg-slate-700/70 text-slate-300'
          }
        `}>
          {count}
        </span>
      )}
      {active && (
        <div className="absolute -bottom-0.5 left-4 right-4 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent rounded-full" />
      )}
    </button>
  );
}
