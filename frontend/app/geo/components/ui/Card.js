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
  panel: 'border-pe-line bg-pe-surface',
  sunken: 'border-pe-line bg-pe-canvas',
  marked: 'border-pe-accent bg-pe-surface',
};

const PADS = { md: 'p-5 sm:p-6', sm: 'p-4', none: '' };

const HOVER = 'transition hover:border-pe-line-strong hover:bg-pe-raised';

export default function Card({
  tone = 'panel',
  pad = 'md',
  href = null,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  const base = `pe-panel rounded-2xl border ${TONES[tone] || TONES.panel} ${PADS[pad] ?? PADS.md}`;
  const classes = [base, href ? HOVER : '', className]
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
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

/** A card's heading: an icon, a name, and nothing else on the line. */
export function CardTitle({ icon: Icon, children, trailing = null }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-pe-fg">
      {Icon ? <Icon className="h-4 w-4 text-pe-muted" /> : null}
      {children}
      {trailing ? (
        <span className="font-normal text-pe-subtle">
          {trailing}
        </span>
      ) : null}
    </h2>
  );
}
