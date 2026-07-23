'use client';

/**
 * Inline stray-hold setting on the Animals page. One number, set once:
 * how many days this jurisdiction requires strays to be held before
 * adoption. Until it's set the portal shows no hold chips, because a
 * wrong legal number is worse than none.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { STRAY_HOLD_MAX_DAYS } from '@/app/lib/shelterStatuses';

export default function StrayHoldControl({ holdDays }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(holdDays || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/shelter/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strayHoldDays: value === '' ? null : Number(value) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <p className="text-[13px] text-midnight-400">
        Stray hold:{' '}
        {holdDays ? (
          <span className="font-medium text-midnight-600">{holdDays} {holdDays === 1 ? 'day' : 'days'}</span>
        ) : (
          <span>not set</span>
        )}
        {' · '}
        <button
          onClick={() => { setEditing(true); setValue(holdDays || ''); }}
          className="font-semibold text-midnight-600 hover:text-midnight-900 underline underline-offset-2"
        >
          {holdDays ? 'change' : 'set'}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 text-[13px] text-midnight-500">
      <label htmlFor="stray-hold-days" className="shrink-0">Hold strays for</label>
      {/* globals.css forces number inputs to width:100%; the wrapper
          fixes the track width instead of an input width utility */}
      <span className="inline-block w-16">
        <input
          id="stray-hold-days"
          type="number"
          min={1}
          max={STRAY_HOLD_MAX_DAYS}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="3"
          autoFocus
          className="border border-midnight-200 rounded-lg px-2 py-1 text-sm text-midnight-900 focus:outline-none focus:ring-2 focus:ring-flash-400"
        />
      </span>
      <span className="shrink-0">days before adoption</span>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1 bg-midnight-900 hover:bg-midnight-800 text-white font-semibold rounded-lg px-2.5 py-1 disabled:opacity-50 transition"
      >
        {busy && <Loader2 className="w-3 h-3 animate-spin" />} Save
      </button>
      <button
        type="button"
        onClick={() => { setEditing(false); setError(''); }}
        className="text-midnight-400 hover:text-midnight-700 font-medium"
      >
        Cancel
      </button>
      {error && <span className="w-full text-red-600">{error}</span>}
    </form>
  );
}
