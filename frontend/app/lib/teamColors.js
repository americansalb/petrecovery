/**
 * Team Color System - 99 Unique Colors for Team Members
 *
 * Strategy:
 * 1. 12 base hues around the color wheel
 * 2. 3 saturation levels (vibrant, medium, muted)
 * 3. 3 lightness levels (light, medium, dark)
 * 4. = 108 possible combinations, we use 99
 *
 * Colors are carefully selected to be:
 * - Visually distinct from each other
 * - Visible on both satellite and street map views
 * - Accessible (not too similar to each other)
 * - Not purple (reserved for coverage overlay)
 */

// 12 base hues (avoiding purple which is reserved for coverage)
const BASE_HUES = [
  0,    // Red
  20,   // Red-Orange
  35,   // Orange
  50,   // Gold
  70,   // Yellow-Green
  120,  // Green
  160,  // Teal
  190,  // Cyan
  210,  // Sky Blue
  240,  // Blue
  320,  // Magenta
  340,  // Pink
];

// Saturation levels
const SATURATIONS = [90, 70, 50]; // Vibrant, Medium, Muted

// Lightness levels
const LIGHTNESSES = [65, 50, 35]; // Light, Medium, Dark

/**
 * Generate all 99 team colors
 * Returns array of { hex, hsl, name, pattern }
 */
function generateTeamColors() {
  const colors = [];
  let index = 0;

  // Generate solid colors first (12 hues × 3 sat × 3 light = 108, use 99)
  for (const hue of BASE_HUES) {
    for (const sat of SATURATIONS) {
      for (const light of LIGHTNESSES) {
        if (index >= 99) break;

        const hex = hslToHex(hue, sat, light);
        const name = getColorName(hue, sat, light);

        colors.push({
          index,
          hex,
          hsl: `hsl(${hue}, ${sat}%, ${light}%)`,
          name,
          // For future: pattern support
          pattern: null,
        });

        index++;
      }
      if (index >= 99) break;
    }
    if (index >= 99) break;
  }

  return colors;
}

/**
 * Convert HSL to Hex
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Get human-readable color name
 */
function getColorName(hue, sat, light) {
  const hueNames = {
    0: 'Red',
    20: 'Vermillion',
    35: 'Orange',
    50: 'Gold',
    70: 'Lime',
    120: 'Green',
    160: 'Teal',
    190: 'Cyan',
    210: 'Sky',
    240: 'Blue',
    320: 'Magenta',
    340: 'Pink',
  };

  const satNames = {
    90: '',
    70: 'Soft',
    50: 'Muted',
  };

  const lightNames = {
    65: 'Light',
    50: '',
    35: 'Dark',
  };

  const parts = [lightNames[light], satNames[sat], hueNames[hue]].filter(Boolean);
  return parts.join(' ') || hueNames[hue];
}

// Pre-generate all colors
const TEAM_COLORS = generateTeamColors();

/**
 * Get color for a team member by their index (0-98)
 * @param {number} index - Team member index
 * @returns {object} Color object with hex, hsl, name
 */
export function getTeamColor(index) {
  const safeIndex = Math.abs(index) % 99;
  return TEAM_COLORS[safeIndex];
}

/**
 * Get color for a team member by their user ID
 * Uses a hash to consistently assign the same color to the same user
 * @param {string} oderId - User ID
 * @returns {object} Color object with hex, hsl, name
 */
export function getTeamColorByUserId(userId) {
  if (!userId) return TEAM_COLORS[0];

  // Simple hash function to convert userId to number
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return getTeamColor(Math.abs(hash));
}

/**
 * Get all team colors
 * @returns {array} All 99 team colors
 */
export function getAllTeamColors() {
  return TEAM_COLORS;
}

/**
 * Coverage overlay opacity levels based on search count
 * @param {number} searchCount - Number of people who searched this area
 * @returns {number} Opacity value (0-1)
 */
export function getCoverageOpacity(searchCount) {
  if (searchCount <= 0) return 0;
  if (searchCount === 1) return 0.15;
  if (searchCount === 2) return 0.25;
  if (searchCount === 3) return 0.35;
  if (searchCount === 4) return 0.45;
  if (searchCount === 5) return 0.55;
  return 0.65; // 6+ people = max opacity
}

/**
 * Calculate decayed opacity based on time elapsed
 * Reduces by 25% of current value every 12 hours
 * Minimum opacity is 7.5%
 *
 * @param {number} baseOpacity - Starting opacity (from getCoverageOpacity)
 * @param {number} hoursElapsed - Hours since the search was conducted
 * @returns {number} Decayed opacity value
 */
export function getDecayedOpacity(baseOpacity, hoursElapsed) {
  // Calculate number of 12-hour periods
  const periods = Math.floor(hoursElapsed / 12);

  // Apply 25% decay per period (multiply by 0.75 each period)
  let opacity = baseOpacity;
  for (let i = 0; i < periods; i++) {
    opacity *= 0.75;
  }

  // Minimum opacity is 7.5%
  return Math.max(opacity, 0.075);
}

/**
 * Vision radius for search coverage (in meters)
 * Based on average city street width (~45 feet = 14 meters)
 */
export const VISION_RADIUS_METERS = 14;

/**
 * Purple color for coverage overlay
 */
export const COVERAGE_PURPLE = {
  hex: '#a855f7',
  rgb: 'rgb(168, 85, 247)',
  rgba: (opacity) => `rgba(168, 85, 247, ${opacity})`,
};

export default {
  getTeamColor,
  getTeamColorByUserId,
  getAllTeamColors,
  getCoverageOpacity,
  getDecayedOpacity,
  VISION_RADIUS_METERS,
  COVERAGE_PURPLE,
};
