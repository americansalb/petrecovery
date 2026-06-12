'use client';

/**
 * The care icon set - hand-built, in-theme, tofu-proof
 *
 * Care chips used to render emoji (🦮 🪮 🦴...), which draw differently
 * on every platform and turn into empty boxes for newer glyphs (the
 * comb emoji is Unicode 15: half the devices out there show □).
 * These are 24px two-tone SVGs in the product's own language: rounded
 * 1.8px strokes with soft same-color fills, tinted entirely by
 * currentColor so the surrounding chip picks the palette.
 *
 * CareIconChip mirrors MedIconChip (app/components/medications/MedIcon)
 * so the Care and Meds rooms speak one visual dialect.
 */

import { CARE_ACTIVITIES, medColor } from '@/lib/medications';
import { cn } from '@/components/ui';

function Svg({ size = 24, className, children, label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {children}
    </svg>
  );
}

/** Leash looping down to a paw: the walk. */
export function WalkIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="18.2" cy="4.6" r="1.7" />
      <path d="M17 5.9C14.8 9 12.2 10.4 9.6 12.1" />
      <circle cx="5.2" cy="14.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.2" cy="13.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="15" r="1.1" fill="currentColor" stroke="none" />
      <path d="M8.3 16.6c-1.9 0-3.6 1.5-3.6 3 0 1.2 1 2 2 1.7.7-.2 1.1-.3 1.6-.3s.9.1 1.6.3c1 .3 2-.5 2-1.7 0-1.5-1.7-3-3.6-3Z" fill="currentColor" opacity=".18" />
      <path d="M8.3 16.6c-1.9 0-3.6 1.5-3.6 3 0 1.2 1 2 2 1.7.7-.2 1.1-.3 1.6-.3s.9.1 1.6.3c1 .3 2-.5 2-1.7 0-1.5-1.7-3-3.6-3Z" />
    </Svg>
  );
}

/** Angled paddle brush: head, bristle dots, handle. */
export function BrushIcon(props) {
  return (
    <Svg {...props}>
      <g transform="rotate(-38 12 12)">
        <rect x="8.2" y="2.2" width="7.6" height="9.6" rx="3.7" fill="currentColor" opacity=".15" stroke="none" />
        <rect x="8.2" y="2.2" width="7.6" height="9.6" rx="3.7" />
        <circle cx="10.7" cy="5.2" r=".85" fill="currentColor" stroke="none" />
        <circle cx="13.3" cy="5.2" r=".85" fill="currentColor" stroke="none" />
        <circle cx="12" cy="7.6" r=".85" fill="currentColor" stroke="none" />
        <path d="M12 11.8v8.8" />
      </g>
    </Svg>
  );
}

/** The classic bone. */
export function BoneIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M8.7 10.6C8.7 8.4 5.6 7.7 4.9 9.8 2.8 9.4 2 12.4 4 13.2c-1 2 1.6 3.7 3.2 2.3.5-.5.7-1 .7-1.7h8.2c0 2.2 3.1 2.9 3.8.8 2.1.4 2.9-2.6.9-3.4 1-2-1.6-3.7-3.2-2.3-.5.5-.7 1-.7 1.7H8.7Z"
        fill="currentColor" opacity=".15" stroke="none"
      />
      <path d="M8.7 10.6C8.7 8.4 5.6 7.7 4.9 9.8 2.8 9.4 2 12.4 4 13.2c-1 2 1.6 3.7 3.2 2.3.5-.5.7-1 .7-1.7h8.2c0 2.2 3.1 2.9 3.8.8 2.1.4 2.9-2.6.9-3.4 1-2-1.6-3.7-3.2-2.3-.5.5-.7 1-.7 1.7H8.7Z" />
    </Svg>
  );
}

/** Tennis ball with seams. */
export function BallIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.2" fill="currentColor" opacity=".15" stroke="none" />
      <circle cx="12" cy="12" r="8.2" />
      <path d="M5.6 6.9a8.2 8.2 0 0 1 0 10.2M18.4 6.9a8.2 8.2 0 0 0 0 10.2" />
    </Svg>
  );
}

/** Litter tray with a scoop. */
export function LitterIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4.2 13.5h15.6l-1.3 5.2a1.8 1.8 0 0 1-1.7 1.3H7.2a1.8 1.8 0 0 1-1.7-1.3L4.2 13.5Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M4.2 13.5h15.6l-1.3 5.2a1.8 1.8 0 0 1-1.7 1.3H7.2a1.8 1.8 0 0 1-1.7-1.3L4.2 13.5Z" />
      <circle cx="9.3" cy="17" r=".9" fill="currentColor" stroke="none" />
      <circle cx="13" cy="17.6" r=".9" fill="currentColor" stroke="none" />
      <path d="M8.4 7.1l5.4-1.8 1 2.9-5.4 1.8Z" />
      <path d="M14.3 6.2 18.6 4" />
    </Svg>
  );
}

