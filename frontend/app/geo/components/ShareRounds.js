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
        <p className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-ocean-900/60 px-4 py-3 text-sm text-white/70">
          <span className="flex-1">The places are hidden until you have played this one yourself.</span>
          <button type="button" onClick={() => setRevealed(true)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5">
            Show them anyway
          </button>
        </p>
      ) : null}
      <Card as="ol" pad="none" className={`${hideUntilPlayed && !revealed ? 'mt-3' : 'mt-6'} divide-y divide-white/10 bg-transparent bg-ocean-900/60`}>
        {rounds.map((round, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-6 text-white/40">{i + 1}</span>
            <span className="w-7 text-lg leading-none">{revealed ? round.flag || '' : ''}</span>
            <span className="flex-1 truncate">{revealed ? round.name || 'Somewhere' : 'Hidden'}</span>
            {isStreak ? (
              <span className={round.correct ? 'font-semibold text-green-400' : 'font-semibold text-red-300'}>{round.correct ? 'Right' : 'Miss'}</span>
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
