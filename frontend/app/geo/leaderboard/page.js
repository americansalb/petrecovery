'use client';

/**
 * /geo/leaderboard: the ladders. Ratings are Glicko: a number and a
 * band of uncertainty, updated from every finished room (docs/GEO.md).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import {
  LADDERS,
  LADDER_LABELS,
  PROVISIONAL_GAMES,
} from '@/app/lib/geo/rating';
import { VARIANTS } from '@/app/lib/geo/rooms';
import { profileHeaders } from '../lib/profile';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import PlayerName from '../components/PlayerName';
import RankPath from '../components/RankPath';

function RatingCell({ row }) {
  return (
    <span className="tabular-nums">
      <span className="font-semibold">{row.value}</span>
      <span className="text-pe-subtle"> ±{Math.round(row.rd * 2)}</span>
    </span>
  );
}

export default function GeoLeaderboardPage() {
  const [ladder, setLadder] = useState('duel');
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setBoard(null);
    setError('');
    fetch(`/api/geo/leaderboard?ladder=${ladder}`, {
      headers: profileHeaders(),
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('leaderboard'))))
      .then((data) => alive && setBoard(data))
      .catch(() => alive && setError('Could not load the leaderboard.'));
    return () => {
      alive = false;
    };
  }, [ladder]);

  const you = board?.you;

  const playHref = ladder === 'solo' ? '/geo/play?mode=ranked' : `/geo/rooms?game=${ladder === 'script' ? 'script' : 'street'}`;

  return (
    <main className="ui-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="ui-h1">Rankings</h1>
          {/* The line is always there. It used to appear when the board
              arrived and push the table down 28px while the page was being
              read, so the shape is held with a placeholder the height of
              one line of text. */}
          {board?.season ? (
            <p className="ui-lead mt-2" data-season>
              {board.season.label} &middot; {board.season.daysLeft}{' '}
              {board.season.daysLeft === 1 ? 'day' : 'days'} left
            </p>
          ) : !error ? (
            <p className="mt-2 flex h-5 items-center" aria-hidden="true">
              <span className="pe-skeleton h-3 w-56" />
            </p>
          ) : null}
        </div>
        {/* The way into the ladder on screen. Solo is a solo ladder: it
            can only be entered by playing the ranked hour, and sending
            an unplaced player to open a room was the bug. */}
        <Button href={playHref} data-ladder-play>
          {ladder === 'solo' ? "Play this hour's five" : 'Play multiplayer'}
        </Button>
      </header>

      <div className="mt-8">
        <Tabs
          items={LADDERS.filter((id) => id !== 'classic').map((id) => ({
            id,
            label: id === 'duel' ? 'Street' : id === 'script' ? 'Script' : id === 'solo' ? 'Ranked solo' : LADDER_LABELS[id] || VARIANTS[id]?.label || id,
          }))}
          value={ladder}
          onChange={setLadder}
          label="Ladders"
          marker="ladder-tab"
        />
      </div>

      {/* Somebody with a profile will get a card here; reserve it before
          the first paint so it does not shove the board down when it
          lands. :root[data-geo-profile] is set by an inline script in
          the layout, before anything is drawn (motion.css). */}
      {board === null && !error ? (
        <div className="pe-you-skeleton mt-6" aria-hidden="true">
          <Card tone="marked">
            <span className="pe-skeleton block h-3 w-24" />
            <span className="pe-skeleton mt-4 block h-9 w-40" />
            <span className="pe-skeleton mt-3 block h-3 w-52" />
            <span className="pe-skeleton mt-6 block h-3 w-64" />
          </Card>
        </div>
      ) : null}

      {you ? (
        <Card tone="marked" className="pe-swap mt-6">
          <p className="text-sm font-medium text-pe-muted">You, {you.name}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            {/* 1500 is where everyone starts, not something earned.
                Printing it as "Silver, provisional" beside 0 games
                reads as an accomplishment nobody has, so an unplaced
                player is told they are unplaced and how far off it is
                (founder, 2026-09-17). */}
            {you.games >= PROVISIONAL_GAMES ? (
              <div>
                <p className="text-4xl font-bold tabular-nums text-pe-warm">{you.value}</p>
                <p className="mt-1 text-sm text-pe-muted">
                  {you.tier}
                  {you.provisional ? ', provisional' : ''} · likely between {you.low} and {you.high}
                </p>
                <p className="mt-1 text-sm text-pe-muted">{you.accuracy != null ? `${Math.floor(you.accuracy * 1000) / 10}% average accuracy` : 'Play a new rated match to start tracking accuracy.'}</p>
              </div>
            ) : (
              <div>
                <p className="text-3xl font-bold text-pe-fg">Unplaced</p>
                <p className="mt-1 text-sm text-pe-muted">
                  Placement games: {you.games} of {PROVISIONAL_GAMES}
                </p>
                <div className="pe-placement-track" aria-hidden="true">
                  {Array.from({ length: PROVISIONAL_GAMES }, (_, i) => (
                    <span key={i} data-complete={i < you.games} />
                  ))}
                </div>
              </div>
            )}
            <dl className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <dt className="text-pe-subtle">Rank</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{you.rank ? `#${you.rank}` : '–'}</dd>
              </div>
              <div>
                <dt className="text-pe-subtle">Games</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{you.games}</dd>
              </div>
              <div>
                <dt className="text-pe-subtle">Wins</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{you.wins}</dd>
              </div>
            </dl>
          </div>
          {!you.games ? (
            /* The destination has to match the ladder on screen. This
               said "open a room with a friend" on every tab including
               Ranked solo, which is a solo ladder a room cannot rate
               (founder, 2026-09-17). */
            <p className="mt-4 text-sm text-pe-muted">
              No rated games yet.{' '}
              <Link href={playHref} className="ui-link">
                {ladder === 'solo' ? "Play this hour's five" : `Play ${ladder === 'script' ? 'Script' : 'Street'} multiplayer`}
              </Link>{' '}
              to start placing.
            </p>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="ui-error mt-6">
          {error}
        </p>
      ) : null}

      {/* Rank, player and rating on a phone; the rest as the screen
          allows. Keyed on the ladder and on whether it has loaded, so
          both choosing a ladder and the rows arriving are a fade rather
          than a swap. */}
      <Card key={`${ladder}:${board ? 'board' : 'loading'}`} pad="none" className="pe-swap mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-pe-line text-left text-xs font-medium text-pe-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">League</th>
              <th className="px-4 py-3 font-medium">Rating</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Games</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Wins</th>
              <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Podiums</th>
              <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Peak</th>
              <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Streak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pe-line">
            {/* While the board loads: the empty state itself, invisible,
                under a shimmer, so the page does not grow when the rows
                arrive. */}
            {board === null && !error ? (
              <tr aria-hidden="true">
                <td colSpan={9} className="relative px-4 py-6 text-center">
                  <div className="pe-ladder-empty invisible">
                    <Trophy size={28} strokeWidth={1.5} />
                    <strong>No ranked players yet</strong>
                    <p>Finish {PROVISIONAL_GAMES} placement matches to appear here.</p>
                    <span>Play</span>
                  </div>
                  <span className="pe-skeleton absolute inset-x-4 inset-y-6" />
                </td>
              </tr>
            ) : null}
            {board && !board.rows.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center">
                  <div className="pe-ladder-empty">
                    <Trophy size={28} strokeWidth={1.5} />
                    <strong>No ranked players yet</strong>
                    <p>Finish {PROVISIONAL_GAMES} placement matches to appear here.</p>
                    <Link href={playHref} className="ui-btn ui-btn--secondary ui-btn--sm">
                      Play
                    </Link>
                  </div>
                </td>
              </tr>
            ) : null}
            {(board?.rows || []).map((row) => (
              <tr key={row.profileId} className={row.profileId === you?.profileId ? 'bg-pe-accent/10' : 'transition-colors hover:bg-pe-raised/60'}>
                <td className="px-4 py-3 tabular-nums text-pe-subtle">{row.rank}</td>
                <td className="px-4 py-3 font-semibold">
                  <PlayerName name={row.name} cosmetics={row.cosmetics} />
                  <span className="block text-xs font-normal text-pe-muted sm:hidden">{row.tier}</span>
                </td>
                <td className="hidden px-4 py-3 text-pe-muted sm:table-cell">{row.tier}</td>
                <td className="px-4 py-3">
                  <RatingCell row={row} />
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{row.games}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{row.wins}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">
                  {row.games ? `${Math.round((100 * row.podiums) / row.games)}%` : '0%'}
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{row.peak}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{row.streak ? `${row.streak}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* How rating works is worth knowing once and reading never, so it
          sits under the table rather than above it. */}
      <details className="mt-8 max-w-2xl text-sm text-pe-muted">
        <summary className="cursor-pointer font-medium text-pe-accent-fg">How rating works</summary>
        {/* The six leagues, and where each one starts: the legend for
            the Rating column. */}
        <RankPath />
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Street, Script and Ranked solo have separate ratings, based on your results against other players.</li>
          <li>Ranked solo rates this hour&apos;s five places against everyone who played them.</li>
          <li>Finish {PROVISIONAL_GAMES} placement matches to join the rankings.</li>
          <li>Leagues follow your position among placed players this season. Small pools round each percentile cutoff up to a whole player.</li>
          <li>Meteorite requires a top-five position, 20 rated matches and 80% average accuracy. Accuracy means round points earned out of the points available, including missed rounds. It is not win rate or remaining health.</li>
          <li>Your league can change when other players move past you. Rating ties are ordered by games played, then a stable player ID.</li>
        </ul>
      </details>
    </main>
  );
}
