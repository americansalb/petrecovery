'use client';

/**
 * CaseHeader - Compact header showing pet info, urgency, and key stats
 *
 * Used at the top of Mission Control when viewing a specific case
 * Always visible, provides context for current case
 */

import { Clock, MapPin, DollarSign, Users, ChevronLeft, MoreHorizontal } from 'lucide-react';
import { normalizePhotoUrl } from '@/app/lib/utils';

export default function CaseHeader({
  missionData,
  onBack,
  onActionsClick,
  showBackButton = true,
  className = '',
}) {
  if (!missionData) return null;

  const {
    petName,
    petSpecies,
    petBreed,
    petPhotoUrl,
    missionNumber,
    lastSeenAt,
    lastSeenAddress,
    rewardAmount,
    status,
  } = missionData;

  // Calculate time missing
  const getTimeMissing = () => {
    if (!lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return 'Less than 1 hour';
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours}h`;
  };

  const timeMissing = getTimeMissing();
  const hoursNum = lastSeenAt ? Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 3600000) : 999;
  const isUrgent = hoursNum < 4;
  const isActive = hoursNum < 24;
  const isReunited = status === 'REUNITED' || status === 'RESOLVED';

  // Species emoji
  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
  }[petSpecies] || '🐾';

  // Urgency styling
  const urgencyStyles = isReunited
    ? 'border-green-500/30 bg-green-500/5'
    : isUrgent
    ? 'border-red-500/30 bg-red-500/5'
    : isActive
    ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-slate-700/50 bg-slate-800/30';

  return (
    <div className={`${urgencyStyles} border-b p-4 ${className}`}>
      <div className="flex items-start gap-4">
        {/* Back button */}
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="flex-shrink-0 p-2 -ml-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Pet photo or emoji */}
        <div className="flex-shrink-0">
          {petPhotoUrl ? (
            <img
              src={normalizePhotoUrl(petPhotoUrl)}
              alt={petName}
              className="w-14 h-14 rounded-xl object-cover border-2 border-slate-700/50"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-800 border-2 border-slate-700/50 flex items-center justify-center text-2xl">
              {speciesEmoji}
            </div>
          )}
        </div>

        {/* Pet info */}
        <div className="flex-1 min-w-0">
          {/* Name and breed */}
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white truncate">{petName}</h1>
            {petBreed && (
              <>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 text-sm truncate">{petBreed}</span>
              </>
            )}
          </div>

          {/* Mission number and time */}
          <div className="flex items-center gap-3 text-sm mb-2">
            <span className="text-slate-500">#{missionNumber}</span>
            {timeMissing && (
              <span className={`flex items-center gap-1 font-semibold ${
                isReunited ? 'text-green-400' :
                isUrgent ? 'text-red-400' :
                isActive ? 'text-amber-400' :
                'text-slate-400'
              }`}>
                <Clock size={14} />
                {isReunited ? 'Reunited!' : `${timeMissing} missing`}
              </span>
            )}
          </div>

          {/* Location and stats */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {lastSeenAddress && (
              <span className="flex items-center gap-1 truncate">
                <MapPin size={12} className="flex-shrink-0" />
                <span className="truncate">{lastSeenAddress}</span>
              </span>
            )}
            {rewardAmount > 0 && (
              <span className="flex items-center gap-1 text-flash-400 font-semibold flex-shrink-0">
                <DollarSign size={12} />
                ${rewardAmount}
              </span>
            )}
          </div>
        </div>

        {/* Actions button */}
        {onActionsClick && (
          <button
            onClick={onActionsClick}
            className="flex-shrink-0 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <MoreHorizontal size={20} />
          </button>
        )}
      </div>

      {/* Urgency banner for critical cases */}
      {isUrgent && !isReunited && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">⏰</span>
          </div>
          <div>
            <p className="text-red-400 font-semibold text-sm">Act Fast - First Hours Are Critical</p>
            <p className="text-red-300/70 text-xs">Pets are most likely to be found nearby in the first 4 hours</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CaseHeaderMini - Even more compact version for mobile
 */
export function CaseHeaderMini({ missionData, onBack, className = '' }) {
  if (!missionData) return null;

  const { petName, petSpecies, lastSeenAt, status } = missionData;

  const hoursNum = lastSeenAt ? Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 3600000) : 999;
  const isUrgent = hoursNum < 4;
  const isReunited = status === 'REUNITED' || status === 'RESOLVED';

  const speciesEmoji = { DOG: '🐕', CAT: '🐈', BIRD: '🐦', RABBIT: '🐰' }[petSpecies] || '🐾';

  return (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
      {onBack && (
        <button onClick={onBack} className="p-1 text-slate-400">
          <ChevronLeft size={20} />
        </button>
      )}
      <span className="text-xl">{speciesEmoji}</span>
      <span className="font-bold text-white">{petName}</span>
      {isUrgent && !isReunited && (
        <span className="px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 rounded-full animate-pulse">
          URGENT
        </span>
      )}
      {isReunited && (
        <span className="px-2 py-0.5 text-xs font-bold bg-green-500/20 text-green-400 rounded-full">
          REUNITED
        </span>
      )}
    </div>
  );
}
