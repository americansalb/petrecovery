'use client';

/**
 * Everything drawn over the imagery while a round is on.
 *
 * Rebuilt to the design canvas (docs/PROBABLY_EARTH_UI.md, phase 3)
 * after the founder said of the old one: "this interface is terrible,
 * UI is also confusing and not clean, I don't know where to look or
 * what to do." The answer was not more controls. It was three things,
 * each with a label, each always in the same place:
 *
 *   top left    what you are playing, and the way to change it
 *   top centre  which round this is
 *   top right   the score, the clock when there is one, and the way out
 *
 * and then one cluster bottom left for looking around, with a line of
 * words under it saying what the keys do. Everything a player acts on
 * is bottom right, where the map is. Nothing covers the bottom edge,
 * where the imagery provider's logo and copyright sit.
 */

import Link from 'next/link';
import { RotateCcw, X, Map as MapIcon } from 'lucide-react';
import { formatScore } from '@/app/lib/geo/distance';
import { REVEAL, useTween } from '../lib/motion';
import { MODES } from '@/app/lib/geo/modes';
import SaveGameButton from './SaveGameButton';

export function TimerRing({ secondsLeft, total }) {
  const fraction =
    total > 0 ? Math.max(0, Math.min(1, secondsLeft / total)) : 0;
  const urgent = secondsLeft <= 10;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const label =
    minutes > 0
      ? `${minutes}:${String(seconds).padStart(2, '0')}`
      : `${seconds}`;
  return (
    <div
      className={`pe-timer flex items-center gap-2 ${urgent ? 'text-pe-bad' : 'text-pe-fg'}`} data-urgent={urgent || undefined}
    >
      <svg width="24" height="24" viewBox="0 0 40 40" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke={urgent ? 'rgb(var(--pe-bad))' : 'rgb(var(--pe-good))'}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span
        className="min-w-[2ch] text-sm font-semibold tabular-nums"
        data-geo-clock={secondsLeft}
      >
        {label}
      </span>
    </div>
  );
}

const pill =
  'pe-hud-pill rounded-full border border-white/15 bg-pe-canvas/75 shadow-lg backdrop-blur';
const iconButton = `${pill} flex h-11 w-11 items-center justify-center text-pe-fg transition hover:bg-pe-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-pe-accent-fg disabled:opacity-40`;

