'use client';

/**
 * GridHud - the board's two pieces of floating furniture.
 *
 * CoverageStrip: the shape of the search in one line ("7 of 32 blocks"),
 * top-center where the owner's eye lands after the header. Green is the
 * reward loop: watching it spread is what a shared search FEELS like.
 *
 * CellActionSheet: one card, one question, chosen by state. Tap a block
 * and it asks the one thing worth asking about that block; hold a claim
 * and it pins your job ("You're searching C4") until you finish or let
 * go. The claim flow deliberately never opens a form - a search party
 * has no time for forms.
 */

import { Check, X, Eye, RotateCcw } from 'lucide-react';

function minutesAgo(iso, now = Date.now()) {
  if (!iso) return null;
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function CoverageStrip({ searched, inProgress, total }) {
  if (!total) return null;
  const done = Math.round((searched / total) * 100);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[700] pointer-events-none">
      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-950/85 backdrop-blur border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-white tabular-nums">{searched}</span>
          <span className="text-[12px] text-slate-400">of {total} blocks searched</span>
        </div>
        <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden flex">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${done}%` }} />
          {inProgress > 0 && (
            <div
              className="h-full bg-flash-400/70"
              style={{ width: `${Math.round((inProgress / total) * 100)}%` }}
            />
          )}
        </div>
        {inProgress > 0 && (
          <span className="text-[12px] font-semibold text-flash-400">{inProgress} being walked</span>
        )}
      </div>
    </div>
  );
}

export function CellActionSheet({
  cell,
  myCell,
  onClaim,
  onRelease,
  onMarkSearched,
  onClose,
  acting,
  actionError,
  bottomOffset = 24,
  readOnly = false,
}) {
  // Selection wins while it lasts (inspecting the board mid-claim is
  // normal); with nothing selected, a held claim pins your job.
  const active = cell || myCell;
  if (!active) return null;

  const isMine = active.mine && active.status === 'IN_PROGRESS';
  const held = !isMine && active.status === 'IN_PROGRESS';
  const searched = active.status === 'SEARCHED' || active.status === 'PET_FOUND';
  const claimable = !readOnly && !isMine && !held && active.status !== 'PET_FOUND' && active.status !== 'CLOSED';

  let title;
  let sub = null;
  if (isMine) {
    title = `You're searching ${active.label}`;
    sub = `Started ${minutesAgo(active.claimedAt)} ago. Nobody else will be sent here.`;
  } else if (held) {
    title = `${active.claimedByName || 'Someone'} is searching ${active.label}`;
    sub = `Started ${minutesAgo(active.claimedAt)} ago. Pick a block nearby.`;
  } else if (searched) {
    title = `${active.label} was searched ${minutesAgo(active.searchedAt)} ago`;
    sub = 'A pet moves. A block searched hours ago is worth walking again.';
  } else if (active.status === 'NEEDS_REVISIT') {
    title = `${active.label} is worth another look`;
    sub = 'Walked once in poor conditions. Fresh eyes welcome.';
  } else {
    title = (active.priority || 0) >= 8 ? `${active.label} - start here` : `${active.label} hasn't been searched`;
    sub = (active.priority || 0) >= 8
      ? 'Close to where the trail is warmest.'
      : 'Claim it and it becomes yours to walk.';
  }

  return (
    // fixed and z-[700]: on mobile this rides ABOVE the bottom sheet
    // (z-[600]) at the screen's bottom edge - the searcher's one job on
    // top of everything, per the field design. Desktop passes an offset
    // that clears the map key instead.
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[700] w-[min(400px,calc(100vw-24px))]"
      style={{ bottom: bottomOffset }}
    >
      <div className="rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-flash-400/25 shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white leading-snug">{title}</p>
            {sub && <p className="mt-0.5 text-[12.5px] text-slate-400 leading-snug">{sub}</p>}
          </div>
          {cell && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-8 h-8 -mt-1 -mr-1 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {actionError && (
          <p role="alert" className="mt-2 text-[12.5px] text-red-400">{actionError}</p>
        )}

        {isMine ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onMarkSearched(active.id)}
              disabled={acting}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-flash-400 text-midnight-950 text-[14px] font-bold hover:bg-flash-300 transition disabled:opacity-60"
            >
              <Check size={16} strokeWidth={2.5} />
              Mark {active.label} searched
            </button>
            <button
              onClick={() => onRelease(active.id)}
              disabled={acting}
              className="h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-[13px] font-semibold hover:bg-white/10 transition disabled:opacity-60"
            >
              Let go
            </button>
          </div>
        ) : claimable ? (
          <button
            onClick={() => onClaim(active.id)}
            disabled={acting}
            className="mt-3 w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-flash-400 text-midnight-950 text-[14px] font-bold hover:bg-flash-300 transition disabled:opacity-60"
          >
            {searched ? <RotateCcw size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
            {searched ? `Search ${active.label} again` : `Claim ${active.label}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
