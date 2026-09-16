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
import { Minus, Plus, RotateCcw, X, Map as MapIcon } from 'lucide-react';
import { formatScore } from '@/app/lib/geo/distance';
import { MODES, configToParams } from '@/app/lib/geo/modes';

export function Compass({ heading = 0 }) {
  return (
    <div
      className="relative h-14 w-14 rounded-full border border-white/20 bg-ocean-900/80 shadow-lg backdrop-blur"
      aria-label={`Facing ${Math.round(heading)} degrees`}
      role="img"
    >
      <div className="absolute inset-0 transition-transform duration-150" style={{ transform: `rotate(${-heading}deg)` }}>
        <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[10px] font-bold text-clay-500">N</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-white/60">S</span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/60">E</span>
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/60">W</span>
        <div className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-full rounded bg-clay-500" />
        <div className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 rounded bg-white/40" />
      </div>
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
    </div>
  );
}

export function TimerRing({ secondsLeft, total }) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, secondsLeft / total)) : 0;
  const urgent = secondsLeft <= 10;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const label = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}`;
  return (
    <div className={`flex items-center gap-2 ${urgent ? 'text-red-200' : 'text-white'}`}>
      <svg width="24" height="24" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="none" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke={urgent ? '#f87171' : '#facc15'}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span className="min-w-[2ch] text-sm font-semibold tabular-nums">{label}</span>
    </div>
  );
}

const pill = 'rounded-full border border-white/20 bg-ocean-900/80 shadow-lg backdrop-blur';
const iconButton = `${pill} flex h-11 w-11 items-center justify-center text-white transition hover:bg-ocean-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 disabled:opacity-40`;

/** A small label above a value, which is the only shape the top row uses. */
function Stat({ label, children }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[11px] uppercase tracking-wide text-white/55">{label}</span>
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
  heading,
  canZoom,
  canReturn = true,
  canPan = true,
  onReturn,
  onZoom,
  mobileMapOpen,
  onToggleMobileMap,
  notice,
  showMapControls,
}) {
  const isStreak = config.mode === 'streak';
  const modeLabel = MODES[config.mode]?.label || MODES[config.mode]?.short || config.mode;
  // Back to the settings this game was started from, rather than to a
  // blank form: the one thing a player wants from a mode name is a
  // different one.
  const changeHref = `/geo/setup?${configToParams({ ...config, seed: '' }).toString()}`;
  const timed = config.time > 0 && Number.isFinite(secondsLeft);

  return (
    <>
      {/* Top left: what you are playing */}
      <div className="pointer-events-none absolute left-3 top-3 z-30 sm:left-4 sm:top-4">
        <div className={`pointer-events-auto flex items-center gap-3 py-1.5 pl-4 pr-1.5 ${pill}`}>
          <Stat label={isStreak ? 'Country streak' : modeLabel}>
            <span className="text-sm font-semibold text-white">{isStreak ? `Streak ${streak}` : 'City streets'}</span>
          </Stat>
          <Link href={changeHref} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-ocean-100 transition hover:bg-white/20">
            Change
          </Link>
        </div>
      </div>

      {/* Top centre: which round this is. Hidden on a phone, where the
          top row has no room for three things and the round number is
          the least urgent of them. */}
      {!isStreak && roundsTotal ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 hidden -translate-x-1/2 sm:top-4 sm:block">
          <div className={`px-6 py-3 text-sm font-semibold text-white ${pill}`}>
            Round {roundNumber} of {roundsTotal}
          </div>
        </div>
      ) : null}

      {/* Top right: the score, the clock, and the way out */}
      <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-2 sm:right-4 sm:top-4">
        {!isStreak ? (
          <div className={`pointer-events-auto flex items-center gap-4 px-5 py-2 ${pill}`}>
            <Stat label="Score">
              <span className="text-lg font-semibold tabular-nums text-clay-300" data-geo-score>
                {formatScore(score)}
              </span>
            </Stat>
            {timed ? <div className="border-l border-white/15 pl-4">
              <TimerRing secondsLeft={secondsLeft} total={config.time} />
            </div> : null}
          </div>
        ) : timed ? (
          <div className={`pointer-events-auto px-5 py-3 ${pill}`}>
            <TimerRing secondsLeft={secondsLeft} total={config.time} />
          </div>
        ) : null}
        <Link href="/geo" className={`pointer-events-auto ${iconButton}`} aria-label="Leave the game" title="Leave the game">
          <X className="h-5 w-5" />
        </Link>
      </div>

      {/* A round with something to say about how it was found */}
      {notice ? (
        <div className="pointer-events-none absolute left-1/2 top-20 z-30 max-w-[90vw] -translate-x-1/2 rounded-full border border-white/15 bg-ocean-900/85 px-4 py-1.5 text-center text-xs text-white/80 shadow-lg backdrop-blur sm:top-24 sm:text-sm">
          {notice}
        </div>
      ) : null}

      {/* Bottom left: looking around, and what the keys do */}
      <div className="pointer-events-none absolute bottom-16 left-3 z-30 flex flex-col items-start gap-3 sm:left-4">
        <div className="pointer-events-auto">
          <Compass heading={heading} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {canReturn ? (
            <button type="button" onClick={onReturn} className={iconButton} aria-label="Return to start" title="Return to start (R)">
              <RotateCcw className="h-5 w-5" />
            </button>
          ) : null}
          {canZoom ? (
            <>
              <button type="button" onClick={() => onZoom(1)} className={iconButton} aria-label="Zoom in" title="Zoom in">
                <Plus className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onZoom(-1)} className={iconButton} aria-label="Zoom out" title="Zoom out">
                <Minus className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>
        {/* One line, and only the part that is true for this game: an
            NMPZ round that says "drag to look around" is a lie. */}
        <p className="hidden max-w-[10rem] text-xs leading-snug text-sand-300/80 sm:block">
          {canPan ? 'Drag to look around. R goes back to where you started.' : 'One view, no looking around. That is the format.'}
        </p>
      </div>

      {/* The map, on a phone, where it lives behind a button. The size
          controls are on the card itself, next to what they change. */}
      {showMapControls ? (
        <div className="pointer-events-auto absolute bottom-16 right-3 z-30 flex items-center gap-2 sm:hidden">
          <button type="button" onClick={onToggleMobileMap} className={`${pill} flex h-12 items-center gap-2 px-4 text-sm font-semibold text-white`} aria-expanded={mobileMapOpen}>
            <MapIcon className="h-5 w-5" />
            {mobileMapOpen ? 'Hide map' : 'Map'}
          </button>
        </div>
      ) : null}
    </>
  );
}
