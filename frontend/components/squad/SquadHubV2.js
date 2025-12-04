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
import { MapPin, List, MessageSquare, Plus, ChevronDown, Clock, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SquadHeaderV2 from './SquadHeaderV2';
import CasesModeV2 from './CasesModeV2';
import MapModeV2 from './MapModeV2';
import CommunityModeV2 from './CommunityModeV2';
import DivisionPreviewCard from './DivisionPreviewCard';

export default function SquadHubV2({ initialData, squadId, isDivisionPage = false, currentDivisionId = null }) {
  // Active mode: 'cases', 'map', or 'community'
  const [activeMode, setActiveMode] = useState('community');

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
      c.status === 'PENDING' || c.status === 'IN_PROGRESS' || c.status === 'ACTIVE'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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

      {/* Active Cases Banner - Horizontal Scroll */}
      {filteredCases.length > 0 && (
        <div className="border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Active Cases</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
            </div>
            <div className="overflow-x-auto hub-scroll-hide">
              <div className="flex gap-3 pb-2">
                {filteredCases.slice(0, 10).map(caseData => (
                  <CaseBannerCard key={caseData.id} caseData={caseData} squadId={squadId} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode Tabs - Layered Folder Style */}
      <div className="sticky top-0 z-30 border-b-2 border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 pt-2">
            <ModeTab
              active={activeMode === 'community'}
              onClick={() => setActiveMode('community')}
              icon={MessageSquare}
              label="Community"
              count={chatMessages.length}
            />
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
            squadId={squadId}
            onCaseUpdate={() => {
              // TODO: Implement proper refresh - for now just reload the page
              window.location.reload();
            }}
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
            cases={allCases}
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
        group relative flex items-center gap-3 px-6 py-3.5
        rounded-t-xl transition-all duration-300
        ${active
          ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white z-10 translate-y-0.5 shadow-xl'
          : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 -translate-y-0 shadow-md'
        }
      `}
      style={{
        marginBottom: active ? '0' : '2px',
        borderBottom: active ? 'none' : '2px solid rgba(51, 65, 85, 0.3)',
      }}
    >
      {/* Tab border sides */}
      <div className={`absolute inset-0 rounded-t-xl border-2 transition-colors ${
        active
          ? 'border-flash-500/40 border-b-transparent'
          : 'border-slate-700/30 border-b-slate-700/50'
      }`} />

      {/* Content */}
      <div className="relative flex items-center gap-3">
        <Icon size={18} strokeWidth={2.5} className={active ? 'text-flash-400' : ''} />
        <span className="font-bold text-sm">{label}</span>
        {count !== undefined && count > 0 && (
          <span className={`
            px-2 py-0.5 rounded-full text-xs font-bold transition-colors
            ${active
              ? 'bg-flash-400/20 text-flash-300 border border-flash-400/30'
              : 'bg-slate-700/50 text-slate-400 border border-slate-700'
            }
          `}>
            {count}
          </span>
        )}
      </div>

      {/* Active tab glow */}
      {active && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-flash-400/60 to-transparent" />
      )}
    </button>
  );
}

function CaseBannerCard({ caseData, squadId }) {
  const router = useRouter();
  const {
    caseNumber,
    petName,
    species,
    photoUrl,
    urgency,
    helperCount,
  } = caseData;

  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  }[species] || '🐾';

  return (
    <button
      onClick={() => router.push(`/mission-control?mission=${caseNumber}`)}
      className="flex-shrink-0 group relative w-64 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 hover:border-flash-500/50 hover:shadow-lg hover:shadow-flash-500/20 transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Pet Photo/Icon */}
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={petName}
            className="w-12 h-12 rounded-lg object-cover border border-slate-600/50 group-hover:border-flash-500/30 transition-colors"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-700/50 border border-slate-600/50 group-hover:border-flash-500/30 flex items-center justify-center text-2xl transition-colors">
            {speciesEmoji}
          </div>
        )}

        {/* Case Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-white text-sm truncate group-hover:text-flash-400 transition-colors">
              {petName}
            </h4>
            {urgency === 'HIGH' && (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Users size={10} />
              {helperCount || 0}
            </span>
            <span className="text-slate-600">•</span>
            <span className="truncate">#{caseNumber}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
