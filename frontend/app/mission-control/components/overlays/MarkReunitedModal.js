'use client';

/**
 * The owner says the pet is home: how it ended, a note if they want to add
 * one, and the one button that ends the search. Posting it closes the
 * search for everyone who has it open.
 *
 * It is shown on the search screen (inside that screen's own palette, day
 * or night) and on the pet's page, which has no palette of its own: there
 * it brings the dark one (`palette`). Every colour is from the palette, so
 * it is held to the same contrast as the rest of the search screen, and no
 * text is smaller than 13px (__tests__/search-colors.test.js).
 */

import { useState } from 'react';
import { X, HeartHandshake, Loader2 } from 'lucide-react';

const FOUND_METHODS = [
  { value: 'CAME_HOME', label: 'Came home on their own' },
  { value: 'FOUND_BY_OWNER', label: 'We found them searching' },
  { value: 'REUNITED', label: 'Someone brought them back' },
  { value: 'FOUND_AT_SHELTER', label: 'Found at a shelter' },
];

export default function MarkReunitedModal({ mission, onClose, onConfirm, isSaving = false, error = null, palette = 'mc-dark' }) {
  const [method, setMethod] = useState('CAME_HOME');
  const [notes, setNotes] = useState('');

  if (!mission) return null;

  return (
    <div className={`${palette} fixed inset-0 z-[700] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-6`}>
      <div role="dialog" aria-modal="true" aria-label={`${mission.petName} is home?`} className="w-full max-w-md rounded-t-3xl border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] p-5 sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mc-raised)]" aria-hidden="true">
              <HeartHandshake size={22} className="text-[var(--mc-ink)]" />
            </span>
            <div>
              <h2 className="text-[19px] font-bold leading-6 text-[var(--mc-ink)]">{mission.petName} is home?</h2>
              <p className="text-[14px] font-medium leading-5 text-[var(--mc-soft)]">This ends the search for everyone who has it open.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--mc-soft)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p id="mc-home-how" className="mb-2 text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">
          How did it end?
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="mc-home-how">
          {FOUND_METHODS.map((m) => {
            const on = method === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMethod(m.value)}
                className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold leading-5 text-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
                  on ? 'border-2 border-[var(--mc-ink)] bg-[var(--mc-ground)]' : 'border border-[var(--mc-line-strong)] hover:bg-[var(--mc-raised)]'
                }`}
              >
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[var(--mc-ink)]' : 'border-[var(--mc-line-strong)]'}`} aria-hidden="true">
                  {on && <span className="h-2 w-2 rounded-full bg-[var(--mc-ink)]" />}
                </span>
                {m.label}
              </button>
            );
          })}
        </div>

        <label htmlFor="mc-home-note" className="mt-3 block text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">
          A note about how it ended, if you want to add one
        </label>
        <textarea
          id="mc-home-note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-2xl border border-[var(--mc-line-strong)] !bg-[var(--mc-ground)] px-3.5 py-2.5 text-[15px] font-medium leading-[22px] !text-[var(--mc-ink)] focus:border-[var(--mc-ink)] focus:outline-none focus:ring-2 focus:ring-flash-400"
        />

        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-[var(--mc-danger)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => onConfirm({ resolution: method, resolutionNotes: notes.trim() || undefined })}
          disabled={isSaving}
          className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-flash-600 bg-flash-400 px-4 text-[16px] font-extrabold text-[var(--mc-on-flash)] hover:bg-flash-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-ink)] disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <HeartHandshake size={20} aria-hidden="true" />}
          {isSaving ? 'One moment' : `Yes, ${mission.petName} is home`}
        </button>
      </div>
    </div>
  );
}
