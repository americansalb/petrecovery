'use client';

/**
 * On duty, off duty: one switch for a member of the force. On duty for
 * the next 12 hours, a sighting of one of the force's pets, a block that
 * frees up and a need that fits wake this person's phone; off duty, only
 * the bell and the digest. Duty ends by itself at the hour shown.
 * POST /api/rescue-forces/[id]/duty (app/lib/duty.js).
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

function untilText(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? '' : `${d.toLocaleDateString('en-US', { weekday: 'short' })} `}${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

export default function DutySwitch({ forceId, onDutyUntil, onChanged, className = '' }) {
  const [until, setUntil] = useState(onDutyUntil || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const on = Boolean(until);

  useEffect(() => setUntil(onDutyUntil || null), [onDutyUntil]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/duty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: on ? 0 : 12 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That did not go through. Try again in a moment.');
      setUntil(data.onDutyUntil || null);
      onChanged?.(data.onDutyUntil || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mb-2.5 lg:mb-2 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={busy}
        className={`flex min-h-[44px] w-full items-center gap-3 rounded-[14px] border-2 px-3 py-2 text-left transition disabled:opacity-60 lg:w-auto ${
          on ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 bg-white text-midnight-900 hover:border-midnight-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-flash-400' : 'bg-midnight-300'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full transition ${on ? 'left-[22px] bg-midnight-900' : 'left-0.5 bg-white'}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight">
            {busy ? <Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> : on ? `On duty until ${untilText(until)}` : 'Off duty'}
          </span>
          <span className={`block text-xs leading-snug ${on ? 'text-midnight-200' : 'text-midnight-500'}`}>
            {on ? 'A sighting or a free block near you wakes your phone.' : 'Go on duty and a sighting wakes your phone.'}
          </span>
        </span>
      </button>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
