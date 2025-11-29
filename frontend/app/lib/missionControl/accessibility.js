/**
 * Accessibility Helpers
 *
 * Design constraints:
 * - Colorblind-safe (no red/green only distinctions)
 * - Screen reader support
 * - High contrast for outdoor/sunlight use
 * - Large touch targets for one-thumb operation
 */

// Colorblind-safe palette
// Uses blue/orange/purple as primary distinctions
// All colors have sufficient contrast on dark backgrounds
export const ACCESSIBLE_COLORS = {
  // Status colors - use shape/icon backup, not color alone
  urgent: {
    color: '#FF5252',      // Red
    altColor: '#FF8A80',   // Lighter for dark mode
    pattern: 'pulse',      // Animation backup
    icon: '⚠️',            // Icon backup
    ariaLabel: 'Urgent',
  },

  active: {
    color: '#2196F3',      // Blue
    altColor: '#64B5F6',
    pattern: 'solid',
    icon: '●',
    ariaLabel: 'Active',
  },

  warning: {
    color: '#FF9800',      // Orange
    altColor: '#FFB74D',
    pattern: 'stripes',
    icon: '⚡',
    ariaLabel: 'Attention needed',
  },

  success: {
    color: '#4CAF50',      // Green
    altColor: '#81C784',
    pattern: 'checkmark',
    icon: '✓',
    ariaLabel: 'Complete',
  },

  neutral: {
    color: '#9E9E9E',      // Gray
    altColor: '#BDBDBD',
    pattern: 'dotted',
    icon: '○',
    ariaLabel: 'Inactive',
  },
};

// Zone status - uses patterns + colors for redundancy
export const ZONE_VISUALS = {
  UNSEARCHED: {
    fill: 'rgba(55, 71, 79, 0.6)',   // Dark gray
    stroke: '#546E7A',
    pattern: 'none',
    label: 'Not searched',
    icon: '⬜',
  },

  IN_PROGRESS: {
    fill: 'rgba(33, 150, 243, 0.4)', // Blue
    stroke: '#2196F3',
    pattern: 'diagonal-lines',
    label: 'Being searched',
    icon: '🔄',
  },

  SEARCHED: {
    fill: 'rgba(21, 101, 192, 0.5)', // Darker blue
    stroke: '#1565C0',
    pattern: 'solid',
    label: 'Searched',
    icon: '✓',
  },

  STALE: {
    fill: 'rgba(255, 143, 0, 0.4)',  // Amber/orange
    stroke: '#FF8F00',
    pattern: 'dots',
    label: 'Needs re-check',
    icon: '🔄',
  },

  HIGH_PROBABILITY: {
    fill: 'rgba(123, 31, 162, 0.4)', // Purple
    stroke: '#7B1FA2',
    pattern: 'crosshatch',
    label: 'High probability',
    icon: '⭐',
  },

  SIGHTING: {
    fill: 'rgba(211, 47, 47, 0.5)',  // Red
    stroke: '#D32F2F',
    pattern: 'pulse',
    label: 'Recent sighting',
    icon: '👁️',
  },
};

// Touch target sizes (minimum 44px for accessibility)
export const TOUCH_TARGETS = {
  small: 44,     // Minimum accessible size
  medium: 56,    // Comfortable one-thumb
  large: 72,     // Primary action buttons
  xlarge: 88,    // Critical actions (sighting button)
};

// Typography scale for outdoor readability
export const TYPOGRAPHY = {
  // High contrast, large text for outdoor use
  heading: {
    fontSize: '24px',
    fontWeight: 700,
    lineHeight: 1.2,
    color: '#FFFFFF',
  },

  subheading: {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.3,
    color: '#FFFFFF',
  },

  body: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
    color: '#E0E0E0',
  },

  caption: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.4,
    color: '#BDBDBD',
  },

  // Extra large for critical info
  display: {
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: 1.1,
    color: '#FFFFFF',
  },
};

// Screen reader announcements
export const ARIA_ANNOUNCEMENTS = {
  missionActivated: (petName) =>
    `Live search activated for ${petName}. You are now part of the search team.`,

  sightingReported: (direction, distance) =>
    `Sighting reported ${distance} ${direction}. Hold your position.`,

  containmentMode: () =>
    `Containment mode activated. Stop moving. Wait for instructions.`,

  perimeterAssigned: (position) =>
    `You have been assigned to the ${position} perimeter position. Move quietly to your position.`,

  zoneAssigned: (gridRef, direction, distance) =>
    `Zone ${gridRef} assigned. Head ${direction}, ${distance} away.`,

  missionResolved: (petName) =>
    `Celebration! ${petName} has been found! The mission is complete.`,

  standDown: () =>
    `Stand down. The search has been paused or concluded.`,
};

// Generate accessible button props
export function getAccessibleButtonProps(action, options = {}) {
  const { label, description, urgent } = options;

  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    'aria-describedby': description ? `${action}-desc` : undefined,
    'aria-pressed': options.pressed,
    'aria-live': urgent ? 'assertive' : 'polite',
    style: {
      minWidth: TOUCH_TARGETS.large,
      minHeight: TOUCH_TARGETS.large,
    },
  };
}

// Generate accessible map marker
export function getAccessibleMarkerProps(type, data) {
  const visuals = ZONE_VISUALS[type] || ZONE_VISUALS.UNSEARCHED;

  return {
    role: 'img',
    'aria-label': `${visuals.label}${data?.gridRef ? ` - Zone ${data.gridRef}` : ''}`,
    tabIndex: 0,
    style: {
      backgroundColor: visuals.fill,
      borderColor: visuals.stroke,
    },
  };
}

// Haptic feedback patterns (for mobile)
export const HAPTIC_PATTERNS = {
  tap: { pattern: [10], intensity: 0.5 },
  success: { pattern: [10, 50, 10], intensity: 0.8 },
  warning: { pattern: [50, 50, 50], intensity: 1.0 },
  urgent: { pattern: [100, 50, 100, 50, 100], intensity: 1.0 },
  sighting: { pattern: [200, 100, 200], intensity: 1.0 },
};

// Trigger haptic feedback
export function triggerHaptic(type) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const pattern = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.tap;
    navigator.vibrate(pattern.pattern);
  }
}

// Screen reader announcement
export function announce(message, priority = 'polite') {
  if (typeof document !== 'undefined') {
    const announcer = document.getElementById('aria-announcer') ||
      createAriaAnnouncer();

    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

function createAriaAnnouncer() {
  const announcer = document.createElement('div');
  announcer.id = 'aria-announcer';
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;
  document.body.appendChild(announcer);
  return announcer;
}

// High contrast mode detection
export function isHighContrastMode() {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }
  return false;
}

// Reduced motion preference
export function prefersReducedMotion() {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

export default {
  ACCESSIBLE_COLORS,
  ZONE_VISUALS,
  TOUCH_TARGETS,
  TYPOGRAPHY,
  ARIA_ANNOUNCEMENTS,
  HAPTIC_PATTERNS,
  getAccessibleButtonProps,
  getAccessibleMarkerProps,
  triggerHaptic,
  announce,
  isHighContrastMode,
  prefersReducedMotion,
};
