'use client';

/**
 * One need, as a force's Needs tab and a pet's page show it: what needs
 * doing, how many people it takes and who is on it, and the buttons: "I
 * will do it", then "Done" or "I can't after all". The caller posts the
 * action (/api/rescue-forces/[id]/needs/[needId], app/lib/forceNeeds.js
 * has the rules); this only draws it.
 *
 * `face` is the picture on the left (the Needs tab shows the pet), `meta`
 * the words before who is on it. `spinning` is the action in flight for
 * this need ('take' or 'done').
 */

import { Check, Loader2 } from 'lucide-react';

/** Who is on it, in words: "Nobody yet, 3 needed", "2 of 4 people". */
export function peopleLine(n) {
  if (n.peopleNeeded === 1) {
    if (n.mine) return '';
    return n.taken === 0 ? 'Nobody on it yet' : 'Someone is on it';
  }
  if (n.taken === 0) return `Nobody yet, ${n.peopleNeeded} needed`;
  return `${n.taken} of ${n.peopleNeeded} people`;
}

export default function NeedCard({ need: n, face = null, meta = [], working = false, spinning = null, error = '', onAct, takeDisabled = false }) {
  const full = n.taken >= n.peopleNeeded && !n.mine;
  const line = [...meta, peopleLine(n)].filter(Boolean).join(' · ');

  return (
    <li
      className={`rounded-2xl border-2 bg-white p-3.5 ${
        n.mine === 'on' ? 'border-midnight-900' : n.byOwner ? 'border-flash-400' : 'border-flash-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {face}
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug text-midnight-900">{n.title}</p>
          {line && <p className="mt-0.5 text-sm text-midnight-600">{line}</p>}
          {n.byOwner && (
            <span className="mt-1 inline-block rounded-full bg-flash-100 px-2 py-0.5 text-xs font-bold text-flash-900">
              Asked by the owner
            </span>
          )}
          {n.details && <p className="mt-1.5 whitespace-pre-line text-sm text-midnight-700">{n.details}</p>}
        </div>
      </div>

      <div className="mt-3">
        {n.mine === 'on' ? (
          <div>
            <p className="text-sm font-semibold text-midnight-800">You are on it. Tap Done when you finish.</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => onAct('done')}
                disabled={working}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-midnight-900 px-5 font-bold text-white disabled:opacity-60"
              >
                {spinning === 'done' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                )}
                Done
              </button>
              <button
                type="button"
                onClick={() => onAct('drop')}
                disabled={working}
                className="text-sm font-semibold text-midnight-600 underline underline-offset-4 hover:text-midnight-900 disabled:opacity-60"
              >
                I can&apos;t after all
              </button>
            </div>
          </div>
        ) : n.mine === 'done' ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-700">
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            You did your part. It needs {n.peopleNeeded - n.done} more.
          </p>
        ) : full ? (
          <p className="text-sm font-semibold text-midnight-500">Enough people are on it.</p>
        ) : (
          <button
            type="button"
            onClick={() => onAct('take')}
            disabled={working || takeDisabled}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-flash-400 px-5 font-bold text-midnight-900 shadow-[0_2px_6px_rgba(202,138,4,0.28)] disabled:opacity-60"
          >
            {spinning === 'take' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            I will do it
          </button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
