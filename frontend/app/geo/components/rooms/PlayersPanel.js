'use client';

/**
 * Who is in the room: a coloured badge with initials, the name, and
 * whatever matters in the current phase (points or HP, a tick once they
 * have guessed, a crown for the host, a dot for who is here right now).
 */

import { Crown } from 'lucide-react';
import { initials } from '@/app/lib/geo/rooms';
import { formatScore } from '@/app/lib/geo/distance';
import PlayerName from '../PlayerName';

export function PlayerBadge({ player, size = 'md' }) {
  const dims = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';
  return (
    <span
      className={`relative inline-flex ${dims} shrink-0 items-center justify-center rounded-full font-bold text-midnight-900 ring-2 ring-midnight-950/60`}
      style={{
        backgroundColor: player.color,
        opacity: player.eliminated ? 0.45 : 1,
        // A frame from the shop sits outside the ring.
        boxShadow: player.cosmetics?.frame ? `0 0 0 3px ${player.cosmetics.frame}` : undefined,
      }}
      title={player.name}
    >
      {initials(player.name)}
      {player.online === false ? <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-midnight-500 ring-2 ring-midnight-950" title="Away" /> : null}
    </span>
  );
}

export function HpBar({ hp, max = 6000, color }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" aria-label={`${hp} HP`}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color || '#22c55e' }} />
    </div>
  );
}

/**
 * compact: a horizontal strip for the HUD. Otherwise a list.
 */
export default function PlayersPanel({ players, variant = 'classic', phase, compact = false }) {
  const isDuel = variant === 'duel';
  if (compact) {
    return (
      <div className="flex max-w-[60vw] flex-wrap items-center justify-end gap-1.5">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-1 rounded-full border border-white/15 bg-midnight-900/80 py-0.5 pl-0.5 pr-2 backdrop-blur" title={`${p.name}: ${isDuel ? `${p.hp} HP` : `${formatScore(p.score)} points`}`}>
            <PlayerBadge player={p} size="sm" />
            <span className={`text-xs font-semibold ${p.you ? 'text-flash-300' : 'text-white'}`}>{isDuel ? p.hp : formatScore(p.score)}</span>
            {phase === 'guessing' ? (
              <span className={`text-xs ${p.guessed ? 'text-green-400' : 'text-white/30'}`} aria-label={p.guessed ? 'guessed' : 'still guessing'}>
                {p.guessed ? '✓' : '·'}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/10">
      {players.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2">
          <PlayerBadge player={p} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <PlayerName name={p.name} cosmetics={p.cosmetics} you={p.you} className={`font-semibold ${p.you && !p.cosmetics?.color ? 'text-flash-300' : 'text-white'}`} />
              {p.isHost ? <Crown className="h-3.5 w-3.5 text-flash-400" aria-label="Host" /> : null}
              {p.eliminated ? <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold uppercase text-red-300">out</span> : null}
              {p.online === false ? <span className="text-[10px] uppercase tracking-wide text-white/40">away</span> : null}
            </div>
            {p.rating ? (
              <div className="text-[11px] text-white/50">
                {p.rating.tier} {p.rating.value}
                {p.rating.provisional ? ' (provisional)' : ''}
              </div>
            ) : p.rated === false ? (
              <div className="text-[11px] text-white/40">unrated</div>
            ) : null}
            {isDuel ? <div className="mt-1 w-40 max-w-full"><HpBar hp={p.hp} color={p.color} /></div> : null}
          </div>
          <div className="text-right">
            <div className="font-semibold tabular-nums text-white">{isDuel ? `${p.hp} HP` : formatScore(p.score)}</div>
            {phase === 'finished' && Number.isFinite(p.ratingDelta) ? (
              <div className={`text-[11px] font-semibold tabular-nums ${p.ratingDelta >= 0 ? 'text-green-400' : 'text-red-300'}`}>
                {p.ratingDelta >= 0 ? '+' : ''}
                {p.ratingDelta} rating
              </div>
            ) : null}
            {!isDuel && p.roundWins ? <div className="text-[11px] text-white/50">{p.roundWins} round {p.roundWins === 1 ? 'win' : 'wins'}</div> : null}
            {phase === 'guessing' ? <div className={`text-[11px] ${p.guessed ? 'text-green-400' : 'text-white/40'}`}>{p.guessed ? 'guessed' : 'thinking'}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
