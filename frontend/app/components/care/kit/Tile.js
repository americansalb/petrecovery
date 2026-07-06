'use client';

/**
 * The care kit in direction D (clinical-lux): white cards on a near-white
 * ground, hairline-boxed by a soft inset shadow, deep-teal accent, lots of
 * air. Cards, a responsive grid, and a stat block. Bespoke screens compose
 * these; nothing here carries logic.
 */

import Link from 'next/link';
import { cn } from '@/components/ui';

export function Card({ as, href, onClick, className, children, ariaLabel, ...rest }) {
  const base = cn(
    'bg-care-surface rounded-[20px] shadow-care',
    (href || onClick) && 'text-left transition-transform hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care-teal',
    className
  );
  if (href) return <Link href={href} className={cn(base, 'block')} aria-label={ariaLabel} {...rest}>{children}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(base, 'w-full')} aria-label={ariaLabel} {...rest}>{children}</button>;
  const Comp = as || 'div';
  return <Comp className={base} {...rest}>{children}</Comp>;
}

export function CardGrid({ className, children }) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>{children}</div>;
}

/** Small uppercase eyebrow label used across the care surfaces. */
export function Overline({ className, children }) {
  return <p className={cn('text-[10.5px] font-bold uppercase tracking-[0.16em] text-care-faint', className)}>{children}</p>;
}

/** A stat: big number + label + optional sub, the Health-summary building block. */
export function Stat({ label, value, unit, sub, subTone = 'sub', trailing }) {
  const subColor = { sub: 'text-care-sub', teal: 'text-care-teal font-semibold', amber: 'text-care-amber font-semibold', red: 'text-red-600 font-semibold' }[subTone] || 'text-care-sub';
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Overline>{label}</Overline>
        <div className="flex items-baseline gap-1 mt-2.5">
          <span className="text-[27px] font-semibold tracking-tight text-care-ink tabular-nums leading-none">{value}</span>
          {unit && <span className="text-[12px] text-care-sub font-medium">{unit}</span>}
        </div>
        {sub && <p className={cn('text-[11.5px] mt-2', subColor)}>{sub}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
