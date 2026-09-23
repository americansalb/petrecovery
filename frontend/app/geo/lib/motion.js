'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * The game's motion, for the parts CSS cannot do on its own.
 *
 * motion.css holds the vocabulary: the curves, the durations, the page
 * arrival, the press. This holds what needs a measurement or a clock:
 * the map opening from its card into the reveal, the line travelling
 * from a guess to the answer, and the one timeline that the map, the
 * line, the pins and the numbers all keep to.
 *
 * Everything here uses the browser's own Web Animations API and
 * requestAnimationFrame. No library: the game already runs a WebGL
 * panorama, and a round is where the frames are needed.
 */

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** The same curve as --pe-ease-out, for the Web Animations API. */
export const EASE_OUT_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * The three seconds after a guess, as one timeline.
 *
 * It used to be three clocks that did not know about each other: the
 * number counted for 700ms from zero, the meter filled for 750ms from
 * 100ms, and the map, the line and both pins were simply there. All of
 * it was over before the eye had found any of it.
 *
 *   0ms      the map starts opening out of its card
 *   240ms    the line leaves your pin, and the score starts climbing
 *   1240ms   the line reaches the answer: its pin drops, the score
 *            lands, and the distance appears
 *
 * The number climbs while the line travels because they are the same
 * fact - how close you got - told twice.
 */
export const REVEAL = Object.freeze({
  mapOpenMs: 520,
  lineDelayMs: 240,
  lineMs: 1000,
  get landMs() {
    return this.lineDelayMs + this.lineMs;
  },
});

/**
 * Open an element out of the rectangle it used to occupy.
 *
 * The element is already at its final size and place when this runs
 * (call it from a layout effect, before the browser paints). A window
 * the size of the old rectangle is clipped out of it and moved to where
 * the old rectangle was; then the window grows to the whole element and
 * slides home. The content inside is at its real size throughout, so a
 * map is never stretched - it is revealed.
 *
 * The window is anchored at whichever corner makes the smallest move.
 * The guess card sits bottom right and the reveal frame spans the top,
 * so bottom-right it is: the card grows up and to the left into the
 * frame, instead of the whole map flying across the screen.
 *
 * Transform and clip-path only (motion.css, rule 1), and nothing is left
 * on the element once it has played (rule 2): fill is 'none'.
 *
 * Returns the Animation, or null when there is nothing sensible to open
 * from - an old rectangle off-screen, empty, or already the same.
 */
