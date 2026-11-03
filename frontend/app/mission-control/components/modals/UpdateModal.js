'use client';

/**
 * The owner tells everyone helping something: what the pet answers to,
 * where it hides, what not to do. Posts a CaseUpdate
 * (POST /api/missions/[id]/notes), which the pet's page lists under
 * "What happened" and the command rail under Activity.
 */

import { useState } from 'react';
import { X, Loader2, MessageSquare } from 'lucide-react';

const SUGGESTIONS = [
  'He comes to the sound of his squeaky ball.',
  'Food motivated: try hot dogs. Please do not chase him.',
  'She hides under cars when scared. Look low.',
];

export default function UpdateModal({ missionId, petName = 'the pet', onClose, onPosted }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function post() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/missions/${missionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not post that. Try again in a moment.');
      }
      onPosted?.(content);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[800] flex items-end justify-center bg-midnight-950/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="update-title" className="text-lg font-bold">Tell everyone helping</h2>
            <p className="mt-0.5 text-sm text-slate-400">Goes on {petName}&apos;s page, the map and the force&apos;s feed.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <label htmlFor="owner-update" className="sr-only">Your update</label>
        <textarea
          id="owner-update"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          autoFocus
          placeholder={`What helps someone find ${petName}?`}
          className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[16px] text-white placeholder:text-slate-500 focus:border-flash-400 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => setText(s)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5">
              {s}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        <button
          type="button"
          onClick={post}
          disabled={busy || !text.trim()}
          className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-flash-400 font-bold text-midnight-950 hover:bg-flash-300 disabled:opacity-60"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
          Post it
        </button>
      </div>
    </div>
  );
}
