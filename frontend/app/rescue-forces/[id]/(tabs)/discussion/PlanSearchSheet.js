'use client';

/**
 * "Plan a search": a search party in the force's Discussion, with the pet
 * it is for, when it meets, where, and a note. Members then say they are
 * going (app/components/help/SearchPartyCard.js), and the party shows on
 * the pet's page too. Posts topic SEARCH_PARTY to /api/rescue-forces/[id]/posts.
 */

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { send } from './DiscussionPost';

const CHIP =
  'inline-flex h-10 items-center rounded-full border-2 px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
const FIELD =
  'mt-1 h-11 w-full rounded-xl border-2 border-midnight-200 px-3 text-midnight-900 outline-none placeholder:text-midnight-400 focus:border-midnight-400 focus:ring-2 focus:ring-flash-400';

/** "2026-09-30T09:00" for a datetime-local field, from a local time. */
function localInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlanSearchSheet({ open, onClose, forceId, pets, onPosted }) {
  const lost = pets.filter((p) => p.status === 'lost');
  const [petId, setPetId] = useState('');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (lost.length === 1) setPetId(lost[0].id);
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ready = when && where.trim() && (!lost.length || petId);

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await send(`/api/rescue-forces/${forceId}/posts`, {
        topic: 'SEARCH_PARTY',
        caseId: petId || null,
        eventAt: new Date(when).toISOString(),
        eventPlace: where.trim(),
        content: note.trim(),
      });
      setWhen('');
      setWhere('');
      setNote('');
      setPetId('');
      onPosted();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Plan a search" maxWidth="max-w-lg">
      <form method="post" onSubmit={submit} noValidate>
        {lost.length > 0 && (
          <fieldset>
            <legend className="text-sm font-bold text-midnight-800">Which pet?</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lost.map((p) => {
                const on = petId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPetId(p.id)}
                    className={`${CHIP} ${on ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 bg-white text-midnight-700 hover:border-midnight-300'}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="party-when" className="block text-sm font-bold text-midnight-800">
              When
            </label>
            <input id="party-when" type="datetime-local" value={when} min={localInput(new Date())} onChange={(e) => setWhen(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label htmlFor="party-where" className="block text-sm font-bold text-midnight-800">
              Where to meet
            </label>
            <input
              id="party-where"
              value={where}
              maxLength={140}
              onChange={(e) => setWhere(e.target.value)}
              placeholder="Zilker Park, main parking lot"
              className={FIELD}
            />
          </div>
        </div>

        <label htmlFor="party-note" className="mt-4 block text-sm font-bold text-midnight-800">
          Anything people should know?
        </label>
        <textarea
          id="party-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What to bring, where to look, who to call."
          className="mt-1 w-full resize-y rounded-xl border-2 border-midnight-200 px-3 py-2.5 text-midnight-900 outline-none placeholder:text-midnight-400 focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="mt-3 text-sm text-midnight-500">Members see where to meet; the pet&apos;s page shows the search to everyone without the place.</p>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!ready}>
            Post the search
          </Button>
        </div>
      </form>
    </Modal>
  );
}