export function openFromRect(element, first, { duration = REVEAL.mapOpenMs, radius = 16 } = {}) {
  if (!element || !first || prefersReducedMotion()) return null;
  if (typeof element.animate !== 'function') return null;
  const last = element.getBoundingClientRect();
  if (!first.width || !first.height || !last.width || !last.height) return null;
  const offScreen = first.right < 0 || first.bottom < 0 || first.left > window.innerWidth || first.top > window.innerHeight;
  if (offScreen) return null;
  const same = Math.abs(first.left - last.left) < 2 && Math.abs(first.top - last.top) < 2
    && Math.abs(first.width - last.width) < 2 && Math.abs(first.height - last.height) < 2;
  if (same) return null;

  const w = Math.min(first.width, last.width);
  const h = Math.min(first.height, last.height);
  const corners = [
    { name: 'tl', dx: first.left - last.left, dy: first.top - last.top },
    { name: 'tr', dx: first.right - last.right, dy: first.top - last.top },
    { name: 'bl', dx: first.left - last.left, dy: first.bottom - last.bottom },
    { name: 'br', dx: first.right - last.right, dy: first.bottom - last.bottom },
  ];
  const corner = corners.reduce((best, c) => (Math.hypot(c.dx, c.dy) < Math.hypot(best.dx, best.dy) ? c : best));
  const cutX = last.width - w;
  const cutY = last.height - h;
  const top = corner.name[0] === 't' ? 0 : cutY;
  const bottom = corner.name[0] === 't' ? cutY : 0;
  const left = corner.name[1] === 'l' ? 0 : cutX;
  const right = corner.name[1] === 'l' ? cutX : 0;

  return element.animate(
    [
      {
        transform: `translate(${corner.dx}px, ${corner.dy}px)`,
        clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`,
      },
      { transform: 'translate(0, 0)', clipPath: `inset(0px 0px 0px 0px round ${radius}px)` },
    ],
    { duration, easing: EASE_OUT_CSS, fill: 'none' },
  );
}

/**
 * A point part of the way along the straight line MapKit draws between
 * two coordinates.
 *
 * MapKit draws in Web Mercator, where a straight segment is linear in
 * longitude and linear in Mercator y - not in latitude. Interpolating
 * latitude directly would bow the growing line away from the one it
 * becomes, so the tip would visibly snap sideways when it landed on a
 * long north-south guess.
 */
export function alongMercator(a, b, t) {
  const toY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));
  const fromY = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
  const y = toY(a.lat) + (toY(b.lat) - toY(a.lat)) * t;
  return { lat: fromY(y), lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Run `frame(progress)` every animation frame for `duration` ms after
 * `delay` ms, with progress eased. Returns a function that cancels it.
 * `done` runs once at the end, and also straight away (with the final
 * frame) when the player has asked for less motion.
 */
export function playTimeline({ delay = 0, duration, ease = easeInOut, frame, done }) {
  if (prefersReducedMotion()) {
    frame(1);
    done?.();
    return () => {};
  }
  let raf = 0;
  let start = 0;
  let cancelled = false;
  const step = (now) => {
    if (cancelled) return;
    if (!start) start = now;
    const elapsed = now - start - delay;
    if (elapsed >= 0) {
      const t = Math.min(1, elapsed / duration);
      frame(ease(t));
      if (t >= 1) {
        done?.();
        return;
      }
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

/**
 * Keep something on screen long enough to leave.
 *
 * `visible` going false used to mean gone on the next frame - the
 * loading curtain over a round vanished and the panorama popped into
 * being. This keeps it mounted for `exitMs` with `leaving` set, so it
 * can fade (motion.css, .pe-fade-out) before it is removed.
 *
 * `leaving` is true from the very first render after `visible` drops,
 * not one render later, so there is no frame where it is gone and then
 * back again.
 */
export function usePresence(visible, exitMs = 260) {
  const [phase, setPhase] = useState(visible ? 'in' : 'out');
  useEffect(() => {
    if (visible) {
      setPhase('in');
      return undefined;
    }
    if (prefersReducedMotion()) {
      setPhase('out');
      return undefined;
    }
    const timer = setTimeout(() => setPhase('out'), exitMs);
    return () => clearTimeout(timer);
  }, [visible, exitMs]);
  return { mounted: visible || phase !== 'out', leaving: !visible && phase !== 'out' };
}

/**
 * A number that travels from what it showed to what it is now.
 *
 * useCountUp (countUp.js) counts from zero, which is right for one
 * round's score. A running total is different: it should climb from the
 * old total to the new one, not restart. It only animates upward - a
 * new game resetting the total to zero goes straight there, rather than
 * counting down from the last game's score.
 */
export function useTween(target, { delayMs = 0, durationMs = 600 } = {}) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    if (!Number.isFinite(target) || target <= from || prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }
    let raf = 0;
    let start = 0;
    const step = (now) => {
      if (!start) start = now;
      const t = Math.min(1, Math.max(0, (now - start - delayMs) / durationMs));
      const value = from + (target - from) * easeOut(t);
      shownRef.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      // Interrupted (a new round's total before this one landed): carry
      // on from wherever it had got to, which is shownRef already.
    };
  }, [target, delayMs, durationMs]);
  return shown;
}

/**
 * Open `ref`'s element out of wherever it last sat at rest, the moment
 * `open` becomes true.
 *
 * "At rest" is the point of this. The guess card resizes with a short
 * transition (S, M, L), so its rectangle read straight after a render
 * can be the start of that transition rather than the card the player
 * is looking at. So the resting rectangle is taken after every commit,
 * again when a transition on the element ends, and again when the
 * window is resized - and whichever came last is where the reveal
 * opens from.
 *
 * Solo play and rooms both use it: in a room the reveal is started by
 * the server, seconds after the guess, so there is no click to measure
 * from.
 */
export function useOpenFrom(ref, open) {
  const resting = useRef(null);
  const wasOpen = useRef(open);

  useLayoutEffect(() => {
    const element = ref.current;
    if (open && !wasOpen.current && element && resting.current) {
      openFromRect(element, resting.current);
    }
    wasOpen.current = open;
    if (!open && element) resting.current = element.getBoundingClientRect();
  });

  useEffect(() => {
    if (open) return undefined;
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      if (ref.current) resting.current = ref.current.getBoundingClientRect();
    };
    element.addEventListener('transitionend', measure);
    window.addEventListener('resize', measure);
    return () => {
      element.removeEventListener('transitionend', measure);
      window.removeEventListener('resize', measure);
    };
  }, [ref, open]);
}
