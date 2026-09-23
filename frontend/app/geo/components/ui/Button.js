'use client';

/**
 * The game's buttons, one of each kind, all from app/geo/theme.css.
 *
 * primary    the one thing to press: ocean blue, white text (5.2:1)
 * secondary  a real action that is not the main one
 * ghost      a way out, or a third choice
 * danger     something that cannot be undone
 *
 * Every size is at least 36px tall and md is 44px, because a phone is
 * the common case. The old primary was rust with a painted 3D edge
 * (founder, 2026-09-23: "ugly"); `pe-button--primary` stays on it only
 * because the press animation keys on it (motion.css).
 */

import Link from 'next/link';

const VARIANTS = new Set(['primary', 'secondary', 'ghost', 'danger']);
// `quiet` was the old name for secondary; the screens still using it
// get the new look without a rename in every file.
const ALIAS = { quiet: 'secondary' };

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  href = null,
  className = '',
  children,
  ...rest
}) {
  const kind = VARIANTS.has(ALIAS[variant] || variant) ? ALIAS[variant] || variant : 'primary';
  const classes = [
    'ui-btn',
    `ui-btn--${kind}`,
    size === 'lg' ? 'ui-btn--lg' : size === 'sm' ? 'ui-btn--sm' : '',
    block ? 'ui-btn--block' : '',
    `pe-button pe-button--${kind}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
