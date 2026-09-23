/** @jest-environment jsdom */

/**
 * The parts of the game's motion that need a measurement or a clock
 * (app/geo/lib/motion.js). Each of these was written against something
 * specific that went wrong or would have.
 */
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import {
  REVEAL,
  alongMercator,
  openFromRect,
  playTimeline,
  usePresence,
  useTween,
  useOpenFrom,
} from '@/app/geo/lib/motion';

function reducedMotion(on) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: on && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

/** An element whose box is `last`, recording what it was asked to animate. */
function box(last) {
  const calls = [];
  return {
    calls,
    getBoundingClientRect: () => ({ ...last, right: last.left + last.width, bottom: last.top + last.height }),
    animate: (keyframes, options) => {
      calls.push({ keyframes, options });
      return { keyframes, options };
    },
  };
}
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

beforeEach(() => {
  reducedMotion(false);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
});

describe('opening the reveal out of the guess card', () => {
  // The desktop numbers, measured on the live site: a 288x224 card at
  // the bottom right, and a 1424x534 frame across the top.
  const card = rect(1136, 620, 288, 224);
  const frame = { left: 8, top: 96, width: 1424, height: 534 };

  test('it starts as a card-sized window where the card was, and ends as the whole frame', () => {
    const el = box(frame);
    const animation = openFromRect(el, card);
    expect(animation).toBeTruthy();
    const [from, to] = el.calls[0].keyframes;
    expect(to.transform).toBe('translate(0, 0)');
    expect(to.clipPath).toMatch(/^inset\(0px 0px 0px 0px/);
    // The window is the card's size...
    const inset = from.clipPath.match(/inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px/).slice(1).map(Number);
    const [top, right, bottom, left] = inset;
    expect(frame.width - left - right).toBe(card.width);
    expect(frame.height - top - bottom).toBe(card.height);
  });

  test('it grows from the nearest corner, so the map does not fly across the screen', () => {
    // Bottom right: the card's bottom-right corner is 8px from the
    // frame's, where its top-left is 1128px away.
    const el = box(frame);
    openFromRect(el, card);
    const { transform } = el.calls[0].keyframes[0];
    const [dx, dy] = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/).slice(1).map(Number);
    expect(Math.hypot(dx, dy)).toBeLessThan(250);
  });

  test('it leaves nothing on the element afterwards', () => {
    // A transform left behind on an ancestor of anything fixed makes it
    // the containing block for that thing (motion.css, rule 2).
    const el = box(frame);
    openFromRect(el, card);
    expect(el.calls[0].options.fill).toBe('none');
  });

  test('a card that was off the screen, empty or already in place opens from nowhere', () => {
    expect(openFromRect(box(frame), rect(-9999, 0, 256, 256))).toBeNull();
    expect(openFromRect(box(frame), rect(0, 0, 0, 0))).toBeNull();
    expect(openFromRect(box(frame), rect(8, 96, 1424, 534))).toBeNull();
  });

  test('less motion means no opening at all', () => {
    reducedMotion(true);
    const el = box(frame);
    expect(openFromRect(el, card)).toBeNull();
    expect(el.calls).toHaveLength(0);
  });
});

describe('the line from a guess to the answer', () => {
  const guess = { lat: 5.6, lng: 10.2 };
  const answer = { lat: 35.5, lng: -97.5 };

  test('it starts at the guess and ends at the answer', () => {
    const start = alongMercator(guess, answer, 0);
    const end = alongMercator(guess, answer, 1);
    expect(start.lat).toBeCloseTo(guess.lat, 6);
    expect(start.lng).toBeCloseTo(guess.lng, 6);
    expect(end.lat).toBeCloseTo(answer.lat, 6);
    expect(end.lng).toBeCloseTo(answer.lng, 6);
  });

  test('its tip stays on the straight line MapKit draws, so it does not snap sideways when it lands', () => {
    // MapKit draws in Web Mercator. Halfway along in longitude is halfway
    // along in Mercator y, which is not halfway in latitude on a long
    // north-south guess.
    const far = { lat: -60, lng: 0 };
    const near = { lat: 60, lng: 0 };
    const mid = alongMercator(far, near, 0.5);
    expect(mid.lat).toBeCloseTo(0, 6);
    const skewed = alongMercator({ lat: 0, lng: 0 }, { lat: 70, lng: 0 }, 0.5);
    // Linear latitude would say 35. Mercator puts the midpoint of the
    // drawn line well north of that.
    expect(skewed.lat).toBeGreaterThan(40);
  });
});

describe('the reveal clock', () => {
  test('the line lands when its delay and its travel are over', () => {
    expect(REVEAL.landMs).toBe(REVEAL.lineDelayMs + REVEAL.lineMs);
  });

  test('with less motion the timeline goes straight to its last frame', () => {
    reducedMotion(true);
    const frames = [];
    const done = jest.fn();
    playTimeline({ duration: 1000, frame: (t) => frames.push(t), done });
    expect(frames).toEqual([1]);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('leaving before being removed', () => {
  function Probe({ visible, onRender }) {
    onRender(usePresence(visible, 200));
    return null;
  }

  test('there is no frame where it is gone and then back', () => {
    jest.useFakeTimers();
    const seen = [];
    const { rerender } = render(<Probe visible onRender={(p) => seen.push(p)} />);
    expect(seen.at(-1)).toEqual({ mounted: true, leaving: false });
    rerender(<Probe visible={false} onRender={(p) => seen.push(p)} />);
    // The very first render after it was hidden is already leaving, and
    // still mounted.
    expect(seen.at(-1)).toEqual({ mounted: true, leaving: true });
    act(() => { jest.advanceTimersByTime(250); });
    expect(seen.at(-1)).toEqual({ mounted: false, leaving: false });
    jest.useRealTimers();
  });
});

describe('a running total', () => {
  function Total({ value, onRender }) {
    onRender(useTween(value, { durationMs: 100 }));
    return null;
  }

  test('a new game going back to zero is not counted down from the last one', () => {
    const seen = [];
    const { rerender } = render(<Total value={5000} onRender={(v) => seen.push(v)} />);
    rerender(<Total value={0} onRender={(v) => seen.push(v)} />);
    expect(seen.at(-1)).toBe(0);
  });
});

describe('opening from where it rested', () => {
  function Frame({ open, rects, calls }) {
    const ref = useRef(null);
    useOpenFrom(ref, open);
    return (
      <div
        ref={(node) => {
          ref.current = node;
          if (node) {
            node.getBoundingClientRect = () => rects[open ? 'open' : 'rest'];
            node.animate = (keyframes, options) => calls.push({ keyframes, options });
          }
        }}
      />
    );
  }

  test('it opens once, from the resting rectangle, when it goes from closed to open', () => {
    const calls = [];
    const rects = { rest: rect(1136, 620, 288, 224), open: rect(8, 96, 1424, 534) };
    const { rerender } = render(<Frame open={false} rects={rects} calls={calls} />);
    expect(calls).toHaveLength(0);
    rerender(<Frame open rects={rects} calls={calls} />);
    expect(calls).toHaveLength(1);
    // Staying open is not opening again.
    rerender(<Frame open rects={rects} calls={calls} />);
    expect(calls).toHaveLength(1);
  });
});
