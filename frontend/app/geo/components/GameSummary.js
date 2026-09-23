'use client';

/**
 * The end of a game: the total, every round, and three ways to share
 * it: copy the text, the system share sheet, or a link to the same
 * places for someone else to try.
 */

import { useState } from 'react';
import Card from './ui/Card';
import Link from 'next/link';
import { Check, Copy, Link2, RefreshCw, Settings2, Share2 } from 'lucide-react';
import {
  MAX_ROUND_SCORE,
  formatDistance,
  formatScore,
  ordinal,
} from '@/app/lib/geo/distance';
import { configToParams, describeConfig } from '@/app/lib/geo/modes';
import { randomSeedString } from '@/app/lib/geo/random';
import { shareText, summaryHeadline, scoreGlyph } from '@/app/lib/geo/share';
import KeepThis from './KeepThis';
import RankEmblem from './RankEmblem';
import { useCountUp } from '../lib/countUp';

function useCopy() {
  const [copied, setCopied] = useState('');
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  return [copied, copy];
}

/**
 * What a finished ranked set did to the rating.
 *
 * A number moving is the whole reward, so it is said plainly: where the
 * rating went, what it was beaten against, and how many placement games
 * are left before the number becomes a rank.
 */
function RankedResult({ rated }) {
  if (!rated) return null;
  const up = rated.delta >= 0;
  return (
    <div
      className="pe-solo-rating mt-4"
      data-ranked-result
    >
      <RankEmblem tier={rated.provisional ? null : rated.tier} />
      <p className="text-sm font-semibold text-pe-fg">
        {rated.provisional ? 'Placement in progress' : rated.tier ? `${rated.tier} league` : 'Rating updated'}
      </p>
      <p className="mt-1 text-sm text-pe-muted">
        {rated.field.players
          ? `You scored ${formatScore(rated.total)} against ${formatScore(rated.field.total)}, the average of ${rated.field.players} other ${rated.field.players === 1 ? 'player' : 'players'} on these five.`
          : `You scored ${formatScore(rated.total)}. Nobody else has finished this hour yet, so you were set against par.`}
      </p>
      <p className="mt-2 text-lg font-bold tabular-nums">
        <span className={up ? 'text-pe-good' : 'text-pe-bad'}>
          {up ? '+' : ''}
          {Math.round(rated.delta)} rating
        </span>
        <span className="ml-2 text-sm font-medium text-pe-muted">
          now {Math.round(rated.after)}
        </span>
      </p>
      {rated.provisional ? (
        <p className="mt-1 text-sm text-pe-muted">
          {rated.placements} more {rated.placements === 1 ? 'game' : 'games'} to
          be placed.
        </p>
      ) : null}
    </div>
  );
}

