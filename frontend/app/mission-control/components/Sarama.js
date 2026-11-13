'use client';

/**
 * Sarama, the site's search dog, guiding the person on the card.
 *
 * Her face in a round frame, and what she says in a bubble beside it
 * (her lines are app/mission-control/lib/sarama.js). She bobs a little
 * while she waits and hops when something is done; both stop for anyone
 * who has asked their device for less motion (app/globals.css).
 *
 * `Paws` is the row of paw prints an action leaves, and `Trail` is the
 * line under a card that says where the reader and the team stand: the
 * game is app/lib/trail.js.
 */
import { PawPrint } from 'lucide-react';
import { SARAMA_AVATAR_PNG } from '@/lib/brandAssets';
import { freshAreas, nextRank, rankOf, FRESH_HOURS } from '@/app/lib/trail';

/** Her face: the standing drawing, framed on the head and the vest. */
export function SaramaFace({ size = 52, mood = 'guide' }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-[var(--mc-line-strong)] ${mood === 'cheer' ? 'mc-sarama-cheer' : 'mc-sarama-idle'}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SARAMA_AVATAR_PNG} alt="" className="absolute max-w-none select-none" draggable={false} style={{ width: size * 2.3, left: -size * 0.65, top: -size * 0.06 }} />
    </span>
  );
}

export default function Sarama({ say = '', mood = 'guide', size = 52, className = '' }) {
  return (
    <div className={`flex items-end gap-2.5 ${className}`}>
      <SaramaFace size={size} mood={mood} />
      {say && (
        <p key={say} className="mc-sarama-says min-w-0 rounded-2xl rounded-bl-md bg-[var(--mc-raised)] px-3.5 py-2.5 text-[15px] font-semibold leading-[21px] text-[var(--mc-ink)]">
          <span className="sr-only">Sarama says: </span>
          {say}
        </p>
      )}
    </div>
  );
}

/** The paw prints an action leaves, landing one after another. */
export function Paws({ count = 0, className = '' }) {
  if (!(count > 0)) return null;
  return (
    <p className={`flex items-center gap-1.5 ${className}`} role="img" aria-label={`${count} paw ${count === 1 ? 'print' : 'prints'}`}>
      {Array.from({ length: Math.min(count, 6) }, (_, i) => (
        <PawPrint key={i} size={22} aria-hidden="true" className="mc-paw text-[var(--mc-done)]" style={{ animationDelay: `${0.15 + i * 0.12}s` }} />
      ))}
      <span className="ml-1 text-[15px] font-extrabold leading-5 text-[var(--mc-ink)]">+{count}</span>
    </p>
  );
}

/**
 * Where the reader and the team stand: their own prints and rank, and the
 * goal everyone shares, as a count anyone can check on the map.
 */
export function Trail({ trail = null, items = [], name = 'the pet', now = Date.now(), className = '' }) {
  const mine = trail?.mine;
  const goal = freshAreas(items, now);
  const next = mine ? nextRank(mine.paws) : null;
  if (!goal.total && !(mine?.paws > 0) && !(trail?.paws > 0)) return null;
  return (
    <div className={`rounded-2xl border border-[var(--mc-line)] px-3.5 py-3 ${className}`} aria-label="The trail">
      {mine?.paws > 0 && (
        <p className="flex items-center gap-2 text-[15px] font-bold leading-[21px] text-[var(--mc-ink)]">
          <PawPrint size={18} aria-hidden="true" className="shrink-0 text-[var(--mc-done)]" />
          <span>
            You have {mine.paws} paw {mine.paws === 1 ? 'print' : 'prints'} on {name}&apos;s search. {rankOf(mine.paws)}.{next ? ` ${next.need} more to ${next.name}.` : ''}
          </span>
        </p>
      )}
      {trail?.paws > 0 && (
        <p className={`text-[14px] font-medium leading-5 text-[var(--mc-soft)] ${mine?.paws > 0 ? 'mt-1' : ''}`}>
          {trail.helpers === 1 ? '1 helper has' : `${trail.helpers} helpers have`} left {trail.paws} paw {trail.paws === 1 ? 'print' : 'prints'} on this search.
        </p>
      )}
      {goal.total > 0 && (
        <>
          <p className={`text-[14px] font-semibold leading-5 text-[var(--mc-ink)] ${mine?.paws > 0 || trail?.paws > 0 ? 'mt-2' : ''}`}>
            Keep the map green: {goal.fresh} of {goal.total} areas searched in the last {FRESH_HOURS} hours.
          </p>
          <span className="mt-1.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: goal.total }, (_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < goal.fresh ? 'bg-[var(--mc-done)]' : 'bg-[var(--mc-line-strong)]'}`} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
