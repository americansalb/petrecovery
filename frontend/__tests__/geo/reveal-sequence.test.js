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
import AppleGuessMap, { regionAround } from '@/app/geo/components/AppleGuessMap';
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
    constructor() { this.annotations = []; this.overlays = []; this.listeners = {}; log.push(['map']); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
    addAnnotation(a) { this.annotations.push(a); }
    addAnnotations(list) { this.annotations.push(...list); log.push(['addAnnotations', list.map((a) => a.title)]); }
    removeAnnotation(a) { this.annotations = this.annotations.filter((x) => x !== a); }
    removeAnnotations(list) { this.annotations = this.annotations.filter((x) => !list.includes(x)); }
    addOverlays(list) { this.overlays.push(...list); log.push(['addOverlays', list.length]); }
    removeOverlays(list) { this.overlays = this.overlays.filter((x) => !list.includes(x)); }
    showItems(items, options) { log.push(['showItems', items.length, options.animate]); }
    // Lands at once and says so, as MapKit does when an animation ends.
    setRegionAnimated(region, animate) {
      log.push(['setRegion', region, animate]);
      this.region = region;
      (this.listeners['region-change-end'] || []).forEach((fn) => fn());
    }
    destroy() {}
  }
  return {
    log,
    mapkit: {
      Coordinate, MarkerAnnotation, PolylineOverlay, Map,
      CoordinateRegion: class { constructor(center, span) { this.center = center; this.span = span; } },
      CoordinateSpan: class { constructor(latitudeDelta, longitudeDelta) { this.latitudeDelta = latitudeDelta; this.longitudeDelta = longitudeDelta; } },
      Padding: class {},
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
  expect(fake.log.find((e) => e[0] === 'setRegion')[2]).toBe(true);

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
  // The region is set from the guess and the answer before the line
  // starts to grow, so the answer is inside it when its pin lands.
  const { fake, results, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
  const line = getMap().overlays[0];
  // The first shape the line had reaches the answer...
  expect(line.history[0][1].latitude).toBeCloseTo(35.5, 6);
  // ...and the region set on the way in holds it.
  const region = fake.log.find((e) => e[0] === 'setRegion')[1];
  expect(region.center.latitude + region.span.latitudeDelta / 2).toBeGreaterThan(35.5);
  expect(region.center.longitude - region.span.longitudeDelta / 2).toBeLessThan(-97.5);
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

/**
 * A whole game on one map: five pins titled "Your guess" printed their
 * titles over one another, so the summary numbers its pins by round
 * and lets the colours say which is the guess and which the answer.
 */
test('a whole game on one map numbers its pins instead of titling each one', () => {
  window.matchMedia = (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
  const { fake, getMap } = setup();
  const game = [
    { guess: { lat: 1, lng: 1 }, answer: { lat: 10, lng: 10 } },
    { guess: { lat: 2, lng: 2 }, answer: { lat: 20, lng: 20 } },
  ];
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={game} />); });
  const pins = getMap().annotations;
  expect(pins.map((p) => p.glyphText)).toEqual(['1', '2', '1', '2']);
  expect(pins.every((p) => p.titleVisibility === 'hidden')).toBe(true);
});

/**
 * A single reveal has one answer, so a number on its pin says nothing,
 * and it said "1" on every round of the game.
 */
test('a single reveal does not number its answer pin', () => {
  window.matchMedia = (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
  const { fake, results, getMap } = setup();
  const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
  act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
  const answer = getMap().annotations.find((a) => a.title === 'Where you were');
  expect(answer.glyphText).toBeUndefined();
});

/**
 * At the end of a game the map's box eases its bottom edge up to make
 * room for the summary, after the camera was placed. MapKit keeps its
 * zoom through a resize, so the answers ended up off the edge. The map
 * frames the result again once the box has settled, and leaves the
 * view alone while the player is guessing.
 */
test('a result map frames itself again after its box changes size', () => {
  jest.useFakeTimers();
  let fire = () => {};
  global.ResizeObserver = class { constructor(cb) { fire = cb; } observe() {} disconnect() {} };
  let size = { w: 800, h: 500 };
  const width = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => size.w);
  const height = jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => size.h);
  try {
    const { fake, results } = setup();
    const fits = () => fake.log.filter((e) => e[0] === 'setRegion').length;
    const { rerender } = render(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />);
    act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="result" results={results} />); });
    expect(fits()).toBe(1);
    size = { w: 800, h: 260 };
    act(() => { fire(); jest.advanceTimersByTime(300); });
    expect(fits()).toBe(2);
    act(() => { rerender(<AppleGuessMap mapkit={fake.mapkit} mode="guess" results={[]} />); });
    size = { w: 400, h: 260 };
    act(() => { fire(); jest.advanceTimersByTime(300); });
    expect(fits()).toBe(2);
  } finally {
    width.mockRestore();
    height.mockRestore();
    delete global.ResizeObserver;
    jest.useRealTimers();
  }
});

