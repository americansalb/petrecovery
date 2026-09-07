'use client';

/**
 * Everything drawn over the imagery while a round is on: round and
 * score, the timer, the exit, the compass, return-to-start and zoom,
 * the map size controls, and the one-line notice about how the spot
 * was found. Nothing here covers the bottom edge, where the imagery
 * provider's logo and copyright sit.
 */

import Link from 'next/link';
import { Minus, Plus, RotateCcw, X, Map as MapIcon } from 'lucide-react';
import { formatScore } from '@/app/lib/geo/distance';
import { MODES } from '@/app/lib/geo/modes';

export function Compass({ heading = 0 }) {
  return (
    <div
      className="relative h-14 w-14 rounded-full border border-white/20 bg-midnight-900/80 shadow-lg backdrop-blur"
      aria-label={`Facing ${Math.round(heading)} degrees`}
      role="img"
    >
      <div className="absolute inset-0 transition-transform duration-150" style={{ transform: `rotate(${-heading}deg)` }}>
        <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[10px] font-bold text-flash-400">N</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-white/60">S</span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/60">E</span>
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/60">W</span>
        <div className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-full rounded bg-flash-400" />
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
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-lg backdrop-blur ${urgent ? 'border-red-400/60 bg-red-950/70' : 'border-white/20 bg-midnight-900/80'}`}>
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
      <span className={`min-w-[2ch] text-sm font-semibold tabular-nums ${urgent ? 'text-red-200' : 'text-white'}`}>{label}</span>
    </div>
  );
}

const pill = 'rounded-full border border-white/20 bg-midnight-900/80 shadow-lg backdrop-blur';
const iconButton = `${pill} flex h-11 w-11 items-center justify-center text-white transition hover:bg-midnight-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-40`;

export default function GameHud({
  config,
  roundNumber,
  roundsTotal,
  score,
  streak,
  secondsLeft,
  heading,
  canZoom,
  onReturn,
  onZoom,
  mapSize,
  onMapSize,
  mobileMapOpen,
  onToggleMobileMap,
  notice,
  showMapControls,
}) {
  const isStreak = config.mode === 'streak';
  const modeLabel = MODES[config.mode]?.short || config.mode;

  return (
    <>
      {/* Top row */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className={`pointer-events-auto flex items-center gap-3 px-4 py-2 ${pill}`}>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-wide text-white/60">{modeLabel}</span>
            <span className="text-sm font-semibold text-white">
              {isStreak ? `Streak ${streak}` : roundsTotal ? `Round ${roundNumber} of ${roundsTotal}` : `Round ${roundNumber}`}
            </span>
          </div>
          {!isStreak ? (
            <div className="flex flex-col border-l border-white/15 pl-3 leading-tight">
              <span className="text-[11px] uppercase tracking-wide text-white/60">Score</span>
              <span className="text-sm font-semibold tabular-nums text-flash-300">{formatScore(score)}</span>
            </div>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {config.time > 0 && Number.isFinite(secondsLeft) ? <TimerRing secondsLeft={secondsLeft} total={config.time} /> : null}
          <Link href="/geo" className={`${iconButton}`} aria-label="Leave the game" title="Leave the game">
            <X className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Notice: how the spot was found */}
      {notice ? (
        <div className="pointer-events-none absolute left-1/2 top-20 z-30 max-w-[90vw] -translate-x-1/2 rounded-full border border-white/15 bg-midnight-900/85 px-4 py-1.5 text-center text-xs text-white/80 shadow-lg backdrop-blur sm:text-sm">
          {notice}
        </div>
      ) : null}

      {/* Bottom-left cluster, kept above the provider's logo */}
      <div className="pointer-events-none absolute bottom-16 left-3 z-30 flex flex-col items-start gap-2 sm:left-4">
        <div className="pointer-events-auto">
          <Compass heading={heading} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={onReturn} className={iconButton} aria-label="Return to start" title="Return to start (R)">
            <RotateCcw className="h-5 w-5" />
          </button>
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
      </div>

      {/* Map controls */}
      {showMapControls ? (
        <>
          <div className="pointer-events-auto absolute bottom-16 right-3 z-30 flex items-center gap-2 sm:hidden">
            <button type="button" onClick={onToggleMobileMap} className={`${pill} flex h-12 items-center gap-2 px-4 text-sm font-semibold text-white`} aria-expanded={mobileMapOpen}>
              <MapIcon className="h-5 w-5" />
              {mobileMapOpen ? 'Hide map' : 'Map'}
            </button>
          </div>
          <div className="pointer-events-auto absolute right-4 top-20 z-30 hidden items-center gap-1 sm:flex">
            {['small', 'medium', 'large'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onMapSize(size)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur transition ${mapSize === size ? 'border-flash-400 bg-flash-400 text-midnight-900' : 'border-white/20 bg-midnight-900/80 text-white hover:bg-midnight-800'}`}
                aria-pressed={mapSize === size}
                title={`${size} map (M cycles)`}
              >
                {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