/** Tub, feet, bubbles. */
export function BathIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 12.5h16v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-2Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M4 12.5h16v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-2Z" />
      <path d="M4 12.5H2.6M21.4 12.5H20M7.8 18.8l-.9 1.9M16.2 18.8l.9 1.9" />
      <circle cx="9.2" cy="6.6" r="1.6" />
      <circle cx="13.6" cy="4.6" r="1.1" fill="currentColor" opacity=".25" stroke="none" />
      <circle cx="16.4" cy="7.6" r="1.3" />
    </Svg>
  );
}

/** Trim scissors. */
export function NailsIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6.3 4.6 16.6 15M17.7 4.6 7.4 15" />
      <circle cx="12" cy="9.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.6" cy="17.6" r="2.4" fill="currentColor" opacity=".15" stroke="none" />
      <circle cx="5.6" cy="17.6" r="2.4" />
      <circle cx="18.4" cy="17.6" r="2.4" fill="currentColor" opacity=".15" stroke="none" />
      <circle cx="18.4" cy="17.6" r="2.4" />
    </Svg>
  );
}

/** Mortarboard: school is in session. */
export function TrainingIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 4.4 21 8.4l-9 4-9-4 9-4Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M12 4.4 21 8.4l-9 4-9-4 9-4Z" />
      <path d="M7.4 10.6v3c0 1.6 2.1 2.9 4.6 2.9s4.6-1.3 4.6-2.9v-3" />
      <path d="M21 8.4v4.6" />
      <circle cx="21" cy="14.2" r=".9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** The paw: fallback and friend. */
export function PawIcon(props) {
  return (
    <Svg {...props}>
      <ellipse cx="7" cy="8.4" rx="1.5" ry="1.9" fill="currentColor" opacity=".25" stroke="none" />
      <ellipse cx="12" cy="6.8" rx="1.5" ry="1.9" fill="currentColor" opacity=".25" stroke="none" />
      <ellipse cx="17" cy="8.4" rx="1.5" ry="1.9" fill="currentColor" opacity=".25" stroke="none" />
      <ellipse cx="7" cy="8.4" rx="1.5" ry="1.9" />
      <ellipse cx="12" cy="6.8" rx="1.5" ry="1.9" />
      <ellipse cx="17" cy="8.4" rx="1.5" ry="1.9" />
      <path d="M12 12c-3.4 0-5.8 2.5-5.8 4.8 0 1.9 1.5 3.2 3.1 2.7 1-.3 1.8-.5 2.7-.5s1.7.2 2.7.5c1.6.5 3.1-.8 3.1-2.7 0-2.3-2.4-4.8-5.8-4.8Z" fill="currentColor" opacity=".18" />
      <path d="M12 12c-3.4 0-5.8 2.5-5.8 4.8 0 1.9 1.5 3.2 3.1 2.7 1-.3 1.8-.5 2.7-.5s1.7.2 2.7.5c1.6.5 3.1-.8 3.1-2.7 0-2.3-2.4-4.8-5.8-4.8Z" />
    </Svg>
  );
}

export const CARE_ICON_MAP = {
  WALK: WalkIcon,
  BRUSH: BrushIcon,
  TREATS: BoneIcon,
  PLAY: BallIcon,
  LITTER: LitterIcon,
  BATH: BathIcon,
  NAILS: NailsIcon,
  TRAINING: TrainingIcon,
};

/** Same resolution rule as careEmoji: exact label match, paw otherwise. */
export function careIconFor(name) {
  const found = CARE_ACTIVITIES.find(
    (a) => a.label.toLowerCase() === (name || '').toLowerCase()
  );
  return (found && CARE_ICON_MAP[found.id]) || PawIcon;
}

/** Care twin of MedIconChip: tinted rounded chip, icon inherits the tint. */
export function CareIconChip({ name, color, size = 'md', className }) {
  const Icon = careIconFor(name);
  const colors = medColor(color || 'emerald');
  const sizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-xl',
  };
  const iconSizes = { sm: 18, md: 22, lg: 26 };
  return (
    <span className={cn('inline-flex items-center justify-center flex-shrink-0', sizes[size], colors.iconBg, className)}>
      <Icon size={iconSizes[size]} />
    </span>
  );
}
