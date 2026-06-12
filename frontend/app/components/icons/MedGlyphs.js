'use client';

/**
 * Medication glyphs - the clinical seven, drawn warm
 *
 * Custom versions of the med icon tokens (lib/medications
 * MED_ICON_TOKENS), replacing the stock lucide set so the Meds room
 * matches the rest of the icon family. Bone and paw are shared with
 * CareIcons; MED_ICON_MAP in MedIcon.js keys these by the same DB
 * tokens, so no data changes.
 */

import Svg from './Svg';

/** Half-filled capsule on the diagonal. */
export function PillGlyph(props) {
  return (
    <Svg {...props}>
      <g transform="rotate(45 12 12)">
        <path d="M9 6.6a3 3 0 0 1 6 0V12H9Z" fill="currentColor" opacity=".15" stroke="none" />
        <rect x="9" y="3.6" width="6" height="16.8" rx="3" />
        <path d="M9 12h6" />
      </g>
    </Svg>
  );
}

/** Scored tablet with a little companion. */
export function CapsuleGlyph(props) {
  return (
    <Svg {...props}>
      <circle cx="9.4" cy="9.6" r="4.8" />
      <path d="M6 6.3l6.8 6.7" />
      <circle cx="16.4" cy="16.2" r="3.4" fill="currentColor" opacity=".15" stroke="none" />
      <circle cx="16.4" cy="16.2" r="3.4" />
    </Svg>
  );
}

/** Syringe on the diagonal. */
export function SyringeGlyph(props) {
  return (
    <Svg {...props}>
      <path d="M19.4 4.6l-1.2 1.2M20 7.4 16.6 4M5.2 18.8 3.4 20.6M8.4 13.2l2 2" />
      <rect x="7.9" y="6.7" width="5.4" height="11" rx="1.2" transform="rotate(45 10.6 12.2)" fill="currentColor" opacity=".12" stroke="none" />
      <rect x="7.9" y="6.7" width="5.4" height="11" rx="1.2" transform="rotate(45 10.6 12.2)" />
      <path d="M15.4 6.2l2.4 2.4" />
    </Svg>
  );
}

/** A big drop and its echo. */
export function DropletsGlyph(props) {
  return (
    <Svg {...props}>
      <path d="M10.2 4.6c2.6 3.6 4.3 5.7 4.3 8a4.3 4.3 0 0 1-8.6 0c0-2.3 1.7-4.4 4.3-8Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M10.2 4.6c2.6 3.6 4.3 5.7 4.3 8a4.3 4.3 0 0 1-8.6 0c0-2.3 1.7-4.4 4.3-8Z" />
      <path d="M17.8 12.6c1.5 2 2.4 3.2 2.4 4.5a2.4 2.4 0 0 1-4.8 0c0-1.3.9-2.5 2.4-4.5Z" fill="currentColor" opacity=".25" stroke="none" />
    </Svg>
  );
}

/** The classic heart. */
export function HeartGlyph(props) {
  return (
    <Svg {...props}>
      <path d="M12 19.4C7.2 15.4 4.4 12.7 4.4 9.8a4 4 0 0 1 7.1-2.5l.5.6.5-.6a4 4 0 0 1 7.1 2.5c0 2.9-2.8 5.6-7.6 9.6Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M12 19.4C7.2 15.4 4.4 12.7 4.4 9.8a4 4 0 0 1 7.1-2.5l.5.6.5-.6a4 4 0 0 1 7.1 2.5c0 2.9-2.8 5.6-7.6 9.6Z" />
    </Svg>
  );
}

/** A leaf with a swept vein. */
export function LeafGlyph(props) {
  return (
    <Svg {...props}>
      <path d="M19.2 4.8C10.6 4.8 5.4 9.3 5.4 15.2c0 1.7.4 3 1.1 4 .3-5.9 3.9-9.9 9-11.6-4.4 2.4-7.5 6.3-8.3 11.1.9.5 2 .8 3.3.8 6 0 9.7-5.6 8.7-14.7Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M19.2 4.8C10.6 4.8 5.4 9.3 5.4 15.2c0 1.7.4 3 1.1 4 .3-5.9 3.9-9.9 9-11.6-4.4 2.4-7.5 6.3-8.3 11.1.9.5 2 .8 3.3.8 6 0 9.7-5.6 8.7-14.7Z" />
    </Svg>
  );
}

/** Four-point sparkle with a small twin. */
export function SparkleGlyph(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.4l1.9 5.2 5.2 1.9-5.2 1.9-1.9 5.2-1.9-5.2-5.2-1.9 5.2-1.9Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M12 3.4l1.9 5.2 5.2 1.9-5.2 1.9-1.9 5.2-1.9-5.2-5.2-1.9 5.2-1.9Z" />
      <path d="M18.6 16.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" fill="currentColor" opacity=".55" stroke="none" />
    </Svg>
  );
}
