'use client';

/**
 * CaseCard - High-Utility Design
 *
 * Per spec: Every case card must have a primary action to "Help with this pet"
 * that navigates to that Case's Command Center at /cases/[caseNumber].
 *
 * Clean, high-contrast cards with:
 * - Clear pet photo/icon
 * - Bold urgency indicators
 * - Prominent Help CTA that navigates to Case Command Center
 * - Zero-friction interactions
 */

import { useSquadHub } from './context/SquadHubContext';
import { useRouter } from 'next/navigation';
import { Clock, Users, MapPin, Award, MessageCircle } from 'lucide-react';

// Urgency configuration - maps to CSS utility classes
const urgencyConfig = {
  HIGH: {
    cardClass: 'hub-case-high hub-urgency-high-border',
    bgClass: 'hub-urgency-high-bg',
    textClass: 'hub-urgency-high-text',
    btnClass: 'hub-btn-high',
    label: 'URGENT',
  },
  MEDIUM: {
    cardClass: 'hub-case-medium hub-urgency-medium-border',
    bgClass: 'hub-urgency-medium-bg',
    textClass: 'hub-urgency-medium-text',
    btnClass: 'hub-btn-medium',
    label: null,
  },
  LOW: {
    cardClass: 'hub-case-low hub-urgency-low-border',
    bgClass: 'hub-urgency-low-bg',
    textClass: 'hub-urgency-low-text',
    btnClass: 'hub-btn-low',
    label: null,
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
  const router = useRouter();

  const urgency = urgencyConfig[caseItem.urgency] || urgencyConfig.LOW;
  const timeAgo = getTimeAgo(caseItem.lastSeenAt);
  const emoji = speciesEmoji[caseItem.species] || '🐾';

  // Per spec: "Help with this pet" navigates to Case Command Center
  const handleHelp = (e) => {
    e.stopPropagation();
    // Mark user as helper (optimistic UI update)
    helpOnCase(caseItem.id);
    // Navigate to Case Command Center
    router.push(`/cases/${caseItem.caseNumber}`);
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
          hub-card-lift
          ${urgency.cardClass}
        `}
      >
        {/* Pet photo/icon */}
        <div
          className={`
            w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
            border-2 bg-cover bg-center
            ${urgency.bgClass} ${urgency.cardClass}
          `}
          style={caseItem.photoUrl ? { backgroundImage: `url(${caseItem.photoUrl})` } : undefined}
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
          <div className={`text-xs font-medium ${urgency.textClass}`}>
            {timeAgo}
          </div>
        </div>

        {/* Helper badge or Help button */}
        {caseItem.isUserHelper ? (
          <div className="px-2 py-1 rounded-full bg-[var(--hub-status-success)]/20 text-[var(--hub-status-success)] text-[10px] font-semibold">
            Helping
          </div>
        ) : (
          <button
            onClick={handleHelp}
            className={`px-3 py-1.5 rounded-full text-xs transition-all ${urgency.btnClass}`}
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
        hub-card-lift
        ${urgency.cardClass}
      `}
    >
      {/* Photo area */}
      <div
        className={`h-28 flex items-center justify-center relative bg-cover bg-center ${urgency.bgClass}`}
        style={caseItem.photoUrl ? { backgroundImage: `url(${caseItem.photoUrl})` } : undefined}
      >
        {!caseItem.photoUrl && (
          <span className="text-5xl">{emoji}</span>
        )}

        {/* Urgency badge - only show for URGENT or with time */}
        <div className={`absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-bold text-white ${urgency.btnClass}`}>
          {urgency.label || timeAgo}
        </div>

        {/* Reward badge */}
        {caseItem.rewardAmount && caseItem.rewardAmount > 0 && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-[var(--hub-status-success)] text-[10px] font-bold text-white flex items-center gap-1">
            <Award size={10} />
            ${caseItem.rewardAmount}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3">
        <div className="font-bold text-[var(--hub-text-primary)] truncate mb-1 text-base">
          {caseItem.petName}
        </div>

        <div className="text-xs text-[var(--hub-text-secondary)] mb-2">
          {caseItem.color && <span className="capitalize">{caseItem.color} </span>}
          <span className="capitalize">{caseItem.species?.toLowerCase()}</span>
          {caseItem.breed && <span className="text-[var(--hub-text-muted)]"> • {caseItem.breed}</span>}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--hub-text-muted)] mb-3">
          <span className={`flex items-center gap-1 font-medium ${urgency.textClass}`}>
            <Clock size={11} />
            {timeAgo}
          </span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {caseItem.helperCount} helping
          </span>
        </div>

        {caseItem.lastSeenAddress && (
          <div className="flex items-start gap-1.5 text-[11px] text-[var(--hub-text-muted)] mb-3">
            <MapPin size={11} className="flex-shrink-0 mt-0.5 text-[var(--hub-accent-primary)]" />
            <span className="truncate">{caseItem.lastSeenAddress.split(',')[0]}</span>
          </div>
        )}

        {/* Primary Action - high contrast CTA */}
        {caseItem.isUserHelper ? (
          <div className="w-full py-2.5 rounded-lg bg-[var(--hub-status-success)]/20 text-[var(--hub-status-success)] text-sm font-semibold text-center">
            You're Helping
          </div>
        ) : (
          <button
            onClick={handleHelp}
            className={`w-full py-2.5 rounded-lg text-sm transition-all hover:opacity-90 ${urgency.btnClass}`}
          >
            Help Find {caseItem.petName}
          </button>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openCaseChat(caseItem.id);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-[var(--hub-text-muted)] hover:text-[var(--hub-accent-primary)] hover:bg-[var(--hub-bg-elevated)]/50 rounded-lg transition-colors"
          >
            <MessageCircle size={12} />
            Chat
          </button>
          <a
            href={`/cases/${caseItem.caseNumber}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] bg-[var(--hub-accent-primary)]/10 text-[var(--hub-accent-primary)] hover:bg-[var(--hub-accent-primary)]/20 rounded-lg transition-colors font-medium"
          >
            View Case
          </a>
        </div>
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
