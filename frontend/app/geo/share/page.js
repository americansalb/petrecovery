/**
 * /geo/share?s=<code>: a finished game as a page with its own link
 * preview. The code carries everything (see app/lib/geo/share.js), so
 * this is a server page with no database and no client JavaScript.
 */

import Link from 'next/link';
import { buildShareMetadata, genericShareMetadata } from '@/app/lib/shareMetadata';
import { decodeShare, summaryHeadline, averageMissKm, scoreGlyph } from '@/app/lib/geo/share';
import { configToParams, describeConfig } from '@/app/lib/geo/modes';
import { formatDistance, formatScore, MAX_ROUND_SCORE } from '@/app/lib/geo/distance';
import { countryByCode } from '@/app/lib/geo/server/countries';
import { geoMetadataBase } from '@/app/lib/geo/server/siteBase';
import ShareRounds from '@/app/geo/components/ShareRounds';

export const dynamic = 'force-dynamic';

const LOBBY_DESCRIPTION = 'A street-level guessing game. You are dropped at a random spot with imagery, you place a pin, and points depend on how close you are.';

function readCode(searchParams) {
  const value = searchParams?.s;
  return typeof value === 'string' ? value : '';
}

function regionLabelFor(config) {
  return config.mode === 'country' ? countryByCode(config.region)?.name : undefined;
}

export async function generateMetadata({ searchParams }) {
  const code = readCode(searchParams);
  const summary = decodeShare(code);
  if (!summary) return genericShareMetadata('Where on Earth | ReunitePets', LOBBY_DESCRIPTION);
  const headline = summaryHeadline(summary);
  const avg = averageMissKm(summary);
  const description = `${describeConfig(summary.config, { regionLabel: regionLabelFor(summary.config) })}${avg !== null ? ` Average miss ${formatDistance(avg)}.` : ''}`;
  const encoded = encodeURIComponent(code);
  return {
    ...buildShareMetadata({
      title: `${headline} in Where on Earth`,
      description,
      image: `/api/geo/og?s=${encoded}`,
      imageAlt: `${headline} in Where on Earth`,
      canonical: `/geo/share?s=${encoded}`,
      index: false,
    }),
    // The card must point at whichever domain served it (docs/GEO.md)
    metadataBase: geoMetadataBase(),
  };
}

export default function GeoSharePage({ searchParams }) {
  const code = readCode(searchParams);
  const summary = decodeShare(code);

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">That result link is not one of ours</h1>
        <p className="mt-2 text-midnight-600">{LOBBY_DESCRIPTION}</p>
        <Link href="/geo" className="mt-6 inline-block rounded-xl bg-flash-400 px-6 py-3 font-bold text-midnight-900 hover:bg-flash-500">
          Play Where on Earth
        </Link>
      </div>
    );
  }

  const isStreak = summary.config.mode === 'streak';
  const regionLabel = regionLabelFor(summary.config);
  const avg = averageMissKm(summary);
  const sameParams = configToParams(summary.config).toString();
  const max = summary.rounds.length * MAX_ROUND_SCORE;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-wide text-midnight-500">Where on Earth</p>
      <h1 className="mt-1 text-4xl font-bold tabular-nums">
        {isStreak ? summaryHeadline(summary) : formatScore(summary.total)}
        {!isStreak ? <span className="text-lg font-medium text-midnight-500"> of {formatScore(max)} points</span> : null}
      </h1>
      <p className="mt-2 text-midnight-700">
        {describeConfig(summary.config, { regionLabel })}
        {avg !== null ? ` Average miss ${formatDistance(avg)}.` : ''}
        {summary.date ? ` Played ${summary.date}.` : ''}
      </p>
      {!isStreak ? <p className="mt-2 text-2xl tracking-wider">{summary.rounds.map((r) => scoreGlyph(r.score)).join('')}</p> : null}

      {/* A daily's or a cup's places are the puzzle: hidden until the reader has played it (ShareRounds). */}
      <ShareRounds
        rounds={summary.rounds.map((round) => {
          const country = round.countryCode ? countryByCode(round.countryCode) : null;
          return { flag: country?.flag || '', name: country?.name || '', distanceKm: round.distanceKm, score: round.score, correct: round.correct };
        })}
        isStreak={isStreak}
        hideUntilPlayed={summary.config.mode === 'daily' || summary.config.mode === 'cup'}
        seed={summary.config.seed || ''}
      />

      <div className="mt-6 flex flex-wrap gap-3">
        {summary.config.seed ? (
          <Link href={`/geo/play?${sameParams}`} className="rounded-xl bg-flash-400 px-5 py-3 font-bold text-midnight-900 hover:bg-flash-500">
            Play these same places
          </Link>
        ) : null}
        <Link href="/geo" className="rounded-xl border-2 border-midnight-300 px-5 py-3 font-semibold text-midnight-800 hover:bg-midnight-100">
          Play Where on Earth
        </Link>
      </div>
    </div>
  );
}
