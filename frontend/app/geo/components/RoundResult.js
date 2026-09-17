'use client';

/**
 * After a guess: how far, how many points, which country, and the way
 * on. The map above this panel is the shared guess map in result mode.
 *
 * A Not Earth round reveals something else entirely: which world that
 * was, who took the picture and when (app/lib/geo/notEarth.js).
 */

import { ArrowRight, Flag, Rocket } from 'lucide-react';
import { formatDistance, formatScore, MAX_ROUND_SCORE } from '@/app/lib/geo/distance';

/**
 * The reveal for a round that was not on this planet: what it was, and
 * the picture's provenance, which is the whole reason to use real NASA
 * panoramas rather than something invented.
 */
function NotEarthReveal({ result, points }) {
  const place = result.place;
  if (!place) return null;
  return (
    <div className="min-w-0">
      <p className={`text-2xl font-bold sm:text-3xl ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
        {result.correct ? `Called it. That was ${place.bodyInSentence}.` : `That was ${place.bodyInSentence}.`}
      </p>
      <p className="mt-1 flex items-center gap-2 text-white/85">
        <Rocket className="h-4 w-4 shrink-0 text-clay-300" />
        <span className="font-semibold">{place.title}</span>
      </p>
      <p className="mt-1 max-w-xl text-sm text-white/70">{place.note}</p>
      <p className="mt-1 text-xs text-white/45">
        {place.mission}, {place.taken}. Picture:{' '}
        <a href={place.nasaUrl} target="_blank" rel="noreferrer" className="underline hover:text-white/70">
          {place.credit}
        </a>
      </p>
      {result.correct ? (
        <p className="mt-2 text-sm font-semibold text-clay-300">
          {formatScore(result.score)} points
          {points?.badge ? `. New badge: ${points.badge.flag} ${points.badge.name}` : ''}
        </p>
      ) : (
        <p className="mt-2 text-sm text-white/60">
          {result.timedOut ? 'Time ran out.' : 'The Not Earth button was the answer. No points this round.'}
        </p>
      )}
    </div>
  );
}

export default function RoundResult({ result, roundNumber, roundsTotal, isLast, isStreak, streak, onNext, countryName, points = null }) {
  const country = result.answer?.country;
  const place = [result.answer?.city, country?.name].filter(Boolean).join(', ');
  const isNotEarth = result.kind === 'not-earth';
  // Not Earth called on an ordinary round. The round is gone, and the
  // player is told plainly why rather than shown a score of zero with
  // no explanation.
  const wrongCall = !isNotEarth && Boolean(result.calledNotEarth);

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-white/10 bg-ocean-950/95 p-4 text-white shadow-2xl backdrop-blur sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {isNotEarth ? <NotEarthReveal result={result} points={points} /> : null}
        {isNotEarth ? null : (
        <div className="min-w-0">
          {isStreak ? (
            <>
              <p className={`text-2xl font-bold ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
                {result.correct ? `Right. Streak ${streak}.` : wrongCall ? 'That was Earth.' : `Not ${countryName || result.guessCountry || 'that'}.`}
              </p>
              <p className="mt-1 flex items-center gap-2 text-white/80">
                <Flag className="h-4 w-4 text-clay-300" />
                <span>
                  This was {country?.flag} <span className="font-semibold text-white">{place || 'an unlisted place'}</span>
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold tabular-nums text-clay-300">
                {formatScore(result.score)} <span className="text-base font-medium text-white/60">of {formatScore(MAX_ROUND_SCORE)}</span>
              </p>
              <p className="mt-1 text-white/80">
                {wrongCall
                  ? 'That was Earth. No points this round.'
                  : result.timedOut
                    ? 'Out of time.'
                    : Number.isFinite(result.distanceKm)
                      ? `${formatDistance(result.distanceKm)} away`
                      : ''}
              </p>
              {points && (points.earned > 0 || points.badge) ? (
                <p className="mt-1 text-sm text-clay-300">
                  {points.earned > 0 ? `+${points.earned} points` : ''}
                  {points.lines?.length > 1 ? (
                    <span className="text-white/60"> {points.lines.map((line) => `+${line.amount} ${line.reason.toLowerCase()}`).join(', ')}</span>
                  ) : null}
                  {points.badge ? `${points.earned > 0 ? '. ' : ''}New badge: ${points.badge.flag} ${points.badge.name}` : ''}
                </p>
              ) : null}
              {points && points.allowed === false ? <p className="mt-1 text-xs text-white/60">Points paused for today: the first 50 rounds earn.</p> : null}
              <p className="mt-1 flex items-center gap-2 text-sm text-white/70">
                <Flag className="h-4 w-4 text-clay-300" />
                <span>
                  You were in {country?.flag} <span className="font-semibold text-white">{place || 'a place not on the country map'}</span>
                </span>
              </p>
            </>
          )}
        </div>
        )}
        <button
          type="button"
          onClick={onNext}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-clay-400 px-6 py-3 text-base font-bold text-ocean-950 transition hover:bg-clay-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          autoFocus
        >
          {isLast ? 'See results' : isStreak ? 'Next country' : `Round ${roundNumber + 1} of ${roundsTotal}`}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
