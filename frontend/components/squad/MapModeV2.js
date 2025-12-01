'use client';

/**
 * MapModeV2 - Map mode for visualizing cases geographically
 *
 * Shows:
 * - Interactive map centered on city
 * - Case pins color-coded by status
 * - Division boundaries (if selected)
 * - Clickable pins open bottom sheet with case preview
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Dynamically import Leaflet to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponentV2'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-slate-800/50 rounded-xl flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mb-4"></div>
        <p className="text-slate-400">Loading map...</p>
      </div>
    </div>
  ),
});

export default function MapModeV2({
  cases,
  divisions,
  squad,
}) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const router = useRouter();

  // Find selected case
  const selectedCase = cases.find(c => c.id === selectedCaseId);

  return (
    <div className="space-y-6">
      {/* Map Container */}
      <div className="relative">
        <MapComponent
          cases={cases}
          divisions={divisions}
          squad={squad}
          onCaseClick={setSelectedCaseId}
        />

        {/* Case Detail Bottom Sheet */}
        {selectedCase && (
          <CaseBottomSheet
            caseData={selectedCase}
            onClose={() => setSelectedCaseId(null)}
            onOpenCase={() => router.push(`/cases/${selectedCase.caseNumber}`)}
          />
        )}
      </div>

      {/* Map Legend */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Map Legend</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <LegendItem color="bg-red-500" label="Active Cases" />
          <LegendItem color="bg-amber-500" label="Incoming" />
          <LegendItem color="bg-green-500" label="Reunited" />
          <LegendItem color="bg-orange-500" label="Division Boundary" />
        </div>
      </div>
    </div>
  );
}

function CaseBottomSheet({ caseData, onClose, onOpenCase }) {
  const {
    petName,
    species,
    caseNumber,
    status,
    lastSeenAddress,
    photoUrl,
  } = caseData;

  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  }[species] || '🐾';

  const statusConfig = {
    PENDING: { label: 'Incoming', color: 'text-amber-400' },
    IN_PROGRESS: { label: 'Active', color: 'text-red-400' },
    ACTIVE: { label: 'Active', color: 'text-red-400' },
    REUNITED: { label: 'Reunited', color: 'text-green-400' },
  };

  const statusStyle = statusConfig[status] || statusConfig.ACTIVE;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-t-2 border-orange-500/50 rounded-t-2xl shadow-[0_-10px_50px_rgba(0,0,0,0.5)] p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="flex gap-4 mb-4">
          {/* Pet Photo */}
          {photoUrl ? (
            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-700">
              <img
                src={photoUrl}
                alt={petName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-4xl">
              {speciesEmoji}
            </div>
          )}

          {/* Case Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold text-white mb-1">{petName}</h3>
            <p className="text-sm text-slate-400 mb-2">Case #{caseNumber}</p>
            <p className={`text-sm font-semibold ${statusStyle.color}`}>
              {statusStyle.label}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="mb-4">
          <p className="text-sm text-slate-400 mb-1">Last seen:</p>
          <p className="text-slate-200">{lastSeenAddress || 'Location unknown'}</p>
        </div>

        {/* Open Case Button */}
        <button
          onClick={onOpenCase}
          className="
            w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg
            bg-gradient-to-r from-orange-500 to-blue-500
            text-white font-semibold
            shadow-[0_0_20px_rgba(249,115,22,0.4)]
            hover:shadow-[0_0_30px_rgba(249,115,22,0.6)]
            transition-all duration-200
          "
        >
          Open Case
          <ExternalLink size={18} />
        </button>
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
