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
import { useCountUp } from '../lib/countUp';
import { REVEAL } from '../lib/motion';

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
  // The score arrives rather than appears: it is the thing you earned,
  // and counting it up is the moment. The key is the round, so the next
  // reveal counts from zero instead of from the last one's total.
  //
  // The distance does NOT count. It is a fact, not an achievement, and
  // counting it from zero puts "1 m away" on screen for a frame, which
  // at a glance reads as a perfect guess on a round that missed by
  // fifteen thousand kilometres.
  //
  // It climbs on the same clock as the line on the map (REVEAL): it
  // starts when the line leaves the guess and lands when the line
  // reaches the answer, so the number and the distance are one event.
  // It used to count for 700ms from the instant the panel appeared,
  // which was over before the eye had found the panel.
  const shownScore = useCountUp(result.score, { key: roundNumber, delayMs: REVEAL.lineDelayMs, durationMs: REVEAL.lineMs });
  const landDelay = `${REVEAL.landMs}ms`;
  const country = result.answer?.country;
  const place = [result.answer?.city, country?.name].filter(Boolean).join(', ');
  const isNotEarth = result.kind === 'not-earth';
  // Not Earth called on an ordinary round. The round is gone, and the
  // player is told plainly why rather than shown a score of zero with
  // no explanation.
  const wrongCall = !isNotEarth && Boolean(result.calledNotEarth);

  return (
    <div className="geo-reveal-panel pe-solo-reveal absolute inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-white/10 bg-ocean-950/95 p-4 text-white shadow-2xl backdrop-blur sm:p-6">
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
                {formatScore(Math.round(shownScore))} <span className="text-base font-medium text-white/60">of {formatScore(MAX_ROUND_SCORE)}</span>
              </p>
              <div className="pe-score-meter" role="meter" aria-label="Round score" aria-valuemin={0} aria-valuemax={MAX_ROUND_SCORE} aria-valuenow={result.score}><span style={{width:`${Math.max(0,Math.min(100,result.score/MAX_ROUND_SCORE*100))}%`, animationDelay: `${REVEAL.lineDelayMs}ms`, animationDuration: `${REVEAL.lineMs}ms`}} /></div>
              <p className="geo-reveal-land mt-1 text-white/80" style={{ animationDelay: landDelay }}>
                {wrongCall
                  ? 'That was Earth. No points this round.'
                  : result.timedOut
                    ? 'Out of time.'
                    : Number.isFinite(result.distanceKm)
                      ? `${formatDistance(result.distanceKm)} away`
                      : ''}
              </p>
              {points && (points.earned > 0 || points.badge) ? (
                <p className="geo-reveal-land mt-1 text-sm text-clay-300" style={{ animationDelay: landDelay }}>
                  {points.earned > 0 ? `+${points.earned} points` : ''}
                  {/* What the total is made of, not more on top of it:
                      "+12 points +2 round, +10 first of the day" read
                      as 24. Each award lands after the one before it,
                      so the line reads as an itemisation. */}
                  {points.lines?.length > 1 ? (
                    <span className="text-white/60">
                      {' ('}
                      {points.lines.map((line, i) => (
                        <span key={`${line.reason}:${i}`} className="geo-award" style={{ animationDelay: `${REVEAL.landMs + 160 + i * 90}ms` }}>
                          {i ? ' + ' : ''}
                          {line.amount} {line.reason.toLowerCase()}
                        </span>
                      ))}
                      {')'}
                    </span>
                  ) : null}
                  {points.badge ? `${points.earned > 0 ? '. ' : ''}New badge: ${points.badge.flag} ${points.badge.name}` : ''}
                </p>
              ) : null}
              {points && points.allowed === false ? <p className="mt-1 text-xs text-white/60">Points paused for today: the first 50 rounds earn.</p> : null}
              <p className="geo-reveal-land mt-1 flex items-center gap-2 text-sm text-white/70" style={{ animationDelay: landDelay }}>
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
          className="pe-button pe-button--primary flex shrink-0 items-center justify-center gap-2 rounded-xl bg-clay-400 px-6 py-3 text-base font-bold text-ocean-950 transition hover:bg-clay-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          autoFocus
        >
          {isLast ? 'See results' : isStreak ? 'Next country' : `Round ${roundNumber + 1} of ${roundsTotal}`}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
