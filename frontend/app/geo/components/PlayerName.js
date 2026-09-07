'use client';

/**
 * A player's name as they chose to wear it: the name colour and the
 * title from the shop (docs/GEO.md, "Points and cosmetics"). Used in
 * rooms, on the rankings, and on the daily board.
 */

export default function PlayerName({ name, cosmetics = null, you = false, dark = true, className = '' }) {
  const color = cosmetics?.color || '';
  const title = cosmetics?.title || '';
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="truncate" style={color ? { color } : undefined}>
        {name}
        {you ? ' (you)' : ''}
      </span>
      {title ? (
        <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold uppercase tracking-wide ${dark ? 'bg-white/10 text-white/70' : 'bg-midnight-100 text-midnight-600'}`}>{title}</span>
      ) : null}
    </span>
  );
}
