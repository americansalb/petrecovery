'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * One row of tabs. The leaderboard's ladders, the profile's sections
 * and the shop's kinds were three hand-written copies of the same
 * markup with three slightly different paddings.
 *
 * items: [{ id, label }]. `marker` names a data attribute put on each
 * tab as data-<marker>="<id>", which is how the harness clicks them.
 *
 * The selection is one pill behind the row that travels to whichever
 * tab is chosen (motion.css, .pe-tab-pill). It used to be a gradient
 * painted on the chosen tab itself, and a gradient cannot interpolate,
 * so choosing a tab made the green jump. The pill is measured from the
 * tab it sits under, again whenever the row changes size, because the
 * row wraps on a phone and the ladders run to two lines.
 */

// useLayoutEffect warns on the server; this component only measures in
// the browser, where it is the right hook, because the pill has to be
// in place before the first paint or it is seen arriving from 0,0.
const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect;

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
  const row = useRef(null);
  const [pill, setPill] = useState(null);
  // The first placement must not slide in from the corner; only moves
  // after it are animated.
  const [ready, setReady] = useState(false);

  // Keyed on the tabs' ids rather than the array: Rankings builds its
  // items inline, so the array is new on every render of the page, and
  // depending on it re-measured and rebuilt the observer each time.
  const ids = items.map((item) => item.id).join('|');
  useIsoLayoutEffect(() => {
    const place = () => {
      const index = ids.split('|').indexOf(value);
      const tab = buttons.current[index];
      if (!tab) {
        setPill(null);
        return;
      }
      const next = { x: tab.offsetLeft, y: tab.offsetTop, w: tab.offsetWidth, h: tab.offsetHeight };
      // Same place, same object: React skips the render.
      setPill((prev) => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    place();
    const node = row.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(place);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, ids]);

  useIsoLayoutEffect(() => {
    if (pill && !ready) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [pill, ready]);

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
      ref={row}
      className={`pe-tabs inline-flex flex-wrap gap-1 rounded-xl bg-white/5 p-1 ${className}`}
      role="tablist"
      aria-label={label}
    >
      {pill ? (
        <span
          className="pe-tab-pill"
          aria-hidden="true"
          data-pill
          style={{
            width: pill.w,
            height: pill.h,
            transform: `translate(${pill.x}px, ${pill.y}px)`,
            transitionDuration: ready ? undefined : '0ms',
          }}
        />
      ) : null}
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
          className={`min-h-[44px] rounded-lg px-4 py-1.5 text-sm font-semibold ${
            value === item.id ? 'text-white' : 'text-white/70 hover:bg-ocean-900/60'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
