'use client';

/**
 * OverviewTab - Redesigned Mission Overview
 *
 * Layout (top to bottom):
 * 1. Large centered pet photo with status badges
 * 2. Pet name & key details
 * 3. 4 action buttons in grid (2x2 mobile, 4 across desktop)
 * 4. Map preview (clickable to go to Map tab)
 * 5. Pet details card (expandable on mobile)
 *
 * Action buttons take DIRECT ACTION - no navigation to other tabs
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Eye,
  MapPin,
  Share2,
  MessageCircle,
  AlertCircle,
  Clock,
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from 'lucide-react';
import { normalizePhotoUrl } from '@/app/lib/utils';
import useScoutTips from '@/app/mission-control/hooks/useScoutTips';
import ScoutTipBanner, { ScoutTipCarousel } from '@/app/components/missionControl/ScoutTipBanner';

// Lazy load map for performance
const MapView = dynamic(() => import('@/app/components/case/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800/50 flex items-center justify-center rounded-xl">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  )
});

export default function OverviewTab({
  mission,
  timeMissing,
  isUrgent,
  isReunited,
  sightings = [],
  onReportSighting,
  onLogActivity,
  onMessageGroup,
  onNavigateToMap,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [shareStatus, setShareStatus] = useState(null); // 'copied' | 'shared' | 'error'
  const [tipIndex, setTipIndex] = useState(0);

  // Scout tips for contextual guidance
  const {
    tips,
    loading: tipsLoading,
    dismissing,
    dismissTip,
  } = useScoutTips(mission?.id);

  // Carousel navigation
  const handleNextTip = () => setTipIndex((i) => (i + 1) % tips.length);
  const handlePrevTip = () => setTipIndex((i) => (i - 1 + tips.length) % tips.length);

  if (!mission) return null;

  // Handle share action
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/cases/${mission.caseNumber || mission.id}`;
    const shareText = `Help find ${mission.petName}! ${mission.petBreed || mission.petSpecies} missing near ${mission.lastSeenAddress?.split(',').slice(0, 2).join(',') || 'unknown location'}.`;

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Missing: ${mission.petName}`,
          text: shareText,
          url: shareUrl,
        });
        setShareStatus('shared');
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Fall back to clipboard
          await copyToClipboard(shareUrl);
        }
      }
    } else {
      // Desktop - copy to clipboard
      await copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus('copied');
      setTimeout(() => setShareStatus(null), 2000);
    } catch (err) {
      setShareStatus('error');
      setTimeout(() => setShareStatus(null), 2000);
    }
  };

  // Action buttons config - all take DIRECT ACTION
  const actionButtons = [
    {
      id: 'sighting',
      label: 'Report Sighting',
      icon: Eye,
      onClick: onReportSighting,
      gradient: 'from-amber-500 to-orange-500',
      shadowColor: 'shadow-amber-500/30',
      description: 'Spotted them?',
    },
    {
      id: 'activity',
      label: 'Log Activity',
      icon: ClipboardList,
      onClick: onLogActivity,
      gradient: 'from-emerald-500 to-teal-500',
      shadowColor: 'shadow-emerald-500/30',
      description: 'Record your help',
    },
    {
      id: 'message',
      label: 'Message Group',
      icon: MessageCircle,
      onClick: onMessageGroup,
      gradient: 'from-blue-500 to-cyan-500',
      shadowColor: 'shadow-blue-500/30',
      description: 'Coordinate team',
    },
    {
      id: 'share',
      label: shareStatus === 'copied' ? 'Link Copied!' : shareStatus === 'shared' ? 'Shared!' : 'Share Case',
      icon: Share2,
      onClick: handleShare,
      gradient: shareStatus ? 'from-emerald-500 to-green-500' : 'from-purple-500 to-pink-500',
      shadowColor: shareStatus ? 'shadow-emerald-500/30' : 'shadow-purple-500/30',
      description: 'Spread the word',
    },
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Urgency Alert - Only show if urgent and not reunited */}
      {isUrgent && !isReunited && (
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-bold mb-1">Act Fast - Every Moment Matters</h3>
              <p className="text-red-200 text-sm">
                {mission.petName} has been missing for {timeMissing?.text}. The first 24 hours are critical.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reunited Banner */}
      {isReunited && (
        <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 rounded-xl p-4 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-emerald-400 font-bold text-lg">Reunited!</h3>
          <p className="text-emerald-200 text-sm">{mission.petName} has been found and returned home safely.</p>
        </div>
      )}

      {/* Scout Tips - Contextual guidance from Scout mascot */}
      {!isReunited && tips.length > 0 && (
        tips.length === 1 ? (
          <ScoutTipBanner
            tip={tips[0]}
            onDismiss={dismissTip}
            variant="compact"
            dismissing={dismissing === tips[0].id}
          />
        ) : (
          <ScoutTipCarousel
            tips={tips}
            currentIndex={tipIndex}
            onDismiss={dismissTip}
            onNext={handleNextTip}
            onPrev={handlePrevTip}
            dismissing={dismissing}
          />
        )
      )}

      {/* LARGE PET PHOTO - Central focus */}
      <div className="flex flex-col items-center">
        <div className="relative">
          {mission.petPhotoUrl ? (
            <img
              src={normalizePhotoUrl(mission.petPhotoUrl)}
              alt={mission.petName}
              className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl object-cover border-4 border-flash-500/50 shadow-2xl shadow-flash-500/20"
            />
          ) : (
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-7xl border-4 border-slate-600 shadow-2xl">
              {mission.petSpecies === 'DOG' ? '🐕' : mission.petSpecies === 'CAT' ? '🐈' : '🐾'}
            </div>
          )}

          {/* Status badge on photo */}
          {timeMissing && !isReunited && (
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${
              isUrgent
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                : 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/50'
            }`}>
              <Clock size={14} />
              {timeMissing.text}
            </div>
          )}
        </div>

        {/* Pet Name & Quick Info */}
        <div className="mt-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">{mission.petName}</h2>
          <p className="text-slate-400 text-sm sm:text-base">
            {mission.petBreed || mission.petSpecies}
            {mission.petColor && ` • ${mission.petColor}`}
            {mission.petSize && ` • ${mission.petSize}`}
          </p>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 flex items-center justify-center gap-1">
            <MapPin size={12} />
            {mission.lastSeenAddress?.split(',').slice(0, 2).join(',') || 'Location unknown'}
          </p>
        </div>
      </div>

      {/* 4 ACTION BUTTONS GRID - All take DIRECT action */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        {actionButtons.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled || isReunited}
              className={`relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl font-bold transition-all duration-200 ${
                action.disabled || isReunited
                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                  : `bg-gradient-to-br ${action.gradient} text-white shadow-lg ${action.shadowColor} hover:scale-105 active:scale-95`
              }`}
            >
              <Icon size={28} className="mb-2" />
              <span className="text-sm sm:text-base leading-tight text-center">{action.label}</span>
              <span className={`text-xs mt-1 ${action.disabled || isReunited ? 'text-slate-600' : 'text-white/70'}`}>
                {action.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* MAP PREVIEW - Shows last known location (latest sighting or original location) */}
      {(() => {
        // Compute last known location: use latest sighting if available, otherwise original lastSeen
        const latestSighting = sightings.length > 0
          ? sightings.reduce((latest, s) => {
              const sDate = new Date(s.sightedAt || s.createdAt);
              const lDate = new Date(latest.sightedAt || latest.createdAt);
              return sDate > lDate ? s : latest;
            })
          : null;

        const lastKnownLocation = latestSighting
          ? {
              lat: latestSighting.latitude,
              lng: latestSighting.longitude,
              address: latestSighting.address || 'Recent sighting',
              isLatestSighting: true,
            }
          : mission.lastSeenLatitude
            ? {
                lat: mission.lastSeenLatitude,
                lng: mission.lastSeenLongitude,
                address: mission.lastSeenAddress,
                isLatestSighting: false,
              }
            : null;

        const mapCenter = lastKnownLocation
          ? [lastKnownLocation.lat, lastKnownLocation.lng]
          : [41.8781, -87.6298];

        return (
          <div className="mt-6">
            <button
              onClick={onNavigateToMap}
              className="w-full group"
            >
              <div className="relative overflow-hidden rounded-xl border-2 border-slate-700/50 hover:border-flash-500/50 transition-colors">
                <div className="h-40 sm:h-48">
                  <MapView
                    center={mapCenter}
                    zoom={15}
                    lastSeen={lastKnownLocation}
                    sightings={[]} // Don't show sighting markers on preview - just the last known location
                    gpsPath={[]} // Don't show GPS path on preview - keep it clean
                    petSpecies={mission.petSpecies}
                    showControls={false}
                    showLegend={false}
                    interactive={false}
                  />
                </div>

                {/* Overlay with location info and click prompt */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/20 to-transparent flex flex-col items-center justify-end pb-3">
                  {/* Last known location label */}
                  {lastKnownLocation && (
                    <div className="mb-2 px-3 py-1 bg-slate-900/80 backdrop-blur-sm rounded-lg text-xs">
                      <span className={lastKnownLocation.isLatestSighting ? 'text-amber-400' : 'text-red-400'}>
                        {lastKnownLocation.isLatestSighting ? '👁 Latest Sighting' : '📍 Last Seen'}
                      </span>
                      <span className="text-slate-400 ml-2 truncate max-w-[200px] inline-block align-bottom">
                        {lastKnownLocation.address?.split(',').slice(0, 2).join(',') || 'Unknown'}
                      </span>
                    </div>
                  )}

                  {/* Tap prompt */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-flash-500/20 backdrop-blur-sm rounded-full border border-flash-500/50 text-flash-400 font-semibold text-sm group-hover:bg-flash-500/30 transition">
                    <MapPin size={16} />
                    Tap for full map
                    {sightings.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs">
                        {sightings.length} sighting{sightings.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </div>
        );
      })()}

      {/* PET DETAILS - Expandable on mobile */}
      <div className="mt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition"
        >
          <div className="flex items-center gap-3">
            <Camera size={20} className="text-flash-400" />
            <span className="text-white font-semibold">Pet Details</span>
          </div>
          {showDetails ? (
            <ChevronUp size={20} className="text-slate-400" />
          ) : (
            <ChevronDown size={20} className="text-slate-400" />
          )}
        </button>

        {showDetails && (
          <div className="mt-2 p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Species</span>
                <p className="text-white font-semibold capitalize">{mission.petSpecies?.toLowerCase() || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Breed</span>
                <p className="text-white font-semibold">{mission.petBreed || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Color</span>
                <p className="text-white font-semibold capitalize">{mission.petColor || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Size</span>
                <p className="text-white font-semibold capitalize">{mission.petSize || 'Unknown'}</p>
              </div>
            </div>

            {mission.petDescription && (
              <div className="pt-3 border-t border-slate-700/50">
                <span className="text-slate-500 text-xs uppercase tracking-wide">Description</span>
                <p className="text-slate-300 text-sm mt-1">{mission.petDescription}</p>
              </div>
            )}

            {/* Last Seen Info */}
            <div className="pt-3 border-t border-slate-700/50">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Last Seen</span>
              <p className="text-white">{mission.lastSeenAddress || 'Location not provided'}</p>
              {mission.lastSeenAt && (
                <p className="text-slate-400 text-sm mt-1">
                  {new Date(mission.lastSeenAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