/** A small label above a value, which is the only shape the top row uses. */
function Stat({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-pe-fg/60">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function GameHud({
  config,
  roundNumber,
  roundsTotal,
  score,
  streak,
  secondsLeft,
  canReturn = true,
  canPan = true,
  onReturn,
  mobileMapOpen,
  onToggleMobileMap,
  notice,
  showMapControls,
  saveUrl,
}) {
  const isStreak = config.mode === 'streak';
  const shownScore = useTween(score, { delayMs: REVEAL.lineDelayMs, durationMs: REVEAL.lineMs });
  const modeLabel =
    MODES[config.mode]?.label || MODES[config.mode]?.short || config.mode;
  const timed = config.time > 0 && Number.isFinite(secondsLeft);
  // The pill's second line is what you are playing. It named the
  // region for the continent and country modes, which are retired
  // (app/lib/geo/modes.js, RETIRED_MODES); every mode is city streets.
  const playing = 'City streets';

  return (
    <>
      {/* Top left: what you are playing */}
      <div className="pointer-events-none absolute left-3 top-3 z-30 sm:left-4 sm:top-4">
        <div
          className={`pointer-events-auto flex items-center gap-3 py-1.5 pl-4 pr-1.5 ${pill}`}
        >
          <Stat
            label={
              isStreak || !roundsTotal ? (
                isStreak ? 'Country streak' : modeLabel
              ) : (
                <>
                  {modeLabel}
                  {/* The round lives in the top centre, which a phone
                      has no room for; here it costs four characters. */}
                  <span className="sm:hidden" data-geo-round-short>
                    {' '}· {roundNumber}/{roundsTotal}
                  </span>
                </>
              )
            }
          >
            <span className="text-sm font-semibold text-white">
              {isStreak ? `Streak ${streak}` : playing}
            </span>
          </Stat>
        </div>
      </div>

      {/* Top centre: which round this is. Hidden on a phone, where the
          top row has no room for three things; there the round is a
          short "1/5" in the pill on the left. */}
      {!isStreak && roundsTotal ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 hidden -translate-x-1/2 sm:top-4 sm:block">
          <div className={`px-6 py-3 text-sm font-semibold text-white ${pill}`}>
            Round {roundNumber} of {roundsTotal}
            <div className="pe-round-progress" aria-hidden="true">
              {Array.from({ length: roundsTotal }, (_, i) => (
                <span key={i} data-complete={i < roundNumber} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Top right: the score, the clock, and the way out. The total
          climbs to its new value on the reveal's clock, landing as the
          answer's pin does, instead of jumping a second early.

          Inset from the corner, because the corner is Apple's: Look
          Around draws its compass there and cannot be told not to, and
          the way out sat on top of it. Look Around's padding can move the
          compass down, but only by changing Apple's view mid-round every
          time the controls here change height (three times a round in a
          room), so the game's controls stand clear of it instead. */}
      <div className="pointer-events-none absolute right-14 top-3 z-30 flex items-center gap-2 sm:top-4">
        {!isStreak ? (
          <div
            className={`pointer-events-auto flex items-center gap-4 px-5 py-2 ${pill}`}
          >
            {/* On a phone with a clock, the clock alone: the row has
                room for one of them beside the mode and the way out, and
                the running total is on every reveal. */}
            <Stat label="Score" className={timed ? 'hidden sm:flex' : ''}>
              <span
                className="text-lg font-semibold tabular-nums text-pe-warm"
                data-geo-score
              >
                {formatScore(Math.round(shownScore))}
              </span>
            </Stat>
            {timed ? (
              <div className="sm:border-l sm:border-white/15 sm:pl-4">
                <TimerRing secondsLeft={secondsLeft} total={config.time} />
              </div>
            ) : null}
          </div>
        ) : timed ? (
          <div className={`pointer-events-auto px-5 py-3 ${pill}`}>
            <TimerRing secondsLeft={secondsLeft} total={config.time} />
          </div>
        ) : null}
        {/* On a phone it is bottom left, beside the way back to the
            start, because the top row is full there. */}
        {saveUrl ? <SaveGameButton returnTo={saveUrl} className={`pointer-events-auto ${iconButton} hidden sm:flex`} /> : null}
        <Link
          href="/geo"
          className={`pointer-events-auto ${iconButton}`}
          aria-label="Leave the game"
          title="Leave the game"
        >
          <X className="h-5 w-5" />
        </Link>
      </div>

      {/* A round with something to say about how it was found */}
      {notice ? (
        <div className="pointer-events-none absolute left-1/2 top-20 z-30 max-w-[90vw] -translate-x-1/2 rounded-full border border-white/15 bg-pe-canvas/80 px-4 py-1.5 text-center text-xs text-pe-fg/85 shadow-lg backdrop-blur sm:top-24 sm:text-sm">
          {notice}
        </div>
      ) : null}

      {/* Bottom left: looking around, and what the keys do. Only while
          the round is on: during the reveal the imagery is behind a
          panel.

          There is no compass of ours here any more. It was drawn with a
          heading nothing ever set, so it said north whichever way the
          player faced, and Look Around draws a working one of its own. */}
      {showMapControls ? (
        <div className="pointer-events-none absolute bottom-16 left-3 z-30 flex flex-col items-start gap-3 sm:left-4">
          <div className="pointer-events-auto flex items-center gap-2">
            {canReturn ? (
              <button
                type="button"
                onClick={onReturn}
                className={iconButton}
                aria-label="Return to start"
                title="Return to start (R)"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            ) : null}
            {saveUrl ? <SaveGameButton returnTo={saveUrl} className={`${iconButton} sm:hidden`} /> : null}
          </div>
          {/* One line, and only the part that is true for this game: an
            NMPZ round that says "drag to look around" is a lie.

            It carries the same dark backing as the buttons beside it,
            because it sits on the photograph rather than on the app. As
            bare text it was styled against a dark mock and then shown
            over whatever Apple returns: on a sunlit pavement, which is
            a lot of Look Around, sand-300 at 80% over near-white is
            close to invisible. scripts/geo-contrast.js cannot catch
            this one - it composites translucent layers down to an
            opaque background, and there is no knowing what colour the
            imagery under this will be. */}
          <p className={`${pill} hidden max-w-[11rem] px-3 py-1.5 text-xs leading-snug text-pe-fg sm:block`}>
            {canPan
              ? 'Drag to look around. R goes back to where you started.'
              : 'One view, no looking around. That is the format.'}
          </p>
        </div>
      ) : null}

      {/* The map, on a phone, where it lives behind a button. The size
          controls are on the card itself, next to what they change.
          Only while the map is closed: open, it covers this button, and
          the sheet carries its own Hide map (PlayClient). */}
      {showMapControls && !mobileMapOpen ? (
        <div className="pointer-events-auto absolute bottom-16 right-3 z-30 flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={onToggleMobileMap}
            className={`${pill} flex h-12 items-center gap-2 px-4 text-sm font-semibold text-pe-fg`}
            aria-expanded={mobileMapOpen}
          >
            <MapIcon className="h-5 w-5" />
            {mobileMapOpen ? 'Hide map' : 'Map'}
          </button>
        </div>
      ) : null}
    </>
  );
}
