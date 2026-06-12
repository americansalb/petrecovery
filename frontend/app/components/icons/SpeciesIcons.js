'use client';

/**
 * Species icons - the family portraits
 *
 * Friendly line silhouettes for the four named species, replacing both
 * the platform emoji fallbacks (🐕 🐈 🦜 🐇, which render differently
 * everywhere) and the stock lucide chips. OTHER and unknowns get the
 * paw. Same dialect as CareIcons: 24px grid, 1.8px rounded strokes,
 * soft currentColor fills.
 */

import Svg from './Svg';
import { PawIcon } from './CareIcons';

/** Floppy ears, honest eyes, tongue out. */
export function DogIcon(props) {
  return (
    <Svg {...props}>
      <ellipse cx="5.5" cy="9.8" rx="1.9" ry="3.8" transform="rotate(16 5.5 9.8)" fill="currentColor" opacity=".15" stroke="none" />
      <ellipse cx="18.5" cy="9.8" rx="1.9" ry="3.8" transform="rotate(-16 18.5 9.8)" fill="currentColor" opacity=".15" stroke="none" />
      <ellipse cx="5.5" cy="9.8" rx="1.9" ry="3.8" transform="rotate(16 5.5 9.8)" />
      <ellipse cx="18.5" cy="9.8" rx="1.9" ry="3.8" transform="rotate(-16 18.5 9.8)" />
      <circle cx="12" cy="11.8" r="5.4" />
      <circle cx="10.1" cy="10.6" r=".95" fill="currentColor" stroke="none" />
      <circle cx="13.9" cy="10.6" r=".95" fill="currentColor" stroke="none" />
      <path d="M10.9 13.2h2.2l-1.1 1.4Z" fill="currentColor" stroke="none" />
      <path d="M11.1 15.4h1.8v1.2a.9.9 0 0 1-1.8 0Z" fill="currentColor" opacity=".35" stroke="none" />
    </Svg>
  );
}

/** Pointed ears and whiskers. */
export function CatIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6.4 9.2 5.9 4.4l4 2.5" fill="currentColor" opacity=".15" />
      <path d="M17.6 9.2l.5-4.8-4 2.5" fill="currentColor" opacity=".15" />
      <circle cx="12" cy="12.6" r="5.8" />
      <circle cx="9.9" cy="11.6" r=".95" fill="currentColor" stroke="none" />
      <circle cx="14.1" cy="11.6" r=".95" fill="currentColor" stroke="none" />
      <path d="M11 14h2l-1 1.2Z" fill="currentColor" stroke="none" />
      <path d="M2.8 12.4h3M2.9 14.8l2.9-.7M21.2 12.4h-3M21.1 14.8l-2.9-.7" />
    </Svg>
  );
}

/** Round body, bright eye, ready to sing. */
export function BirdIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="10.8" cy="11.6" r="5.8" />
      <path d="M16.4 9.6l4 1.4-3.8 1.9" fill="currentColor" opacity=".15" />
      <circle cx="12.6" cy="9.6" r=".9" fill="currentColor" stroke="none" />
      <path d="M7.4 11.4a3.6 3.6 0 0 1 5 2.8" fill="currentColor" opacity=".15" />
      <path d="M9.4 17.2v2.4M12.2 17.2v2.4" />
    </Svg>
  );
}

/** Tall ears, soft face. */
export function RabbitIcon(props) {
  return (
    <Svg {...props}>
      <ellipse cx="9.3" cy="6.4" rx="1.7" ry="4" transform="rotate(-10 9.3 6.4)" fill="currentColor" opacity=".15" stroke="none" />
      <ellipse cx="14.7" cy="6.4" rx="1.7" ry="4" transform="rotate(10 14.7 6.4)" fill="currentColor" opacity=".15" stroke="none" />
      <ellipse cx="9.3" cy="6.4" rx="1.7" ry="4" transform="rotate(-10 9.3 6.4)" />
      <ellipse cx="14.7" cy="6.4" rx="1.7" ry="4" transform="rotate(10 14.7 6.4)" />
      <circle cx="12" cy="14.4" r="5" />
      <circle cx="10.2" cy="13.4" r=".9" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="13.4" r=".9" fill="currentColor" stroke="none" />
      <path d="M11.1 15.6h1.8l-.9 1.1Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export const SPECIES_ICON_MAP = {
  DOG: DogIcon,
  CAT: CatIcon,
  BIRD: BirdIcon,
  RABBIT: RabbitIcon,
  OTHER: PawIcon,
};

/** Drop-in replacement for the SPECIES_EMOJI fallbacks. */
export function SpeciesIcon({ species, ...props }) {
  const Icon = SPECIES_ICON_MAP[species] || PawIcon;
  return <Icon {...props} />;
}

export { PawIcon };
