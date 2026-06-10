'use client';

/**
 * BottomSheet - the mission slides over the map, never replaces it
 *
 * Three detents: peek (vitals + the one CTA), half (the brief), full
 * (team + chat). The map IS the mission; the sheet is everything else.
 *
 * Mechanics: one motion.div sized to the full detent, translated down
 * to the current detent. Dragging is bound to the grab handle ONLY
 * (dragListener={false} + useDragControls) so list scrolling and map
 * panning never fight the sheet. Snap picks the nearest detent, biased
 * by fling velocity.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion, useDragControls, animate, useMotionValue } from 'framer-motion';

export const DETENTS = { PEEK: 'peek', HALF: 'half', FULL: 'full' };

export default function BottomSheet({
  detent,
  onDetentChange,
  peekHeight = 150,
  handleChildren = null,
  children,
}) {
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const HEADER_H = 56;
  const fullHeight = Math.max(viewportH - HEADER_H - 8, 320);
  const heights = useMemo(() => ({
    peek: Math.min(peekHeight, fullHeight),
    half: Math.min(Math.round(viewportH * 0.48), fullHeight),
    full: fullHeight,
  }), [peekHeight, viewportH, fullHeight]);

  // y offset for a detent: how far down the sheet sits from fully open
  const offsetFor = (d) => fullHeight - (heights[d] || heights.peek);

  // Snap to the active detent whenever it changes (or sizes settle)
  const detentRef = useRef(detent);
  detentRef.current = detent;
  useEffect(() => {
    if (!viewportH) return;
    const controls = animate(y, offsetFor(detent), {
      type: 'spring', stiffness: 420, damping: 40,
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent, viewportH, heights.peek, heights.half, heights.full]);

  const snap = (_, info) => {
    const current = y.get();
    const projected = current + info.velocity.y * 0.18;
    let best = DETENTS.PEEK;
    let bestDist = Infinity;
    for (const d of Object.values(DETENTS)) {
      const dist = Math.abs(offsetFor(d) - projected);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    if (best !== detentRef.current) {
      onDetentChange?.(best);
    } else {
      // Same detent: spring back
      animate(y, offsetFor(best), { type: 'spring', stiffness: 420, damping: 40 });
    }
  };

  if (!viewportH) return null;

  return (
    <motion.div
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: offsetFor(DETENTS.PEEK) }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={snap}
      style={{ y, height: fullHeight }}
      className="fixed inset-x-0 bottom-0 z-[600] flex flex-col rounded-t-3xl border-2 border-b-0 border-slate-700/80 bg-slate-900/95 backdrop-blur-xl shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
    >
      {/* Grab handle: the only drag surface */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none select-none pt-2.5 pb-1"
        role="button"
        aria-label="Drag to resize panel"
      >
        <div className="w-10 h-1.5 rounded-full bg-slate-600 mx-auto" />
        {handleChildren}
      </div>

      {/* Body: scrolls only at full so dragging stays predictable */}
      <div className={`flex-1 min-h-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] ${detent === DETENTS.FULL ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {children}
      </div>
    </motion.div>
  );
}
