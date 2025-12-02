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
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
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

  const handleCaseClick = (caseId) => {
    console.log('[MapModeV2] Case clicked:', caseId);
    console.log('[MapModeV2] Available cases:', cases.map(c => ({ id: c.id, petName: c.petName })));
    setSelectedCaseId(caseId);
  };

  // Find selected case
  const selectedCase = cases.find(c => c.id === selectedCaseId);
  console.log('[MapModeV2] Selected case ID:', selectedCaseId);
  console.log('[MapModeV2] Found selected case:', selectedCase ? { id: selectedCase.id, petName: selectedCase.petName } : null);

  return (
    <div className="space-y-6">
      {/* Map Container */}
      <div className="relative" style={{ minHeight: '500px' }}>
        <MapComponent
          cases={cases}
          divisions={divisions}
          squad={squad}
          onCaseClick={handleCaseClick}
        />
      </div>

      {/* Case Detail Bottom Sheet - OUTSIDE map container for proper positioning */}
      {selectedCase && (
        <CaseBottomSheet
          caseData={selectedCase}
          onClose={() => setSelectedCaseId(null)}
          onOpenCase={() => router.push(`/cases/${selectedCase.caseNumber}`)}
        />
      )}

      {/* Map Legend */}
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-lg">
        <h4 className="text-sm font-bold text-white mb-4 tracking-wide uppercase">Map Legend</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <LegendItem color="bg-red-500" label="Active Cases" />
          <LegendItem color="bg-cyan-400" label="Incoming" />
          <LegendItem color="bg-green-500" label="Reunited" />
          <LegendItem color="bg-cyan-500" label="Division Boundary" />
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
    photoUrls,
  } = caseData;

  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  }[species] || '🐾';

  // Extract first photo from photoUrls JSON array
  let petPhotoUrl = null;
  if (photoUrls) {
    try {
      const photos = typeof photoUrls === 'string'
        ? JSON.parse(photoUrls)
        : photoUrls;
      petPhotoUrl = Array.isArray(photos) && photos.length > 0 ? photos[0] : null;
    } catch (e) {
      console.error('Failed to parse photoUrls:', e);
    }
  }

  const statusConfig = {
    PENDING: { label: 'Incoming', color: 'text-cyan-300' },
    IN_PROGRESS: { label: 'Active', color: 'text-red-400' },
    ACTIVE: { label: 'Active', color: 'text-red-400' },
    REUNITED: { label: 'Reunited', color: 'text-green-400' },
  };

  const statusStyle = statusConfig[status] || statusConfig.ACTIVE;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] animate-slide-up pointer-events-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl border-t-2 border-cyan-500/60 rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.7)] p-8" style={{ minHeight: '250px' }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-cyan-500/50 transition-all duration-200 hover:scale-110"
        >
          <X size={22} />
        </button>

        {/* Content */}
        <div className="flex gap-5 mb-6">
          {/* Pet Photo */}
          {petPhotoUrl ? (
            <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-slate-700 border-2 border-slate-600/50">
              <img
                src={petPhotoUrl}
                alt={petName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-24 h-24 rounded-xl bg-gradient-to-br from-slate-700/80 to-slate-800/80 border-2 border-slate-600/50 flex items-center justify-center text-4xl">
              {speciesEmoji}
            </div>
          )}

          {/* Case Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200 mb-2">{petName}</h3>
            <p className="text-sm text-slate-500 font-medium mb-3">Case #{caseNumber}</p>
            <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold ${statusStyle.color} bg-slate-800/50 border border-slate-700/50`}>
              {statusStyle.label}
            </span>
          </div>
        </div>

        {/* Location */}
        <div className="mb-6 p-4 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Last seen:</p>
          <p className="text-slate-200 font-medium text-base">{lastSeenAddress || 'Location unknown'}</p>
        </div>

        {/* Open Case Button */}
        <button
          onClick={onOpenCase}
          className="
            w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl
            bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500
            text-white font-bold text-lg
            shadow-[0_0_30px_rgba(249,115,22,0.5)]
            hover:shadow-[0_0_40px_rgba(249,115,22,0.7)]
            hover:scale-105
            transition-all duration-300
          "
        >
          Open Full Case
          <ExternalLink size={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-4 h-4 rounded-full ${color} shadow-lg shadow-${color}/50`} />
      <span className="text-sm text-slate-300 font-medium">{label}</span>
    </div>
  );
}