/**
 * The region goes the short way round. A line through Utah and
 * Brisbane measured west to east is 265 degrees wide, more than a half-
 * screen map shows at its widest, so the old fit clamped around Africa
 * and cut both answers off. Across the Pacific it is 95 degrees.
 */
describe('regionAround', () => {
  const lngCovers = (r, lng) => {
    const d = ((((lng - r.lng) % 360) + 540) % 360) - 180;
    return Math.abs(d) <= r.lngSpan / 2;
  };

  test('crosses the Pacific when that is the short way', () => {
    const points = [{ lat: 40.7, lng: -111.9 }, { lat: -28, lng: 153.4 }];
    const r = regionAround(points, { width: 680, height: 780 });
    expect(r.lngSpan).toBeLessThan(140);
    for (const p of points) expect(lngCovers(r, p.lng)).toBe(true);
    expect(lngCovers(r, 20)).toBe(false);
  });

  test('stays over the Atlantic when that is the short way', () => {
    const points = [{ lat: 49.9, lng: -97.1 }, { lat: 21.2, lng: 0 }, { lat: 60.4, lng: 22.3 }];
    const r = regionAround(points, { width: 1400, height: 530 });
    expect(r.lng).toBeGreaterThan(-60);
    expect(r.lng).toBeLessThan(0);
    for (const p of points) expect(lngCovers(r, p.lng)).toBe(true);
  });

  // MapKit goes no further out than a 1024px world, so a phone-width map
  // shows about 130 degrees of longitude. Framed on the middle of a world
  // game, the phone summary showed the Indian Ocean and one pin.
  test('a map too narrow for every answer frames the most answers, not the empty middle', () => {
    const answers = [{ lat: 38.7, lng: -9.1 }, { lat: 59.3, lng: 18.1 }, { lat: -33.9, lng: 151.2 }].map((p) => ({ ...p, weight: 2 }));
    const guesses = [{ lat: 20, lng: 0 }, { lat: 25, lng: 5 }, { lat: 15, lng: -5 }].map((p) => ({ ...p, weight: 1 }));
    const r = regionAround([...answers, ...guesses], { width: 374, height: 250 });
    for (const p of [answers[0], answers[1], ...guesses]) expect(lngCovers(r, p.lng)).toBe(true);
    expect(lngCovers(r, 151.2)).toBe(false);
    // The same points on a desktop summary all fit, the short way round.
    const wide = regionAround([...answers, ...guesses], { width: 682, height: 778 });
    for (const p of [...answers, ...guesses]) expect(lngCovers(wide, p.lng)).toBe(true);
  });

  test('a reveal that cannot show both places shows the answer', () => {
    const r = regionAround([{ lat: -15.8, lng: -47.9, weight: 1 }, { lat: 35.7, lng: 139.7, weight: 2 }], { width: 374, height: 250 });
    expect(lngCovers(r, 139.7)).toBe(true);
    expect(lngCovers(r, -47.9)).toBe(false);
  });

  /*
   * Where MapKit draws a latitude for a region, as measured in a browser:
   * centred on the region's centre, the height of its span over the
   * cosine of that centre, zoomed so both spans fit the box.
   */
  const RAD = Math.PI / 180;
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
  const pixelY = (r, lat, width, height) => {
    const scale = Math.min(width / (r.lngSpan * RAD), height / ((r.latSpan * RAD) / Math.cos(r.lat * RAD)));
    return height / 2 - (y(lat) - y(r.lat)) * scale;
  };

  // Measured on a reveal: an answer at 43 north sat 40px from the top of
  // a 532px map, its pin cut off, and the guess at 12 north had 70px.
  test('the northern pin gets its room too: padding is in the projection, not in degrees', () => {
    const points = [{ lat: 43.04, lng: -75 }, { lat: 12.14, lng: -40 }];
    const box = { width: 1422, height: 532 };
    const r = regionAround(points, box);
    expect(pixelY(r, 43.04, box.width, box.height)).toBeGreaterThanOrEqual(60);
    expect(box.height - pixelY(r, 12.14, box.width, box.height)).toBeGreaterThanOrEqual(40);
    // The same in the south, where the stretch is the other way round.
    const south = regionAround([{ lat: -12, lng: 20 }, { lat: -55, lng: 60 }], box);
    expect(pixelY(south, -12, box.width, box.height)).toBeGreaterThanOrEqual(60);
    expect(box.height - pixelY(south, -55, box.width, box.height)).toBeGreaterThanOrEqual(40);
  });

  // A phone reveal of Christchurch after a guess in Europe was framed on
  // Christchurch's roads: the answer alone, at the tightest zoom.
  test('an answer framed without its guess still shows the country around it', () => {
    const r = regionAround([{ lat: 48, lng: 2, weight: 1 }, { lat: -43.5, lng: 172.6, weight: 2 }], { width: 374, height: 440 });
    expect(lngCovers(r, 172.6)).toBe(true);
    expect(r.lngSpan).toBeGreaterThanOrEqual(45);
    expect(r.latSpan).toBeGreaterThanOrEqual(20);
  });

  test('leaves room for the pins at the edges, and never zooms to a roof', () => {
    const wide = regionAround([{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }], { width: 500, height: 500 });
    expect(wide.lngSpan).toBeGreaterThan(10);
    expect(wide.latSpan).toBeGreaterThan(10);
    const one = regionAround([{ lat: 48.85, lng: 2.35 }], { width: 500, height: 500 });
    expect(one.lat).toBeCloseTo(48.85, 5);
    expect(one.lngSpan).toBeGreaterThanOrEqual(0.6);
  });
});

