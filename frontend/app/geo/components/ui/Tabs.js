'use client';

import { useRef } from 'react';

/**
 * One row of tabs. The leaderboard's ladders, the profile's sections
 * and the shop's kinds were three hand-written copies of the same
 * markup with three slightly different paddings.
 *
 * items: [{ id, label }]. `marker` names a data attribute put on each
 * tab as data-<marker>="<id>", which is how the harness clicks them.
 */

export default function Tabs({
  items,
  value,
  onChange,
  label,
  marker = '',
  className = '',
  panelId,
}) {
  const buttons = useRef([]);
  const onKey = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].id);
    buttons.current[next]?.focus();
  };
  return (
    <div
      className={`pe-tabs inline-flex flex-wrap gap-1 rounded-xl bg-white/5 p-1 ${className}`}
      role="tablist"
      aria-label={label}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          ref={(node) => { buttons.current[index] = node; }}
          id={panelId ? `${panelId}-tab-${item.id}` : undefined}
          aria-controls={panelId}
          tabIndex={value === item.id ? 0 : -1}
          aria-selected={value === item.id}
          onKeyDown={(event) => onKey(event, index)}
          onClick={() => onChange(item.id)}
          {...(marker ? { [`data-${marker}`]: item.id } : {})}
          className={`min-h-[44px] rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            value === item.id
              ? 'bg-ocean-900 text-white shadow'
              : 'text-white/70 hover:bg-ocean-900/60'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
