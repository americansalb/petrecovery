'use client';

/**
 * ContextualTip - Dismissible contextual hint banner
 *
 * Replaces the Tips tab with inline, contextual guidance.
 * Tips appear where they're relevant and can be dismissed.
 * Dismissal state persists in localStorage.
 *
 * Usage:
 *   <ContextualTip
 *     tipId="cat_search_close"
 *     icon={MapPin}
 *     tip="Cats hide within 3-5 houses. Search very close first!"
 *     variant="info"
 *     dismissible
 *   />
 */

import { useState, useEffect } from 'react';
import { X, Lightbulb, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// Variant styles
const VARIANTS = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20',
  },
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    iconBg: 'bg-red-500/20',
  },
};

// Default icons per variant
const DEFAULT_ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  critical: AlertTriangle,
};

// localStorage key prefix
const STORAGE_KEY = 'reunitepets_dismissed_tips';

export default function ContextualTip({
  tipId,
  icon: CustomIcon,
  tip,
  subtitle,
  variant = 'info',
  dismissible = true,
  className = '',
  onDismiss,
}) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (!tipId) {
      setIsVisible(true);
      return;
    }

    try {
      const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (dismissed[tipId]) {
        setIsDismissed(true);
      } else {
        // Delay visibility for animation
        setTimeout(() => setIsVisible(true), 100);
      }
    } catch {
      setIsVisible(true);
    }
  }, [tipId]);

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);

    // Persist to localStorage
    if (tipId) {
      try {
        const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        dismissed[tipId] = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
      } catch {
        // Ignore storage errors
      }
    }

    // Callback after animation
    setTimeout(() => {
      setIsDismissed(true);
      onDismiss?.();
    }, 200);
  };

  // Don't render if dismissed
  if (isDismissed) return null;

  const styles = VARIANTS[variant] || VARIANTS.info;
  const Icon = CustomIcon || DEFAULT_ICONS[variant] || Lightbulb;

  return (
    <div
      className={`
        ${styles.bg} ${styles.border} border rounded-xl p-3
        transition-all duration-200 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-1.5 rounded-lg ${styles.iconBg} shrink-0`}>
          <Icon size={16} className={styles.text} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${styles.text}`}>{tip}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg hover:bg-white/10 transition shrink-0"
            aria-label="Dismiss tip"
          >
            <X size={14} className="text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Reset all dismissed tips (for testing or settings)
 */
export function resetDismissedTips() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if a specific tip has been dismissed
 */
export function isTipDismissed(tipId) {
  try {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return !!dismissed[tipId];
  } catch {
    return false;
  }
}

/**
 * Pre-built contextual tips for common scenarios
 */
export const TIPS = {
  // Species-specific search patterns
  CAT_SEARCH_CLOSE: {
    tipId: 'cat_search_close',
    tip: 'Cats usually hide within 3-5 houses of home',
    subtitle: 'Search very close first - check under porches, in bushes, up trees',
    variant: 'info',
  },
  DOG_TRAVEL_DIRECTION: {
    tipId: 'dog_travel_direction',
    tip: 'Dogs often travel in one direction, not circles',
    subtitle: 'They can cover 2-5 miles per day when scared',
    variant: 'info',
  },

  // Time-based urgency
  FIRST_24_HOURS: {
    tipId: 'first_24_hours',
    tip: 'First 24 hours are critical!',
    subtitle: 'Search your home thoroughly, alert neighbors immediately',
    variant: 'critical',
  },
  EXPAND_SEARCH: {
    tipId: 'expand_search',
    tip: 'Time to expand your search radius',
    subtitle: 'Contact shelters, post flyers at intersections',
    variant: 'warning',
  },

  // Actions guidance
  SHARE_NEXTDOOR: {
    tipId: 'share_nextdoor',
    tip: 'Nextdoor reaches 80% of nearby neighbors',
    subtitle: 'Most effective for local pet searches',
    variant: 'info',
  },
  CALL_SHELTERS_DAILY: {
    tipId: 'call_shelters_daily',
    tip: 'Call shelters daily - new animals arrive constantly',
    subtitle: 'Don\'t assume they\'ll call you',
    variant: 'warning',
  },

  // When spotted
  DONT_CHASE: {
    tipId: 'dont_chase',
    tip: 'DON\'T chase a scared pet!',
    subtitle: 'Get low, stay calm, let them come to you',
    variant: 'critical',
  },
};
