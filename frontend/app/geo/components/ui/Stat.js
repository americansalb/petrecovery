'use client';

/**
 * A number with a word under it. Used wherever the game reports
 * something it counted: rating, games, wins, HP, points.
 *
 * The number is the thing, so it is bigger than its label and always
 * tabular, which stops a column of them jittering as they update.
 */

export default function Stat({ label, value, sub = null, tone = 'plain', className = '' }) {
  const colour = tone === 'bright' ? 'text-clay-300' : 'text-white';
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
      {sub ? <p className="text-xs text-white/60">{sub}</p> : null}
    </div>
  );
}
