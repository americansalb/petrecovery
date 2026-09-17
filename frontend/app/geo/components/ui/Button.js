'use client';

/**
 * The game's buttons. Three of them, and every one is at least 44px
 * tall because a phone is the common case.
 *
 * primary  the one thing to press. clay-400 with ocean-950 text, which
 *          is 5.34:1 - white on clay-500 was 3.68 and failed AA on
 *          every screen it appeared on, which was all of them.
 * quiet    a real action that is not the main one
 * ghost    a way out, or a third choice
 */

import Link from 'next/link';

const VARIANTS = {
  primary:
    'bg-clay-400 text-ocean-950 font-bold hover:bg-clay-300 disabled:cursor-not-allowed disabled:bg-ocean-800 disabled:text-sand-300',
  quiet:
    'border border-white/15 text-white font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50',
  ghost:
    'text-white/70 font-semibold hover:bg-white/5 hover:text-white disabled:opacity-50',
};

const SIZES = {
  md: 'min-h-[44px] px-5 py-2.5 text-sm',
  lg: 'min-h-[52px] px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  href = null,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
    `pe-button pe-button--${variant}`,
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
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
