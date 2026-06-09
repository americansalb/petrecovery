'use client';

/**
 * Maps medication icon tokens (stored in the DB) to lucide icons.
 * Token list lives in lib/medications.js (MED_ICON_TOKENS).
 */

import { Pill, Tablets, Syringe, Droplets, Bone, Heart, PawPrint, Leaf, Sparkles } from 'lucide-react';
import { medColor } from '@/lib/medications';
import { cn } from '@/components/ui';

export const MED_ICON_MAP = {
  pill: Pill,
  capsule: Tablets,
  syringe: Syringe,
  droplets: Droplets,
  bone: Bone,
  heart: Heart,
  paw: PawPrint,
  leaf: Leaf,
  sparkle: Sparkles,
};

export function MedIcon({ icon, className }) {
  const Icon = MED_ICON_MAP[icon] || Pill;
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
