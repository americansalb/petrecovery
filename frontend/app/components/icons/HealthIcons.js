'use client';

/**
 * Health Book glyphs, same family dialect (icons/Svg.js base).
 */

import Svg from './Svg';

/** Shield with a check: protections current. */
export function ShieldIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.6 19 6.4v5.2c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.4Z" fill="currentColor" opacity=".15" stroke="none" />
      <path d="M12 3.6 19 6.4v5.2c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.4Z" />
      <path d="M9 11.8l2.2 2.2 4-4.4" />
    </Svg>
  );
}

/** Stamped certificate: the page in the book. */
export function CertificateIcon(props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4.6" width="16" height="12.4" rx="2.4" fill="currentColor" opacity=".12" stroke="none" />
      <rect x="4" y="4.6" width="16" height="12.4" rx="2.4" />
      <path d="M7.4 9h6M7.4 12h4" />
      <circle cx="16.2" cy="13.2" r="2.1" />
      <path d="M15.2 15l-.7 4 1.7-1.1 1.7 1.1-.7-4" />
    </Svg>
  );
}