/**
 * A phone's Script reveal is a map under 300px tall. At MapKit's widest
 * that shows less latitude than Spanish spans (the Southern Cone to
 * Spain), and the answer's pin was cut off the top. Upright, as across,
 * the stretch holding the most weight is framed.
 */
describe('regionAround on a short map', () => {
  const RAD = Math.PI / 180;
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
  test('frames what it can show upright, the heaviest part first', () => {
    const points = [
      { lat: 12, lng: 12, weight: 3 },    // the pin, in Africa
      { lat: 36.5, lng: -5.6, weight: 3 }, // the nearest place, Spain
      { lat: -55, lng: -68, weight: 0.2 }, // Tierra del Fuego
      { lat: -33, lng: -70, weight: 0.2 },
    ];
    const box = { width: 390, height: 285, padding: 46.8 };
    const r = regionAround(points, box);
    const visible = (2 * Math.PI * box.height) / 1024;
    const scale = Math.min(box.width / (r.lngSpan * RAD), box.height / ((r.latSpan * RAD) / Math.cos(r.lat * RAD)), 1024 / (2 * Math.PI));
    const top = (lat) => box.height / 2 - (y(lat) - y(r.lat)) * scale;
    // The pin and Spain are on the map, with room above Spain's pin.
    expect(top(36.5)).toBeGreaterThanOrEqual(40);
    expect(top(12)).toBeLessThanOrEqual(box.height - 20);
    // Tierra del Fuego is the part given up.
    expect(top(-55)).toBeGreaterThan(box.height);
    expect(visible).toBeGreaterThan(0);
  });
});
