import React from 'react';
import { Target } from 'lucide-react';

export default function ProbabilityZoneToggle({ show, onToggle, className = '' }) {
    return (
        <button
            onClick={onToggle}
            className={`z-[500] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg transition-all border-2 ${show
                    ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                    : 'bg-slate-800/95 backdrop-blur text-slate-300 hover:text-white border-slate-600'
                } ${className}`}
        >
            <Target size={20} />
            <span className="font-bold text-sm">
                {show ? 'Hide Zones' : 'Show Zones'}
            </span>
        </button>
    );
}
