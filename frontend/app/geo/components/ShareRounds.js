'use client';

/**
 * The round list on a result page. For a daily challenge the countries
 * stay hidden until this browser has played that day's five (the result
 * link is how the puzzle spreads, and the countries are the puzzle);
 * anyone can show them anyway. Other games show everything.
 */

import { useEffect, useState } from 'react';
import Card from './ui/Card';
import { formatDistance, formatScore } from '@/app/lib/geo/distance';
import { getHistory } from '../lib/storage';

export default function ShareRounds({ rounds, isStreak, hideUntilPlayed = false, seed = '' }) {
  const [revealed, setRevealed] = useState(!hideUntilPlayed);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (!hideUntilPlayed) return;
    let done = false;
    try {
      done = getHistory().some((g) => g.config?.seed && g.config.seed === seed);
    } catch {
      done = false;
    }
    setPlayed(done);
    if (done) setRevealed(true);
  }, [hideUntilPlayed, seed]);

  return (
    <>
      {hideUntilPlayed && !revealed ? (
        <Card as="p" pad="sm" className="mt-6 flex flex-wrap items-center gap-3 text-sm text-pe-muted">
          <span className="flex-1">The places are hidden until you have played this one yourself.</span>
          <button type="button" onClick={() => setRevealed(true)} className="ui-btn ui-btn--secondary ui-btn--sm">
            Show them anyway
          </button>
        </Card>
      ) : null}
      <Card as="ol" pad="none" className={`${hideUntilPlayed && !revealed ? 'mt-3' : 'mt-6'} divide-y divide-pe-line`}>
        {rounds.map((round, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-6 text-pe-subtle">{i + 1}</span>
            <span className="w-7 text-lg leading-none">{revealed ? round.flag || '' : ''}</span>
            <span className="flex-1 truncate">{revealed ? round.name || 'Somewhere' : 'Hidden'}</span>
            {isStreak ? (
              <span className={round.correct ? 'font-semibold text-pe-good' : 'font-semibold text-pe-bad'}>{round.correct ? 'Right' : 'Miss'}</span>
            ) : (
              <>
                <span className="w-24 text-right text-white/60">{round.distanceKm === null ? 'no guess' : formatDistance(round.distanceKm)}</span>
                <span className="w-16 text-right font-semibold tabular-nums">{formatScore(round.score)}</span>
              </>
            )}
          </li>
        ))}
      </Card>
      {hideUntilPlayed && played ? <p className="mt-2 text-xs text-white/60">You have played this one, so the places are shown.</p> : null}
    </>
  );
}
