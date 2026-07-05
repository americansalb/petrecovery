'use client';

/**
 * The tile kit: the care product's building blocks in the Apple Health
 * register. White rounded surfaces on a warm grouped background, laid out
 * in a real 2-D grid, not a stacked column of sections.
 *
 * - Tile: a rounded white surface, optionally tappable, optionally tinted
 *   by state (amber = due soon, red = needs attention, emerald = done).
 * - TileGrid: the responsive grid tiles live in.
 * - StatTile: one big number/value + a label, the at-a-glance answer.
 */

import Link from 'next/link';
import { cn } from '@/components/ui';

const STATE_TINT = {
  due: 'ring-1 ring-red-200 bg-red-50/60',
  soon: 'ring-1 ring-amber-200 bg-amber-50/50',
  done: 'bg-care-surface',
  idle: 'bg-care-surface',
};

export function Tile({ as, href, onClick, state = 'idle', className, children, ariaLabel, ...rest }) {
  const base = cn(
    'rounded-3xl border border-care-line shadow-tile p-5 text-left',
    STATE_TINT[state] || STATE_TINT.idle,
    (href || onClick) && 'transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-ink',
    className
  );
  if (href) {
    return <Link href={href} className={cn(base, 'block')} aria-label={ariaLabel} {...rest}>{children}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={cn(base, 'w-full')} aria-label={ariaLabel} {...rest}>{children}</button>;
  }
  const Comp = as || 'div';
  return <Comp className={base} {...rest}>{children}</Comp>;
}

export function TileGrid({ className, children }) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>{children}</div>;
}

/**
 * A single stat: a big value with a small label above it and optional
 * sub-line or trailing element (a ring, a sparkline). The Apple Health
 * summary tile.
 */
export function StatTile({ label, value, unit, sub, subTone = 'sub', icon: Icon, trailing, href, onClick, ariaLabel }) {
  const subColor = {
    sub: 'text-care-sub',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  }[subTone] || 'text-care-sub';

  return (
    <Tile href={href} onClick={onClick} ariaLabel={ariaLabel} className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-2">
          {Icon && <Icon size={15} className="text-care-sub" />}
          <p className="text-[12px] font-medium text-care-sub uppercase tracking-wide">{label}</p>
        </div>
        <p className="text-[28px] font-semibold tracking-tight text-care-ink tabular-nums leading-none">
          {value}
          {unit && <span className="text-[16px] font-medium text-care-sub ml-1">{unit}</span>}
        </p>
        {sub && <p className={cn('text-[13px] mt-1.5', subColor)}>{sub}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </Tile>
  );
}
