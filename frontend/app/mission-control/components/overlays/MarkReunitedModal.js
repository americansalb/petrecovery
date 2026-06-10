'use client';

/**
 * MarkReunitedModal - the owner closes the loop, right here
 *
 * One confirm step: how did it end, optional notes, done. Posts the
 * status flip (which notifies every active volunteer in-app) and then
 * best-effort records outcome metrics. The celebration takes it from
 * there.
 */

import { useState } from 'react';
import { X, HeartHandshake, Loader2 } from 'lucide-react';

const FOUND_METHODS = [
  { value: 'CAME_HOME', label: 'Came home on their own' },
  { value: 'FOUND_BY_OWNER', label: 'We found them searching' },
  { value: 'REUNITED', label: 'Someone brought them back' },
  { value: 'FOUND_AT_SHELTER', label: 'Found at a shelter' },
];

export default function MarkReunitedModal({ mission, onClose, onConfirm, isSaving = false, error = null }) {
  const [method, setMethod] = useState('CAME_HOME');
  const [notes, setNotes] = useState('');

  if (!mission) return null;

  return (
    <div className="fixed inset-0 z-[700] bg-midnight-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <HeartHandshake size={22} className="text-emerald-300" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">{mission.petName} is home?</h2>
              <p className="text-xs text-slate-400">This ends the mission and thanks the team.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">How did it end?</p>
        <div className="grid grid-cols-1 gap-2">
          {FOUND_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`text-left px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition ${
                method === m.value
                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the team should know? (optional)"
          rows={2}
          className="mt-3 w-full px-3.5 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 resize-none"
        />

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

        <button
          type="button"
          onClick={() => onConfirm({ resolution: method, resolutionNotes: notes.trim() || undefined })}
          disabled={isSaving}
          className="mt-4 w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-midnight-950 font-bold text-base flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={20} className="animate-spin" /> : <HeartHandshake size={20} />}
          {isSaving ? 'Spreading the news...' : `Yes, ${mission.petName} is home`}
        </button>
      </div>
    </div>
  );
}
