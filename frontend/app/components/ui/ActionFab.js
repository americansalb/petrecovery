import React from 'react';

export default function ActionFab({ icon, label, onClick, variant = 'primary' }) {
    const bg = variant === 'primary' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700';

    return (
        <button
            onClick={onClick}
            className={`${bg} text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center gap-2 font-semibold`}
        >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
        </button>
    );
}
