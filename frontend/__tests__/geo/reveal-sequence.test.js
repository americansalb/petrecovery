/** @jest-environment jsdom */

/**
 * The reveal happens in order.
 *
 * Founder, 2026-09-23: "beautiful animations and transitions rather
 * than feeling like a website from the 90s". Measured on the live site
 * before this: 120ms after pressing Guess the button read "Scoring", and
 * by 320ms the map had snapped open, the line was fully drawn, both pins
 * were down and the score and distance were at their final values - the
 * whole reveal inside one frame.
 *
 * The order is now: your pin stays where you left it, the camera frames
 * both places, the line leaves your pin and travels to the answer, and
 * the answer's pin drops when the line reaches it. These pin that order
 * against a MapKit that records what it was asked to do.
 */
import { act, render } from '@testing-library/react';
import AppleGuessMap from '@/app/geo/components/AppleGuessMap';
import { REVEAL } from '@/app/geo/lib/motion';

jest.mock('@/app/geo/components/KeyboardMap', () => function KeyboardMap({ children }) { return children; });
jest.mock('@/app/geo/lib/mapKeyboard', () => ({ appleKeyboard: () => ({}) }));

function fakeMapKit() {
  const log = [];
  class Coordinate { constructor(lat, lng) { this.latitude = lat; this.longitude = lng; } }
  class MarkerAnnotation { constructor(coordinate, options) { this.coordinate = coordinate; Object.assign(this, options); } }
  class PolylineOverlay {
    constructor(points, options) { this._points = points; this.options = options; this.history = [points]; }
    get points() { return this._points; }
    set points(value) { this._points = value; this.history.push(value); }
  }
  class Map {
    constructor() { this.annotations = []; this.overlays = []; log.push(['map']); }
    addEventListener() {}
    addAnnotation(a) { this.annotations.push(a); }
    addAnnotations(list) { this.annotations.push(...list); log.push(['addAnnotations', list.map((a) => a.title)]); }
    removeAnnotation(a) { this.annotations = this.annotations.filter((x) => x !== a); }
    removeAnnotations(list) { this.annotations = this.annotations.filter((x) => !list.includes(x)); }
    addOverlays(list) { this.overlays.push(...list); log.push(['addOverlays', list.length]); }
    removeOverlays(list) { this.overlays = this.overlays.filter((x) => !list.includes(x)); }
    showItems(items, options) { log.push(['showItems', items.length, options.animate]); }
    destroy() {}
  }
  return {
    log,
    mapkit: {
      Coordinate, MarkerAnnotation, PolylineOverlay, Map,
      CoordinateRegion: class {}, CoordinateSpan: class {}, Padding: class {},
      Style: class { constructor(o) { Object.assign(this, o); } },
      FeatureVisibility: { Hidden: 'hidden' },
      Map_ColorSchemes: {},
    },
  };
}

function setup() {
  const fake = fakeMapKit();
  fake.mapkit.Map.ColorSchemes = { Light: 'light' };
  const results = [{ guess: { lat: 5.6, lng: 10.2 }, answer: { lat: 35.5, lng: -97.5 }, label: '' }];
  let map;
  const Orig = fake.mapkit.Map;
  fake.mapkit.Map = class extends Orig { constructor(...a) { super(...a); map = this; } };
  fake.mapkit.Map.ColorSchemes = { Light: 'light' };
  return { fake, results, getMap: () => map };
}

// A clock the test drives, so "halfway along the line" is a real moment.
let now = 0;
let frames = [];
beforeEach(() => {
  now = 0;
  frames = [];
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  global.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  global.cancelAnimationFrame = () => {};
});
function advance(ms) {
  const end = now + ms;
  while (now < end) {
    now = Math.min(end, now + 16);
    const due = frames.splice(0);
    due.forEach((cb) => cb(now));
  }
}

test('your pin first, the answer only once the line has reached it', () => {
  const { fake, results, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
  const map = getMap();

  // Straight away: the guess, the line and the camera, but no answer.
  const titles = () => map.annotations.map((a) => a.title);
  expect(titles()).toEqual(['Your guess']);
  expect(map.overlays).toHaveLength(1);
  expect(fake.log.find((e) => e[0] === 'showItems')[2]).toBe(true);

  // Before the line sets off, it has no length.
  const line = map.overlays[0];
  const [a, b] = line.points;
  expect(b.latitude).toBeCloseTo(a.latitude, 6);
  expect(b.longitude).toBeCloseTo(a.longitude, 6);

  // Halfway through its travel: part of the way there, and still no answer.
  act(() => { advance(REVEAL.lineDelayMs + REVEAL.lineMs / 2); });
  const tip = line.points[1];
  expect(tip.longitude).toBeLessThan(10.2);
  expect(tip.longitude).toBeGreaterThan(-97.5);
  expect(titles()).toEqual(['Your guess']);

  // Landed: the line reaches the answer and its pin drops.
  act(() => { advance(REVEAL.lineMs); });
  expect(line.points[1].latitude).toBeCloseTo(35.5, 6);
  expect(line.points[1].longitude).toBeCloseTo(-97.5, 6);
  expect(titles()).toEqual(['Your guess', 'Where you were']);
});

test('the camera frames where the line is going, not where it starts', () => {
  // showItems reads the overlay's extent when called, so it has to be
  // called while the line is still at full length.
  const { fake, results, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
  const line = getMap().overlays[0];
  // The first shape the line had - the one framed - reaches the answer.
  expect(line.history[0][1].latitude).toBeCloseTo(35.5, 6);
});

test('the guess pin does not drop in a second time', () => {
  const { fake, results, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
  expect(getMap().annotations[0].animates).toBe(false);
});

test('a round with no guess shows its answer at once, with nothing to wait for', () => {
  const { fake, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={[{ guess: null, answer: { lat: 1, lng: 2 } }]} />); });
  expect(getMap().annotations.map((a) => a.title)).toEqual(['Where you were']);
});

test('leaving the reveal mid-flight stops the line and never drops a stale pin', () => {
  const { fake, results, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
  act(() => { advance(REVEAL.lineDelayMs + 100); });
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />); });
  act(() => { advance(REVEAL.lineMs * 2); });
  expect(getMap().annotations.map((a) => a.title)).not.toContain('Where you were');
  expect(getMap().overlays).toHaveLength(0);
});

test('with less motion the whole reveal is there at once', () => {
  window.matchMedia = (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
  const { fake, results, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
  expect(getMap().annotations.map((a) => a.title)).toEqual(['Your guess', 'Where you were']);
  expect(getMap().overlays[0].points[1].latitude).toBeCloseTo(35.5, 6);
});