/** The shared board under a finished daily or cup: your place, and the top of it. */
function DailyBoard({ daily, cup = false }) {
  if (!daily) return null;
  const you = daily.you;
  const what = cup ? "this week's ten" : "today's five";
  return (
    <Card pad="sm" className="mt-4">
      <p className="text-sm font-semibold text-pe-fg">
        {cup ? "This week's board" : "Today's board"}
      </p>
      <p className="mt-1 text-sm text-pe-muted">
        {you?.rank
          ? `You are ${ordinal(you.rank)} of ${daily.finished} who finished ${what}.`
          : you
            ? `Your ${you.rounds} of ${daily.rounds} rounds are in.`
            : `${daily.finished} finished ${what}. Your rounds count once this browser has a profile.`}
        {daily.players > daily.finished
          ? ` ${daily.players - daily.finished} more still playing.`
          : ''}
        {cup ? ' Prizes go out when the week ends.' : ''}
      </p>
      {daily.board?.length ? (
        <ol className="mt-2 space-y-0.5 text-sm">
          {daily.board.slice(0, 5).map((row) => (
            <li key={row.profileId} className="flex items-center gap-2">
              <span className="w-6 tabular-nums text-pe-subtle">{row.rank}</span>
              <span className="flex-1 truncate">{row.name}</span>
              <span className="font-semibold tabular-nums text-pe-warm">
                {formatScore(row.total)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}

/**
 * The middle column of a round's row. A Not Earth round has no distance
 * to print, and neither has a round the player threw away by calling it
 * (app/lib/geo/notEarth.js).
 */
function roundNote(round) {
  if (round.notEarth) return round.score > 0 ? 'called it' : 'missed it';
  if (round.calledNotEarth) return 'wrong call';
  if (round.timedOut) return 'no guess';
  return formatDistance(round.distanceKm);
}

export default function GameSummary({
  summary,
  code,
  config,
  regionLabel,
  best,
  daily = null,
  rated = null,
  points = null,
  onPlayAgain,
  resumeUrl,
  countryName,
}) {
  const [copied, copy] = useCopy();
  const shownTotal = useCountUp(summary.total, { key: code, durationMs: 900 });
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/geo/share?s=${encodeURIComponent(code)}`;
  const challengeUrl = `${origin}/geo/play?${configToParams(config).toString()}`;
  const text = shareText(summary, shareUrl, { regionLabel });
  const isStreak = config.mode === 'streak';
  const max = summary.rounds.length * MAX_ROUND_SCORE;
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const systemShare = async () => {
    try {
      await navigator.share({ title: 'Probably Earth', text, url: shareUrl });
    } catch {
      /* dismissed */
    }
  };

  const shared = config.mode === 'daily' || config.mode === 'cup';
  const newSeedUrl = `/geo/play?${configToParams({ ...config, seed: shared ? config.seed : randomSeedString() }).toString()}&replay=${randomSeedString()}`;

  return (
    <div className="geo-reveal-panel pe-solo-finish absolute inset-x-0 bottom-0 top-auto z-40 max-h-[62%] overflow-y-auto border-t border-pe-line bg-pe-canvas/95 text-pe-fg shadow-2xl backdrop-blur sm:max-h-[58%] lg:left-1/2 lg:top-0 lg:max-h-none lg:border-l lg:border-t-0 lg:pt-16">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-pe-muted">
              {describeConfig(config, { regionLabel })}
            </p>
            <p className="pe-score-total mt-1 text-4xl font-bold tabular-nums text-pe-warm">
              {isStreak
                ? `Streak of ${summary.streak}`
                : formatScore(Math.round(shownTotal))}
              {!isStreak ? (
                <span className="ml-2 text-lg font-medium tracking-normal text-pe-muted">
                  of {formatScore(max)}
                </span>
              ) : null}
            </p>
            {points && (points.earned > 0 || points.badges?.length) ? (
              <p className="mt-1 text-sm text-pe-warm">
                {points.earned > 0
                  ? `+${points.earned} points this game, ${formatScore(points.balance)} in all.`
                  : ''}
                {points.badges?.length
                  ? ` New ${points.badges.length === 1 ? 'badge' : 'badges'}: ${points.badges.map((b) => `${b.flag} ${b.name}`).join(', ')}.`
                  : ''}{' '}
                <Link
                  href="/geo/me"
                  className="font-medium text-pe-accent-fg hover:underline"
                >
                  Spend them on a pin or a name colour
                </Link>
              </p>
            ) : null}
            {best ? (
              <p className="mt-1 text-sm text-pe-muted">
                {(isStreak ? summary.streak : summary.total) >= best
                  ? 'Your best for these settings.'
                  : `Your best for these settings: ${isStreak ? best : formatScore(best)}.`}
              </p>
            ) : null}
          </div>
          {!isStreak ? (
            <p className="text-2xl tracking-wider">
              {summary.rounds.map((r) => scoreGlyph(r.score)).join('')}
            </p>
          ) : null}
        </div>

        {/* One column of equal buttons on a phone: side by side they
            wrapped to two rows of two different widths. */}
        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href={newSeedUrl}
            onClick={onPlayAgain}
            className="ui-btn ui-btn--primary ui-btn--lg pe-button pe-button--primary"
          >
            <RefreshCw size={17} />
            {shared ? 'Play these places again' : 'Play again'}
          </Link>
          <Link href="/geo" className="ui-btn ui-btn--secondary ui-btn--lg">
            Choose another game
          </Link>
        </div>

        {/* The rounds come in one after another, after the total has
            started to climb, so the list reads as the game being told
            back rather than a table that was always there. */}
        <Card
          as="ol"
          pad="none"
          className="pe-recap-list pe-stagger mt-5 divide-y divide-pe-line bg-transparent"
        >
          {summary.rounds.map((round, i) => (
            <li key={i} style={{ '--i': i + 2 }} className="flex items-center gap-2 px-3 py-2 text-sm sm:gap-3">
              <span className="w-5 shrink-0 text-pe-subtle sm:w-6">{i + 1}</span>
              <span className="w-7 shrink-0 text-lg leading-none">
                {round.country?.flag || ''}
              </span>
              {/* Wraps rather than truncating: on a phone the fixed
                  columns cut "United States" to "United St...". */}
              <span className="min-w-0 flex-1 break-words">
                {round.country?.name || 'Unknown'}
                {isStreak && !round.correct && round.guessCountry ? (
                  <span className="text-pe-muted">
                    {' '}
                    (you said {countryName?.(round.guessCountry) || round.guessCountry})
                  </span>
                ) : null}
              </span>
              {isStreak ? (
                <span
                  className={
                    round.correct
                      ? 'font-semibold text-pe-good'
                      : 'font-semibold text-pe-bad'
                  }
                >
                  {round.correct ? 'Right' : 'Miss'}
                </span>
              ) : (
                <>
                  <span className="w-[4.75rem] shrink-0 text-right text-pe-muted sm:w-24">
                    {roundNote(round)}
                  </span>
                  <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-pe-warm sm:w-16">
                    {formatScore(round.score)}
                  </span>
                </>
              )}
            </li>
          ))}
        </Card>

        <DailyBoard daily={daily} cup={config.mode === 'cup'} />
        <RankedResult rated={rated} />

        {/* The account ask, at the one moment there is something worth
            keeping. It renders for guests only and gates nothing: the
            score above is already recorded in this browser. */}
        <KeepThis returnTo={resumeUrl || `/geo/share?s=${encodeURIComponent(code)}`} />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy('text', text)}
            className="ui-btn ui-btn--secondary"
          >
            {copied === 'text' ? (
              <Check className="h-4 w-4 text-pe-good" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied === 'text' ? 'Copied' : 'Copy result'}
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={systemShare}
              className="ui-btn ui-btn--secondary"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          ) : null}
          {config.seed ? (
            <button
              type="button"
              onClick={() => copy('challenge', challengeUrl)}
              className="ui-btn ui-btn--secondary"
              title="A link that plays these exact places"
            >
              {copied === 'challenge' ? (
                <Check className="h-4 w-4 text-pe-good" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {copied === 'challenge' ? 'Link copied' : 'Challenge a friend'}
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-pe-subtle">
          Result page:{' '}
          <a
            href={shareUrl}
            className="underline decoration-pe-line-strong hover:text-pe-fg"
          >
            {shareUrl.replace(/^https?:\/\//, '').slice(0, 60)}...
          </a>
        </p>
      </div>
    </div>
  );
}
