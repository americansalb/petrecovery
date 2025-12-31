import React from 'react';
import { Target, Scan, X } from 'lucide-react';

export default function ProbabilityZoneToggle({ show, onToggle, className = '' }) {
    return (
        <button
            onClick={onToggle}
            className={`group z-[500] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl transition-all border backdrop-blur-md ${show
                    ? 'bg-emerald-600/90 border-white/20 text-white hover:bg-emerald-500/90'
                    : 'bg-slate-900/60 border-white/10 text-slate-200 hover:bg-slate-900/80 hover:text-white'
                } ${className}`}
        >
            <div className={`p-1 rounded-lg transition-colors ${show ? 'bg-white/20' : 'bg-white/10 group-hover:bg-white/20'}`}>
                {show ? <X size={16} /> : <Scan size={16} />}
            </div>
            <span className="font-bold text-sm tracking-wide">
                {show ? 'Hide Zones' : 'Search Zones'}
            </span>
        </button>
    );
}
