'use client';

/**
 * Controls shared by every shelter surface that shows an animal: the
 * roster row and the animal's own page in the portal. Kept in one place
 * so a status set on the roster and a status set on the animal page are
 * the same control with the same vocabulary.
 */

import { useState } from 'react';
import { SHELTER_STATUSES, SHELTER_STATUS_LABELS } from '@/app/lib/shelterStatuses';

export const STATUS_DOT = {
  AVAILABLE: 'bg-emerald-500',
  ADOPTION_PENDING: 'bg-amber-500',
  ADOPTED: 'bg-blue-500',
  RECLAIMED: 'bg-violet-500',
};

/**
 * Status as a dot plus its name, edited through a select laid invisibly
 * over the text. `size` picks the row-scale or page-scale rendering.
 */
export function StatusControl({ pet, onChanged, size = 'row' }) {
  const [busy, setBusy] = useState(false);
  if (!pet.shelterStatus) return null;

  const change = async (e) => {
    const shelterStatus = e.target.value;
    if (shelterStatus === pet.shelterStatus) return;
    setBusy(true);
    try {
      await fetch(`/api/pets/${pet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelterStatus }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const big = size === 'page';

  return (
    <label
      className={`relative inline-flex w-fit items-center gap-1.5 font-medium text-midnight-700 hover:text-midnight-900 cursor-pointer transition focus-within:ring-2 focus-within:ring-flash-400 focus-within:ring-offset-2 rounded ${
        big ? 'text-sm border border-midnight-200 rounded-lg px-2.5 py-1.5 bg-white' : 'text-[13px]'
      } ${busy ? 'opacity-50' : ''}`}
    >
      <i className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[pet.shelterStatus] || 'bg-midnight-300'}`} />
      {SHELTER_STATUS_LABELS[pet.shelterStatus] || pet.shelterStatus}
      <svg className="w-3 h-3 text-midnight-400" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        aria-label={`Status for ${pet.name}`}
        value={pet.shelterStatus}
        onChange={change}
        disabled={busy}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {SHELTER_STATUSES.map((s) => (
          <option key={s} value={s}>{SHELTER_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </label>
  );
}
