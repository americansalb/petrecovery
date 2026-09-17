'use client';

/**
 * Ranked, the daily and the weekly cup: the three sets of places
 * everybody plays against each other, and where you came in them.
 *
 * These lived on /geo/setup. That page was a settings form nobody
 * should meet before they have played anything, and deleting it was
 * right, but three whole modes went with it: the only button in the
 * game that started a ranked round, the only button that started the
 * cup, and both boards. The endpoints kept answering and nothing
 * called them.
 *
 * So they live on the Rankings page, which is already the page about
 * where you came, already in the navigation, and already says in its
 * own last line that the daily and the cup exist. Nothing here is a
 * setting: each one is a sentence and a button, and the board under it
 * is the reason to press it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Play, Timer, Trophy } from 'lucide-react';
import { formatScore } from '@/app/lib/geo/distance';
import { untilText } from '@/app/lib/geo/meter';
import { PROVISIONAL_GAMES } from '@/app/lib/geo/rating';
import { profileHeaders } from '../lib/profile';
import PlayerName from './PlayerName';

function ordinal(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  const tens = v % 100;
  if (tens >= 11 && tens <= 13) return `${v}th`;
  return `${v}${['th', 'st', 'nd', 'rd'][v % 10] || 'th'}`;
}

/** Where you came, in one sentence, whatever stage you are at. */
function standing(set, noun) {
  if (set?.you?.rank) return `You are ${ordinal(set.you.rank)} of ${set.finished} who finished ${noun}.`;
  if (set?.you) return `Your ${set.you.rounds} of ${set.rounds} rounds are in.`;
  if (set?.finished) return `${set.finished} finished ${noun} so far.`;
  return `Nobody has finished ${noun} yet. Be first.`;
}

function Board({ rows }) {
  if (!rows?.length) return null;
  return (
    <ol className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
      {rows.slice(0, 5).map((row) => (
        <li key={row.profileId} className="flex items-center gap-2">
          <span className="w-5 shrink-0 tabular-nums text-white/60">{row.rank}</span>
          <PlayerName name={row.name} cosmetics={row.cosmetics} className="min-w-0 flex-1" />
          <span className="shrink-0 font-semibold tabular-nums">{formatScore(row.total)}</span>
        </li>
      ))}
    </ol>
  );
}

function Panel({ icon: Icon, title, children, href, cta, marker, ctaMarker }) {
  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-ocean-900/60 p-5" {...(marker ? { [marker]: true } : {})}>
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <div className="mt-2 flex-1 text-sm text-white/70">{children}</div>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center gap-2 self-start rounded-xl bg-clay-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-clay-400"
        {...(ctaMarker ? { [ctaMarker]: true } : {})}
      >
        <Play className="h-4 w-4 fill-current" />
        {cta}
      </Link>
    </section>
  );
}

export default function Contests({ solo = null }) {
  const [daily, setDaily] = useState(null);
  const [cup, setCup] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = (url, set) =>
      fetch(url, { headers: profileHeaders(), cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (alive && data?.ok) set(data);
        })
        // A board that will not load is a board that is not shown. The
        // button above it still works, which is the part that matters.
        .catch(() => {});
    load('/api/geo/daily', setDaily);
    load('/api/geo/cup', setCup);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">Play for a place</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        The same places for everyone, on the same clock. Ranked moves your rating; the daily and the cup are for the board
        and for points.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel icon={Timer} title="Ranked" href="/geo/play?mode=ranked" cta="Play this hour's five" marker="data-ranked-panel" ctaMarker="data-start-ranked">
          <p>
            Five places on a 60 second clock, the same for everyone playing this hour. Your score is set against theirs and
            the result moves your rating.
          </p>
          <p className="mt-3 border-t border-white/10 pt-3 font-semibold text-white/80" data-ranked-standing>
            {solo
              ? solo.provisional
                ? `${solo.games} of ${PROVISIONAL_GAMES} placement games played.`
                : `${solo.tier}, ${Math.round(solo.rating ?? solo.value)}. ${solo.games} ranked games.`
              : `${PROVISIONAL_GAMES} games to be placed.`}
          </p>
        </Panel>

        <Panel
          icon={CalendarDays}
          title="Daily challenge"
          href="/geo/play?mode=daily"
          cta={daily?.you ? 'Play today again' : "Play today's five"}
          marker="data-daily-board"
        >
          <p>Five places, the same for everyone{daily?.date ? ` on ${daily.date}` : ' today'}.</p>
          <p className="mt-3 border-t border-white/10 pt-3 font-semibold text-white/80">{standing(daily, 'today')}</p>
          <Board rows={daily?.board} />
        </Panel>

        <Panel
          icon={Trophy}
          title="Weekly cup"
          href="/geo/play?mode=cup"
          cta={cup?.you ? (cup.you.finished ? 'Play the ten again' : 'Finish the ten') : "Play this week's ten"}
          marker="data-cup-board"
        >
          <p>
            Ten places, 60 seconds each, the same for everyone this week.
            {cup?.endsAt ? ` Ends ${untilText(cup.endsAt)}.` : ''}
          </p>
          {cup?.prizes ? (
            <p className="mt-1 text-xs text-white/60">
              Points: {cup.prizes.podium.join(', ')} for the top three, {cup.prizes.topTen} for the rest of the top ten,{' '}
              {cup.prizes.finished} for finishing.
            </p>
          ) : null}
          <p className="mt-3 border-t border-white/10 pt-3 font-semibold text-white/80">{standing(cup, 'this week')}</p>
          <Board rows={cup?.board} />
        </Panel>
      </div>
    </section>
  );
}
