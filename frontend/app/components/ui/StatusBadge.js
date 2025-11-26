import React from 'react';

const VARIANTS = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    urgent: 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function StatusBadge({ status, variant = 'neutral', className = '' }) {
    const styles = VARIANTS[variant] || VARIANTS.neutral;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles} ${className}`}>
            {status}
        </span>
    );
}
