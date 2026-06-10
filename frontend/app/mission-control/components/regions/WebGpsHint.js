'use client';

/**
 * WebGpsHint - the honest app card
 *
 * Bridge instrument only. Field GPS belongs in the app; this card says
 * so without blocking anyone. Store links come from env so shipping
 * the app is a config change, not a code change. Until then a quiet
 * escape hatch lets a determined web searcher track with the screen on.
 */

import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '';
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';
const HAS_STORE_LINKS = !!(APP_STORE_URL || PLAY_STORE_URL);

export default function WebGpsHint({ missionId, onTrackAnyway }) {
  const dismissKey = missionId ? `mc_gpshint_${missionId}` : null;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return dismissKey ? !!localStorage.getItem(dismissKey) : false;
    } catch (e) {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      if (dismissKey) localStorage.setItem(dismissKey, '1');
    } catch (e) {}
  };

  return (
    <div className="rounded-2xl border-2 border-slate-700 bg-slate-800/60 p-3.5 relative">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
          <Smartphone size={18} className="text-flash-300" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Searching on foot?</p>
          {HAS_STORE_LINKS ? (
            <>
              <p className="text-xs text-slate-400 mt-0.5">
                The app tracks your search path with GPS, even with the screen off.
              </p>
              <div className="flex gap-2 mt-2">
                {APP_STORE_URL && (
                  <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-flash-400 text-midnight-950 text-xs font-bold hover:bg-flash-300 transition">
                    App Store
                  </a>
                )}
                {PLAY_STORE_URL && (
                  <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-flash-400 text-midnight-950 text-xs font-bold hover:bg-flash-300 transition">
                    Google Play
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">
              GPS field mode ships with our mobile app. For now, report sightings and share from here.
            </p>
          )}
          {onTrackAnyway && (
            <button
              type="button"
              onClick={onTrackAnyway}
              className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300 transition mt-2"
            >
              Track my walk anyway (screen must stay on)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
