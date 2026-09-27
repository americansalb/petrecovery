'use client';

/**
 * A search party: when it meets, where, who is going, and "I am going".
 * Drawn inside the post in a force's Discussion and on the pet's page.
 *
 * Saying yes or no POSTs { going } to
 * /api/rescue-forces/[id]/posts/[postId]/going, which is for members of
 * the force. For anyone else, `onJoin` makes "I am going" a way to join
 * first, and `placeNote` stands where the meeting place would be: where a
 * party meets is for members, like the post it comes from.
 *
 * `party` is { id, at, place, goingCount, goingNames, iAmGoing }.
 */

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

/** "Saturday, 9 am", "Sunday, 2:30 pm". */
export function partyWhen(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const h = d.getHours();
  const m = d.getMinutes();
  return `${day}, ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

export default function SearchPartyCard({ party, forceId, canGo, onJoin, joinBusy = false, placeNote, heading, onChanged, className = '' }) {
  const [going, setGoing] = useState(Boolean(party.iAmGoing));
  const [count, setCount] = useState(party.goingCount || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const at = new Date(party.at);
  const over = at.getTime() < Date.now() - 3 * 3600e3;

  // The parent may load the party again (after the viewer joins the force).
  useEffect(() => {
    setGoing(Boolean(party.iAmGoing));
    setCount(party.goingCount || 0);
  }, [party.iAmGoing, party.goingCount]);

  async function set(next) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/posts/${party.id}/going`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ going: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That did not go through. Try again.');
      setGoing(data.going);
      setCount(data.goingCount);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const names = party.goingNames || [];
  const who =
    count === 0
      ? 'Nobody has said yet'
      : `${count} going${names.length ? `: ${names.slice(0, 3).join(', ')}${count > 3 ? ' and more' : ''}` : ''}`;

  return (
    <div className={`flex gap-3 rounded-2xl bg-midnight-50 p-3 ring-1 ring-midnight-200 ${className}`}>
      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white ring-1 ring-midnight-200" aria-hidden="true">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-red-700">
          {at.toLocaleDateString('en-US', { weekday: 'short' })}
        </span>
        <span className="text-xl font-extrabold leading-none text-midnight-900">{at.getDate()}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-wide text-midnight-500">Search party</p>
        {heading && <p className="font-bold text-midnight-900">{heading}</p>}
        <p className={heading ? 'text-[15px] font-semibold text-midnight-800' : 'font-bold text-midnight-900'}>{partyWhen(party.at)}</p>
        {party.place ? (
          <p className="text-[15px] text-midnight-700">{party.place}</p>
        ) : (
          placeNote && <p className="text-sm text-midnight-600">{placeNote}</p>
        )}
        <p className="mt-1 text-sm text-midnight-600">{who}</p>
        {!over && canGo && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {going ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-midnight-900">
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  You are going
                </span>
                <button
                  type="button"
                  onClick={() => set(false)}
                  disabled={busy}
                  className="text-sm font-semibold text-midnight-600 underline underline-offset-4 hover:text-midnight-900 disabled:opacity-60"
                >
                  I can&apos;t go after all
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => set(true)}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-flash-400 px-4 text-sm font-bold text-midnight-900 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                I am going
              </button>
            )}
          </div>
        )}
        {!over && !canGo && onJoin && (
          <button
            type="button"
            onClick={onJoin}
            disabled={joinBusy}
            className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-flash-400 px-4 text-sm font-bold text-midnight-900 disabled:opacity-60"
          >
            {joinBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            I am going
          </button>
        )}
        {over && <p className="mt-1 text-sm font-semibold text-midnight-500">This search party is over.</p>}
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
