'use client';

/**
 * After a guess: how far, how many points, which country, and the way
 * on. The map above this panel is the shared guess map in result mode.
 */

import { ArrowRight, Flag } from 'lucide-react';
import { formatDistance, formatScore, MAX_ROUND_SCORE } from '@/app/lib/geo/distance';

function scoreWord(score) {
  if (score >= 4900) return 'Spot on.';
  if (score >= 4000) return 'Very close.';
  if (score >= 2500) return 'Right region.';
  if (score >= 1000) return 'Right part of the world.';
  if (score > 0) return 'Far off.';
  return 'No points this round.';
}

export default function RoundResult({ result, roundNumber, roundsTotal, isLast, isStreak, streak, onNext, countryName, points = null }) {
  const country = result.answer?.country;
  const place = [result.answer?.city, country?.name].filter(Boolean).join(', ');

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-white/10 bg-midnight-950/95 p-4 text-white shadow-2xl backdrop-blur sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {isStreak ? (
            <>
              <p className={`text-2xl font-bold ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
                {result.correct ? `Right. Streak ${streak}.` : `Not ${countryName || result.guessCountry || 'that'}.`}
              </p>
              <p className="mt-1 flex items-center gap-2 text-white/80">
                <Flag className="h-4 w-4 text-flash-400" />
                <span>
                  This was {country?.flag} <span className="font-semibold text-white">{place || 'an unlisted place'}</span>
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold tabular-nums text-flash-300">
                {formatScore(result.score)} <span className="text-base font-medium text-white/60">of {formatScore(MAX_ROUND_SCORE)}</span>
              </p>
              <p className="mt-1 text-white/80">
                {result.timedOut ? 'Time ran out before a guess. ' : Number.isFinite(result.distanceKm) ? `${formatDistance(result.distanceKm)} away. ` : ''}
                {scoreWord(result.score)}
              </p>
              {points && (points.earned > 0 || points.badge) ? (
                <p className="mt-1 text-sm text-flash-300">
                  {points.earned > 0 ? `+${points.earned} points` : ''}
                  {points.badge ? `${points.earned > 0 ? '. ' : ''}New badge: ${points.badge.flag} ${points.badge.name}` : ''}
                </p>
              ) : null}
              {points && points.allowed === false ? <p className="mt-1 text-xs text-white/50">Points paused for today: the first 50 rounds earn.</p> : null}
              <p className="mt-1 flex items-center gap-2 text-sm text-white/70">
                <Flag className="h-4 w-4 text-flash-400" />
                <span>
                  You were in {country?.flag} <span className="font-semibold text-white">{place || 'a place not on the country map'}</span>
                  {result.answer?.date ? <span className="text-white/50">, imagery from {result.answer.date}</span> : null}
                </span>
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onNext}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-flash-400 px-6 py-3 text-base font-bold text-midnight-900 transition hover:bg-flash-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          autoFocus
        >
          {isLast ? 'See results' : isStreak ? 'Next country' : `Round ${roundNumber + 1} of ${roundsTotal}`}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
      <p className="mx-auto mt-3 max-w-3xl text-xs text-white/40">Space or Enter continues.</p>
    </div>
  );
}
