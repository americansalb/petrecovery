'use client';

/**
 * Maps medication icon tokens (stored in the DB) to lucide icons.
 * Token list lives in lib/medications.js (MED_ICON_TOKENS).
 */

import { medColor } from '@/lib/medications';
import { cn } from '@/components/ui';
import {
  PillGlyph, CapsuleGlyph, SyringeGlyph, DropletsGlyph,
  HeartGlyph, LeafGlyph, SparkleGlyph,
} from '@/app/components/icons/MedGlyphs';
import { BoneIcon, PawIcon } from '@/app/components/icons/CareIcons';

export const MED_ICON_MAP = {
  pill: PillGlyph,
  capsule: CapsuleGlyph,
  syringe: SyringeGlyph,
  droplets: DropletsGlyph,
  bone: BoneIcon,
  heart: HeartGlyph,
  paw: PawIcon,
  leaf: LeafGlyph,
  sparkle: SparkleGlyph,
};

export function MedIcon({ icon, className }) {
  // Unknown/legacy tokens fall back to the pill glyph. Must be PillGlyph (the
  // imported icon); a bare `Pill` here was an undefined-reference crash for any
  // med whose icon token was not in the map.
  const Icon = MED_ICON_MAP[icon] || PillGlyph;
  return <Icon className={className} />;
}

/** Colored rounded chip with the med's icon — the visual anchor for a med. */
export function MedIconChip({ med, size = 'md', className }) {
  const colors = medColor(med.color);
  const sizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-xl',
  };
  const iconSizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };
  return (
    <span className={cn('inline-flex items-center justify-center flex-shrink-0', sizes[size], colors.iconBg, className)}>
      <MedIcon icon={med.icon} className={iconSizes[size]} />
    </span>
  );
}
