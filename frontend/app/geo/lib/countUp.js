'use client';

/**
 * A number that arrives rather than appears.
 *
 * The score and the distance are what a player came to see, and they
 * were already at their final value when the panel rendered, so the one
 * number the round is about got no moment at all.
 *
 * Runs on requestAnimationFrame and reads the clock each frame rather
 * than counting ticks, so a backgrounded tab resumes at the right value
 * instead of finishing late. Honours prefers-reduced-motion by handing
 * back the final value on the first render.
 */

import { useEffect, useRef, useState } from 'react';
import { easeOut, prefersReducedMotion } from './motion';

// Kept as an export so nothing that reached for it here breaks; the
// game's one definition now lives in motion.js.
export { prefersReducedMotion };

/**
 * @param {number} target what to count to
 * @param {{ durationMs?: number, delayMs?: number, key?: any }} options
 *   `key` restarts the count: a new round is a new number, and without
 *   it the second reveal would start from the first one's total.
 */
export function useCountUp(target, { durationMs = 700, delayMs = 0, key = null } = {}) {
  const value = Number.isFinite(target) ? target : 0;
  const [shown, setShown] = useState(value);
  const frame = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      setShown(value);
      return undefined;
    }
    let startedAt = 0;
    setShown(0);
    const step = (now) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt - delayMs;
      if (elapsed < 0) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      setShown(value * easeOut(t));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, delayMs, key]);

  return shown;
}
