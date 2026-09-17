'use client';

/**
 * A player's name as they chose to wear it: the name colour and the
 * title from the shop (docs/GEO.md, "Points and cosmetics"). Used in
 * rooms, on the rankings, and on the daily board.
 *
 * It took a `dark` prop, for the one screen that rendered it on paper.
 * The rankings are dark now like the rest of the game, so the light
 * branch had no caller and only looked like a choice somebody still
 * had.
 */

export default function PlayerName({ name, cosmetics = null, you = false, className = '' }) {
  const color = cosmetics?.color || '';
  const title = cosmetics?.title || '';
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="truncate" style={color ? { color } : undefined}>
        {name}
        {you ? ' (you)' : ''}
      </span>
      {title ? (
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">{title}</span>
      ) : null}
    </span>
  );
}
