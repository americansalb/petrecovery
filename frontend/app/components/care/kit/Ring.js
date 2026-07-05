'use client';

/**
 * The activity ring: the care product's Apple-Health centerpiece.
 *
 * An SVG progress arc that fills as the day's doses get given. It is the
 * single most important visual on Today, so it carries the day's state in
 * one glance: the fraction inside, the color by how the day is going.
 */

import { cn } from '@/components/ui';

const TONE = {
  done: '#34c759',     // all given
  going: '#1c1c1e',    // in progress (ink)
  behind: '#ff9500',   // overdue doses waiting
  empty: '#d1d1d6',    // nothing scheduled
};

export default function Ring({
  value = 0,
  total = 0,
  size = 132,
  stroke = 12,
  tone,
  label,
  sublabel,
  className,
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const resolvedTone = tone || (total === 0 ? 'empty' : value >= total ? 'done' : 'going');
  const color = TONE[resolvedTone] || TONE.going;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label ? `${label}: ${value} of ${total}` : `${value} of ${total}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececec" strokeWidth={stroke} />
        {total > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label !== undefined ? (
          <>
            <span className="text-[26px] font-semibold tracking-tight text-care-ink tabular-nums leading-none">{label}</span>
            {sublabel && <span className="text-[11px] font-medium text-care-sub uppercase tracking-wide mt-1">{sublabel}</span>}
          </>
        ) : (
          <span className="text-[26px] font-semibold tracking-tight text-care-ink tabular-nums leading-none">
            {value}<span className="text-care-sub">/{total}</span>
          </span>
        )}
      </div>
    </div>
  );
}
