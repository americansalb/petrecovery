'use client';

/**
 * The game's one card.
 *
 * There were 24 hand-written variants of `rounded-2xl border ...` across
 * the game's screens, which is how a page ends up looking like six
 * different products: the padding, the border and the surface drifted a
 * little every time somebody wrote another one. This is the shape, and
 * `__tests__/geo/components.test.js` fails on a new one written by hand.
 *
 * tone   panel    the ordinary surface a section sits on
 *        sunken   a card inside a card, one step darker
 *        marked   the one that is yours, or chosen, or the answer
 * pad    md       a section
 *        sm       a tile in a grid
 *        none     the caller owns the inside (a map, a table)
 */

import Link from 'next/link';

const TONES = {
  panel: 'border-white/10 bg-ocean-900/60',
  sunken: 'border-white/10 bg-ocean-950/40',
  marked: 'border-clay-400 bg-ocean-900',
};

const PADS = { md: 'p-5', sm: 'p-4', none: '' };

const HOVER = 'transition hover:border-white/25 hover:bg-ocean-900/80';

export default function Card({
  tone = 'panel',
  pad = 'md',
  href = null,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  const base = `rounded-2xl border ${TONES[tone] || TONES.panel} ${PADS[pad] ?? PADS.md}`;
  const classes = [base, href ? HOVER : '', className].filter(Boolean).join(' ');
  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

/** A card's heading: an icon, a name, and nothing else on the line. */
export function CardTitle({ icon: Icon, children, trailing = null }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
      {Icon ? <Icon className="h-4 w-4 text-clay-300" /> : null}
      {children}
      {trailing ? <span className="font-normal normal-case tracking-normal text-white/50">{trailing}</span> : null}
    </h2>
  );
}
