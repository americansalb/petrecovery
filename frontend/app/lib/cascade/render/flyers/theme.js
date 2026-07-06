/**
 * Flyer visual tokens — brand midnight + flash, LOST = red stamp semantic,
 * FOUND = emerald (found flyers are future scope but the token exists).
 */

export const FLYER_THEME = {
  lost: {
    stamp: 'LOST',
    stampBg: '#dc2626',
    accent: '#dc2626',
    bannerFrom: '#dc2626',
  },
  found: {
    stamp: 'FOUND',
    stampBg: '#059669',
    accent: '#059669',
    bannerFrom: '#059669',
  },
  midnight: '#0f172a',
  slate: '#334155',
  mute: '#64748b',
  faint: '#94a3b8',
  flash: '#facc15',
  paper: '#ffffff',
  hair: '#e2e8f0',
};

// Point dimensions (72pt = 1in). LETTER 8.5x11, TABLOID 11x17.
export const PAGE = {
  LETTER: { width: 612, height: 792 },
  TABLOID: { width: 792, height: 1224 },
};

export const SPECIES_LABEL = {
  DOG: 'DOG',
  CAT: 'CAT',
  BIRD: 'BIRD',
  RABBIT: 'RABBIT',
  OTHER: 'PET',
};

export const SPECIES_GLYPH = {
  DOG: '🐶',
  CAT: '🐱',
  BIRD: '🐦',
  RABBIT: '🐰',
  OTHER: '🐾',
};
