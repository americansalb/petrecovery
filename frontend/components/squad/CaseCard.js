'use client';

/**
 * CaseCard - Individual case card with bioluminescent styling
 *
 * Shows:
 * - Pet photo/icon
 * - Pet name and species
 * - Time missing (urgency color coded)
 * - Helper count
 * - "Help" CTA button
 *
 * Glows based on urgency level.
 */

import { useSquadHub } from './context/SquadHubContext';
import { Clock, Users, MapPin, Award, MessageCircle } from 'lucide-react';

// Urgency color mapping
const urgencyColors = {
  HIGH: {
    border: 'var(--hub-status-high)',
    text: 'var(--hub-status-high)',
    bg: 'rgba(239, 68, 68, 0.1)',
    class: 'hub-case-high',
  },
  MEDIUM: {
    border: 'var(--hub-status-medium)',
    text: 'var(--hub-status-medium)',
    bg: 'rgba(245, 158, 11, 0.1)',
    class: 'hub-case-medium',
  },
  LOW: {
    border: 'var(--hub-status-low)',
    text: 'var(--hub-status-low)',
    bg: 'rgba(99, 102, 241, 0.1)',
    class: 'hub-case-low',
  },
};

// Species emoji mapping
const speciesEmoji = {
  DOG: '🐕',
  CAT: '🐈',
  BIRD: '🐦',
  RABBIT: '🐰',
  OTHER: '🐾',
};

export default function CaseCard({ caseItem, compact = false }) {
  const { helpOnCase, selectCase, openCaseChat } = useSquadHub();

  const urgency = urgencyColors[caseItem.urgency] || urgencyColors.LOW;
  const timeAgo = getTimeAgo(caseItem.lastSeenAt);
  const emoji = speciesEmoji[caseItem.species] || '🐾';

  const handleHelp = (e) => {
    e.stopPropagation();
    helpOnCase(caseItem.id);
  };

  const handleCardClick = () => {
    selectCase(caseItem.id);
  };

  if (compact) {
    return (
      <button
        onClick={handleCardClick}
        className={`
          flex items-center gap-3 p-3 rounded-xl
          bg-[var(--hub-bg-card)] border
          transition-all duration-200 text-left
          hover:border-[var(--hub-border-glow)]
          min-w-[200px] flex-shrink-0
          ${urgency.class}
        `}
        style={{ borderColor: urgency.border }}
      >
        {/* Pet photo/icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border-2"
          style={{
            borderColor: urgency.border,
            backgroundColor: urgency.bg,
            backgroundImage: caseItem.photoUrl ? `url(${caseItem.photoUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!caseItem.photoUrl && (
            <span className="text-xl">{emoji}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--hub-text-primary)] truncate">
            {caseItem.petName}
          </div>
          <div className="text-xs font-medium" style={{ color: urgency.text }}>
            {timeAgo}
          </div>
        </div>

        {/* Helper badge or Help button */}
        {caseItem.isUserHelper ? (
          <div className="px-2 py-1 rounded-full bg-[var(--hub-status-success)]/20 text-[var(--hub-status-success)] text-[10px] font-medium">
            Helping
          </div>
        ) : (
          <button
            onClick={handleHelp}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all"
            style={{ backgroundColor: urgency.border }}
          >
            Help
          </button>
        )}
      </button>
    );
  }

  // Full card
  return (
    <div
      onClick={handleCardClick}
      className={`
        rounded-xl overflow-hidden cursor-pointer
        bg-[var(--hub-bg-card)] border
        transition-all duration-200
        hover:border-[var(--hub-border-glow)]
        ${urgency.class}
      `}
      style={{ borderColor: urgency.border }}
    >
      {/* Photo area */}
      <div
        className="h-24 flex items-center justify-center relative"
        style={{
          backgroundColor: urgency.bg,
          backgroundImage: caseItem.photoUrl ? `url(${caseItem.photoUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!caseItem.photoUrl && (
          <span className="text-4xl">{emoji}</span>
        )}

        {/* Urgency badge */}
        <div
          className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold text-white"
          style={{ backgroundColor: urgency.border }}
        >
          {caseItem.urgency === 'HIGH' ? 'URGENT' : timeAgo}
        </div>

        {/* Reward badge */}
        {caseItem.rewardAmount && caseItem.rewardAmount > 0 && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-[var(--hub-status-success)] text-[10px] font-bold text-white flex items-center gap-1">
            <Award size={10} />
            ${caseItem.rewardAmount}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3">
        <div className="font-semibold text-[var(--hub-text-primary)] truncate mb-1">
          {caseItem.petName}
        </div>

        <div className="text-xs text-[var(--hub-text-muted)] mb-2">
          {caseItem.color && `${caseItem.color} `}
          {caseItem.species?.charAt(0) + caseItem.species?.slice(1).toLowerCase()}
          {caseItem.breed && ` • ${caseItem.breed}`}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-[var(--hub-text-muted)] mb-3">
          <span className="flex items-center gap-1">
            <Clock size={10} style={{ color: urgency.text }} />
            <span style={{ color: urgency.text }}>{timeAgo}</span>
          </span>
          <span className="flex items-center gap-1">
            <Users size={10} />
            {caseItem.helperCount} helping
          </span>
        </div>

        {caseItem.lastSeenAddress && (
          <div className="flex items-start gap-1 text-[10px] text-[var(--hub-text-muted)] mb-3 truncate">
            <MapPin size={10} className="flex-shrink-0 mt-0.5" />
            <span className="truncate">{caseItem.lastSeenAddress.split(',')[0]}</span>
          </div>
        )}

        {/* Action */}
        {caseItem.isUserHelper ? (
          <div className="w-full py-2 rounded-lg bg-[var(--hub-status-success)]/20 text-[var(--hub-status-success)] text-xs font-semibold text-center">
            You're Helping
          </div>
        ) : (
          <button
            onClick={handleHelp}
            className="w-full py-2 rounded-lg text-white text-xs font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: urgency.border }}
          >
            Help with {caseItem.petName}
          </button>
        )}

        {/* Open case chat link */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openCaseChat(caseItem.id);
          }}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-[var(--hub-text-muted)] hover:text-[var(--hub-accent-primary)] transition-colors"
        >
          <MessageCircle size={10} />
          Open chat for this case
        </button>
      </div>
    </div>
  );
}

// Helper: Calculate time ago string
function getTimeAgo(isoString) {
  if (!isoString) return 'Unknown';

  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
