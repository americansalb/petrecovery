'use client';

/**
 * The end of a game: the total, every round, and three ways to share
 * it: copy the text, the system share sheet, or a link to the same
 * places for someone else to try.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Link2, RefreshCw, Settings2, Share2 } from 'lucide-react';
import { formatDistance, formatScore, MAX_ROUND_SCORE } from '@/app/lib/geo/distance';
import { configToParams, describeConfig } from '@/app/lib/geo/modes';
import { randomSeedString } from '@/app/lib/geo/random';
import { shareText, summaryHeadline, scoreGlyph } from '@/app/lib/geo/share';

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

function ordinal(n) {
  const v = Number(n) || 0;
  const suffix = ['th', 'st', 'nd', 'rd'];
  const mod = v % 100;
  return `${v}${suffix[(mod - 20) % 10] || suffix[mod] || suffix[0]}`;
}

/** The shared board under a finished daily or cup: your place, and the top of it. */
function DailyBoard({ daily, cup = false }) {
  if (!daily) return null;
  const you = daily.you;
  const what = cup ? "this week's ten" : "today's five";
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{cup ? "This week's board" : "Today's board"}</p>
      <p className="mt-1 text-sm text-white/90">
        {you?.rank
          ? `You are ${ordinal(you.rank)} of ${daily.finished} who finished ${what}.`
          : you
            ? `Your ${you.rounds} of ${daily.rounds} rounds are in.`
            : `${daily.finished} finished ${what}. Your rounds count once this browser has a profile.`}
        {daily.players > daily.finished ? ` ${daily.players - daily.finished} more still playing.` : ''}
        {cup ? ' Prizes go out when the week ends.' : ''}
      </p>
      {daily.board?.length ? (
        <ol className="mt-2 space-y-0.5 text-sm">
          {daily.board.slice(0, 5).map((row) => (
            <li key={row.profileId} className="flex items-center gap-2">
              <span className="w-6 tabular-nums text-white/50">{row.rank}</span>
              <span className="flex-1 truncate">{row.name}</span>
              <span className="font-semibold tabular-nums text-flash-300">{formatScore(row.total)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <Link href="/geo" className="mt-2 inline-block text-xs text-white/60 underline decoration-white/30 hover:text-white">
        The whole board is in the lobby
      </Link>
    </div>
  );
}

export default function GameSummary({ summary, code, config, regionLabel, best, daily = null, points = null, onPlayAgain }) {
  const [copied, copy] = useCopy();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/geo/share?s=${encodeURIComponent(code)}`;
  const challengeUrl = `${origin}/geo/play?${configToParams(config).toString()}`;
  const text = shareText(summary, shareUrl, { regionLabel });
  const isStreak = config.mode === 'streak';
  const max = summary.rounds.length * MAX_ROUND_SCORE;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const systemShare = async () => {
    try {
      await navigator.share({ title: 'Where on Earth', text, url: shareUrl });
    } catch {
      /* dismissed */
    }
  };

  const shared = config.mode === 'daily' || config.mode === 'cup';
  const newSeedUrl = `/geo/play?${configToParams({ ...config, seed: shared ? config.seed : randomSeedString() }).toString()}`;

  return (
    <div className="absolute inset-x-0 bottom-0 top-auto z-40 max-h-[62%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-midnight-950/95 text-white shadow-2xl backdrop-blur sm:max-h-[58%]">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">{describeConfig(config, { regionLabel })}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-flash-300">
              {isStreak ? `Streak of ${summary.streak}` : formatScore(summary.total)}
              {!isStreak ? <span className="text-lg font-medium text-white/60"> of {formatScore(max)}</span> : null}
            </p>
            {points && (points.earned > 0 || points.badges?.length) ? (
              <p className="mt-1 text-sm text-flash-300">
                {points.earned > 0 ? `+${points.earned} points this game, ${formatScore(points.balance)} in all.` : ''}
                {points.badges?.length ? ` New ${points.badges.length === 1 ? 'badge' : 'badges'}: ${points.badges.map((b) => `${b.flag} ${b.name}`).join(', ')}.` : ''}{' '}
                <Link href="/geo/me" className="underline decoration-white/30 hover:text-white">
                  Spend them
                </Link>
              </p>
            ) : null}
            {best ? (
              <p className="mt-1 text-sm text-white/70">
                {(isStreak ? summary.streak : summary.total) >= best ? 'Your best for these settings.' : `Your best for these settings: ${isStreak ? best : formatScore(best)}.`}
              </p>
            ) : null}
          </div>
          {!isStreak ? <p className="text-2xl tracking-wider">{summary.rounds.map((r) => scoreGlyph(r.score)).join('')}</p> : null}
        </div>

        <ol className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
          {summary.rounds.map((round, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-6 text-white/50">{i + 1}</span>
              <span className="w-7 text-lg leading-none">{round.country?.flag || ''}</span>
              <span className="flex-1 truncate">
                {round.country?.name || 'Unknown'}
                {isStreak && !round.correct && round.guessCountry ? <span className="text-white/50"> (you said {round.guessCountry})</span> : null}
              </span>
              {isStreak ? (
                <span className={round.correct ? 'font-semibold text-green-400' : 'font-semibold text-red-400'}>{round.correct ? 'Right' : 'Miss'}</span>
              ) : (
                <>
                  <span className="w-24 text-right text-white/70">{round.timedOut ? 'no guess' : formatDistance(round.distanceKm)}</span>
                  <span className="w-16 text-right font-semibold tabular-nums text-flash-300">{formatScore(round.score)}</span>
                </>
              )}
            </li>
          ))}
        </ol>

        <DailyBoard daily={daily} cup={config.mode === 'cup'} />

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => copy('text', text)} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
            {copied === 'text' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            {copied === 'text' ? 'Copied' : 'Copy result'}
          </button>
          {canShare ? (
            <button type="button" onClick={systemShare} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
              <Share2 className="h-4 w-4" />
              Share
            </button>
          ) : null}
          {config.seed ? (
            <button type="button" onClick={() => copy('challenge', challengeUrl)} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10" title="A link that plays these exact places">
              {copied === 'challenge' ? <Check className="h-4 w-4 text-green-400" /> : <Link2 className="h-4 w-4" />}
              {copied === 'challenge' ? 'Link copied' : 'Challenge a friend'}
            </button>
          ) : null}
          <Link href={newSeedUrl} onClick={onPlayAgain} className="flex items-center gap-2 rounded-xl bg-flash-400 px-4 py-2.5 text-sm font-bold text-midnight-900 hover:bg-flash-500">
            <RefreshCw className="h-4 w-4" />
            {shared ? 'Play again' : 'New places, same settings'}
          </Link>
          <Link href="/geo" className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
            <Settings2 className="h-4 w-4" />
            Change settings
          </Link>
        </div>
        <p className="mt-3 text-xs text-white/40">
          Result page: <a href={shareUrl} className="underline decoration-white/30 hover:text-white">{shareUrl.replace(/^https?:\/\//, '').slice(0, 60)}...</a>
        </p>
      </div>
    </div>
  );
}
