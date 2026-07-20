'use client';

/**
 * FlyerPickerModal - the on-brand flyers, ready to print
 *
 * The recovery cascade renders polished flyer PDFs (big-photo, photo+details,
 * yard poster) the moment a case is reported and stores them as CaseAssets on
 * the CDN. This surfaces them: one fetch of the case's recovery kit, then a
 * row per ready flyer that opens the real PDF. Only if a case has none (older
 * cases from before the cascade, or still-generating) do we offer the basic
 * printable fallback.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, FileText, Printer, Loader2, RefreshCw } from 'lucide-react';

export default function FlyerPickerModal({ caseNumber, petName, onClose, onQuickFlyer }) {
  const [state, setState] = useState({ loading: true, flyers: [], status: null, exists: false, error: null });

  const load = useCallback(async () => {
    if (!caseNumber) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseNumber)}/recovery-kit`, { cache: 'no-store' });
      if (!res.ok) throw new Error('load_failed');
      const data = await res.json();
      setState({
        loading: false,
        flyers: data?.assets?.flyers || [],
        status: data?.status || null,
        exists: !!data?.exists,
        error: null,
      });
    } catch (e) {
      setState({ loading: false, flyers: [], status: null, exists: false, error: 'Could not load flyers.' });
    }
  }, [caseNumber]);

  useEffect(() => { load(); }, [load]);

  const { loading, flyers, status, exists, error } = state;
  const generating = exists && flyers.length === 0 && (status === 'RUNNING' || status === 'PENDING');

  return (
    <div
      className="fixed inset-0 z-[750] bg-midnight-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Print a flyer</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {petName ? `On-brand flyers for ${petName}, ready to post.` : 'On-brand flyers, ready to post.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-1 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin text-slate-500" />
            </div>
          ) : flyers.length > 0 ? (
            flyers.map((f) => (
              <a
                key={f.kind}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition group"
              >
                <span className="w-11 h-11 rounded-xl bg-flash-400/15 border border-flash-400/40 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-flash-300" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">{f.label || f.kind}</span>
                  <span className="block text-xs text-slate-500">
                    {(f.mimeType || '').includes('pdf') ? 'PDF · opens in a new tab' : 'Opens in a new tab'}
                  </span>
                </span>
                <Printer size={17} className="text-slate-500 group-hover:text-slate-300 shrink-0" />
              </a>
            ))
          ) : generating ? (
            <div className="text-center py-8 px-4">
              <Loader2 size={22} className="animate-spin text-flash-400 mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-medium">Your flyers are being prepared</p>
              <p className="text-xs text-slate-500 mt-1">On-brand flyers generate automatically. Check back in a moment.</p>
              <button
                type="button"
                onClick={load}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white hover:bg-white/10 transition"
              >
                <RefreshCw size={14} /> Check again
              </button>
            </div>
          ) : (
            <div className="text-center py-8 px-4">
              <FileText size={24} className="text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-medium">No ready-made flyer for this case yet</p>
              <p className="text-xs text-slate-500 mt-1">Generate a simple printable one now.</p>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
              {onQuickFlyer && (
                <button
                  type="button"
                  onClick={() => { onClose?.(); onQuickFlyer(); }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-flash-400 text-midnight-950 text-sm font-bold hover:bg-flash-300 transition"
                >
                  <Printer size={16} /> Make a quick flyer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
