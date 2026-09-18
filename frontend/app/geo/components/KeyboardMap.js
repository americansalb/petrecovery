'use client';

import { useEffect, useId, useState } from 'react';

/** One explicit keyboard target, separate from the provider's own map controls. */
export default function KeyboardMap({ children, className = '', interactive, label, pan, zoom, place }) {
  const instructions = useId();
  const [focused, setFocused] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => { setAnnouncement(''); }, [interactive]);
  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    const magnify = ['+', '='].includes(event.key) ? 1 : event.key === '-' ? -1 : 0;
    const drop = interactive && ['Enter', ' '].includes(event.key);
    if (!direction && !magnify && !drop) return;
    event.preventDefault();
    event.stopPropagation();
    if (direction) pan?.(...direction);
    else if (magnify) zoom?.(magnify);
    else {
      const point = place?.();
      if (point) setAnnouncement(`Pin placed at ${point.lat.toFixed(2)} latitude, ${point.lng.toFixed(2)} longitude. Tab to Guess to submit.`);
    }
  };
  return (
    <div
      className={`relative h-full w-full outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-clay-400 ${className}`}
      tabIndex={0} role="group" aria-label={label || (interactive ? 'Guess map' : 'Answer map')}
      aria-describedby={instructions} data-keyboard-map
      onKeyDown={onKeyDown}
      onFocus={(event) => setFocused(event.target === event.currentTarget)}
      onBlur={() => setFocused(false)} onPointerDown={() => setFocused(false)}
    >
      {children}
      {focused ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[700] border-4 border-clay-400" /> : null}
      {focused && interactive ? <>
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[700] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ocean-950/90 p-1 text-white shadow-lg">＋</span>
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-3 z-[700] w-max max-w-[90%] -translate-x-1/2 rounded-lg bg-ocean-950/95 px-3 py-2 text-center text-xs text-white shadow-lg">Arrow keys move · + / − zoom · Enter places pin</span>
      </> : null}
      <span id={instructions} className="sr-only">Arrow keys move the map. Plus and minus zoom.{interactive ? ' Enter or Space places a pin at the centre. Tab to Guess to submit.' : ''}</span>
      <span role="status" className="sr-only">{interactive ? announcement : ''}</span>
    </div>
  );
}
