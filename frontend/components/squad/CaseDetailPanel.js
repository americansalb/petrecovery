'use client';

/**
 * CaseDetailPanel - High-Utility Design
 *
 * Clean, focused case details with:
 * - Clear pet identification
 * - High-contrast urgency indicators
 * - Prominent action buttons
 * - Zero-friction interactions
 */

import { useSquadHub } from './context/SquadHubContext';
import {
  X,
  Clock,
  MapPin,
  Users,
  Award,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  Heart,
} from 'lucide-react';

// Urgency configuration - maps to CSS utility classes
const urgencyConfig = {
  HIGH: {
    bgClass: 'hub-urgency-high-bg',
    textClass: 'hub-urgency-high-text',
    btnClass: 'hub-btn-high',
    label: 'URGENT',
  },
  MEDIUM: {
    bgClass: 'hub-urgency-medium-bg',
    textClass: 'hub-urgency-medium-text',
    btnClass: 'hub-btn-medium',
    label: 'MODERATE',
  },
  LOW: {
    bgClass: 'hub-urgency-low-bg',
    textClass: 'hub-urgency-low-text',
    btnClass: 'hub-btn-low',
    label: 'ROUTINE',
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

export default function CaseDetailPanel() {
  const { selectedCase, deselectCase, helpOnCase, openCaseChat, divisions } = useSquadHub();

  if (!selectedCase) return null;

  const urgency = urgencyConfig[selectedCase.urgency] || urgencyConfig.LOW;
  const emoji = speciesEmoji[selectedCase.species] || '🐾';
  const timeAgo = getTimeAgo(selectedCase.lastSeenAt);
  const division = divisions?.find(d => d.id === selectedCase.divisionId);

  const handleHelp = () => {
    helpOnCase(selectedCase.id);
  };

  const handleOpenChat = () => {
    openCaseChat(selectedCase.id);
  };

  const isReunited = selectedCase.status === 'REUNITED';

  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Header with close button */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--hub-border)]">
        <h2 className="text-sm font-bold text-[var(--hub-text-primary)]">
          Case Details
        </h2>
        <button
          onClick={deselectCase}
          className="p-1.5 rounded-lg text-[var(--hub-text-muted)] hover:text-[var(--hub-text-primary)] hover:bg-[var(--hub-bg-card)] transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Pet photo/icon area */}
        <div
          className={`h-48 flex items-center justify-center relative bg-cover bg-center ${urgency.bgClass}`}
          style={selectedCase.photoUrl ? { backgroundImage: `url(${selectedCase.photoUrl})` } : undefined}
        >
          {!selectedCase.photoUrl && (
            <span className="text-6xl">{emoji}</span>
          )}

          {/* Urgency badge */}
          <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold text-white ${urgency.btnClass}`}>
            {urgency.label}
          </div>

          {/* Reward badge */}
          {selectedCase.rewardAmount > 0 && (
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-[var(--hub-status-success)] text-xs font-bold text-white flex items-center gap-1.5">
              <Award size={12} />
              ${selectedCase.rewardAmount} Reward
            </div>
          )}

          {/* Reunited badge */}
          {isReunited && (
            <div className="absolute bottom-3 left-3 right-3 py-2 rounded-lg bg-[var(--hub-status-success)] text-center text-white font-bold text-sm flex items-center justify-center gap-2">
              <Heart size={16} />
              Reunited!
            </div>
          )}
        </div>

        {/* Pet info */}
        <div className="p-4">
          {/* Name and case number */}
          <div className="mb-4">
            <h3 className="text-xl font-bold text-[var(--hub-text-primary)] mb-1">
              {selectedCase.petName}
            </h3>
            <div className="text-xs text-[var(--hub-text-muted)] font-medium">
              Case #{selectedCase.caseNumber || selectedCase.id.slice(0, 8).toUpperCase()}
            </div>
          </div>

          {/* Species/breed/color */}
          <div className="mb-4 p-3 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]">
            <div className="text-sm text-[var(--hub-text-secondary)] font-medium">
              {selectedCase.color && <span className="capitalize">{selectedCase.color} </span>}
              <span className="capitalize">
                {selectedCase.species?.toLowerCase() || 'Pet'}
              </span>
              {selectedCase.breed && (
                <span className="text-[var(--hub-text-muted)]"> • {selectedCase.breed}</span>
              )}
            </div>
          </div>

          {/* Time missing - high visibility */}
          <div className={`flex items-center gap-3 mb-3 p-3 rounded-lg ${urgency.bgClass}`}>
            <Clock size={20} className={urgency.textClass} />
            <div>
              <div className={`text-sm font-bold ${urgency.textClass}`}>
                Missing {timeAgo}
              </div>
              {selectedCase.lastSeenAt && (
                <div className="text-xs text-[var(--hub-text-muted)]">
                  Last seen: {new Date(selectedCase.lastSeenAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {selectedCase.lastSeenAddress && (
            <div className="flex items-start gap-3 mb-3 p-3 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]">
              <MapPin size={20} className="text-[var(--hub-accent-primary)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-[var(--hub-text-primary)] font-medium">
                  {selectedCase.lastSeenAddress}
                </div>
                {division && (
                  <div className="text-xs text-[var(--hub-text-muted)] mt-1">
                    Division: {division.name}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Helper count */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]">
            <Users size={20} className="text-[var(--hub-text-muted)]" />
            <div>
              <div className="text-sm text-[var(--hub-text-primary)] font-medium">
                {selectedCase.helperCount || 0} {selectedCase.helperCount === 1 ? 'helper' : 'helpers'} active
              </div>
              {selectedCase.isUserHelper && (
                <div className="text-xs text-[var(--hub-status-success)] font-semibold">
                  You're helping on this case
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons - fixed at bottom */}
      <div className="p-4 border-t border-[var(--hub-border)] bg-[var(--hub-bg-panel)] space-y-2">
        {!isReunited && (
          <>
            {selectedCase.isUserHelper ? (
              <div className="w-full py-3 rounded-xl bg-[var(--hub-status-success)]/20 text-[var(--hub-status-success)] text-sm font-bold text-center">
                You're Helping
              </div>
            ) : (
              <button
                onClick={handleHelp}
                className={`w-full py-3 rounded-xl text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2 ${urgency.btnClass}`}
              >
                <AlertCircle size={16} />
                Help Find {selectedCase.petName}
              </button>
            )}

            <button
              onClick={handleOpenChat}
              className="w-full py-3 rounded-xl bg-[var(--hub-bg-card)] border border-[var(--hub-border)] text-[var(--hub-text-primary)] text-sm font-semibold transition-all hover:border-[var(--hub-accent-primary)] flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} />
              Open Case Chat
            </button>
          </>
        )}

        <a
          href={`/cases/${selectedCase.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-xl bg-[var(--hub-bg-card)] border border-[var(--hub-border)] text-[var(--hub-text-secondary)] text-sm font-medium transition-all hover:border-[var(--hub-border-glow)] hover:text-[var(--hub-text-primary)] flex items-center justify-center gap-2"
        >
          <ExternalLink size={14} />
          View Full Case Page
        </a>
      </div>
    </div>
  );
}

// Helper: Calculate time ago string
function getTimeAgo(isoString) {
  if (!isoString) return 'Unknown time';

  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes`;
  if (diffHours < 24) return `${diffHours} hours`;
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
  return `${Math.floor(diffDays / 30)} months`;
}
