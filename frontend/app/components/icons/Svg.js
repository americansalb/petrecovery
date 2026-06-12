'use client';

/**
 * Shared base for the in-theme icon family (care, species, meds).
 * 24px grid, rounded 1.8px strokes, soft same-color fills, all tinted
 * by currentColor so the surrounding chip picks the palette.
 */

export default function Svg({ size = 24, className, children, label }) {
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
