'use client';

/**
 * RallyRow - bring more humans
 *
 * Share, flyers, and (for owners with the ad fund) a boost. Deep links
 * like ?tab=flyer set `highlight` to pulse the row once so arriving
 * users see where they landed.
 */

import { Share2, Printer, Rocket } from 'lucide-react';

function RallyTile({ icon: Icon, label, sub, onClick, accent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] ${
        accent
          ? 'border-flash-400/60 bg-flash-400/10 hover:bg-flash-400/20'
          : 'border-slate-800 bg-slate-900 hover:border-slate-600'
      }`}
    >
      <Icon size={18} className={accent ? 'text-flash-300' : 'text-slate-300'} />
      <p className="text-sm font-bold text-white mt-1.5 truncate">{label}</p>
      <p className="text-[11px] text-slate-500 truncate">{sub}</p>
    </button>
  );
}

export default function RallyRow({ onShare, onFlyer, onBoost, showBoost = false, highlight = false }) {
  return (
    <div className={`flex gap-2 ${highlight ? 'animate-pulse rounded-2xl ring-2 ring-flash-400 ring-offset-2 ring-offset-slate-900' : ''}`}>
      <RallyTile icon={Share2} label="Share" sub="Every share is a searcher" onClick={onShare} accent />
      <RallyTile icon={Printer} label="Flyer" sub="Print and post" onClick={onFlyer} />
      {showBoost && (
        <RallyTile icon={Rocket} label="Boost" sub="Reach the neighborhood" onClick={onBoost} />
      )}
    </div>
  );
}
