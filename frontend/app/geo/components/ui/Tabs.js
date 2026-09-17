'use client';

/**
 * One row of tabs. The leaderboard's ladders, the profile's sections
 * and the shop's kinds were three hand-written copies of the same
 * markup with three slightly different paddings.
 *
 * items: [{ id, label }]. `marker` names a data attribute put on each
 * tab as data-<marker>="<id>", which is how the harness clicks them.
 */

export default function Tabs({ items, value, onChange, label, marker = '', className = '' }) {
  return (
    <div className={`inline-flex flex-wrap gap-1 rounded-xl bg-white/5 p-1 ${className}`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          {...(marker ? { [`data-${marker}`]: item.id } : {})}
          className={`min-h-[36px] rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            value === item.id ? 'bg-ocean-900 text-white shadow' : 'text-white/70 hover:bg-ocean-900/60'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
