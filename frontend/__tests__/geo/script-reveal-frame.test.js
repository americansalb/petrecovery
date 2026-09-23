/** @jest-environment jsdom */

/**
 * The Script reveal frames the player's pin, the nearest place the
 * language is used and its regions, and frames them again once the map
 * has settled into the size the reveal gives it.
 *
 * Seen on a 1440px screen: the answer panel arrives under the map and
 * the sentence above it shrinks, so the map loses more than half its
 * height after the camera was placed. MapKit keeps its centre and zoom
 * through a resize, and the pin and the nearest Afrikaans-speaking place
 * were both off the top of the map.
 */
import { act, render } from '@testing-library/react';
import AppleScriptMap from '@/app/geo/components/script/AppleScriptMap';

jest.mock('@/app/geo/components/KeyboardMap', () => function KeyboardMap({ children }) { return children; });
jest.mock('@/app/geo/lib/mapKeyboard', () => ({ appleKeyboard: () => ({}) }));
jest.mock('@/app/lib/geo/data/country-labels.json', () => ({ labels: [] }));

function fakeMapKit() {
  const log = [];
  let map;
  class Coordinate { constructor(lat, lng) { this.latitude = lat; this.longitude = lng; } }
  class MarkerAnnotation { constructor(coordinate, options) { this.coordinate = coordinate; Object.assign(this, options); } }
  class Overlay { constructor(points, options) { this.points = points; Object.assign(this, options); } }
  class Map {
    constructor() {
      this.annotations = [];
      this.overlays = [];
      this.listeners = {};
      map = this;
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
    addAnnotation(a) { this.annotations.push(a); }
    addAnnotations(list) { this.annotations.push(...list); }
    removeAnnotation(a) { this.annotations = this.annotations.filter((x) => x !== a); }
    removeAnnotations(list) { this.annotations = this.annotations.filter((x) => !list.includes(x)); }
    addOverlays(list) { this.overlays.push(...list); }
    removeOverlays(list) { this.overlays = this.overlays.filter((x) => !list.includes(x)); }
    showItems() { log.push(['showItems']); }
    convertCoordinateToPointOnPage() { return { x: 0, y: 0 }; }
    // Lands at once and says so, as MapKit does when an animation ends.
    setRegionAnimated(region, animate) {
      log.push(['setRegion', region, animate]);
      this._region = region;
      (this.listeners['region-change-end'] || []).forEach((fn) => fn());
    }
    get region() { return this._region; }
    set region(value) { this._region = value; log.push(['region', value]); }
    set padding(value) { log.push(['padding', value]); }
    destroy() {}
  }
  Map.ColorSchemes = { Light: 'light' };
  Map.MapTypes = {};
  return {
    log,
    getMap: () => map,
    mapkit: {
      Coordinate, MarkerAnnotation, Map,
      PolygonOverlay: Overlay, CircleOverlay: Overlay, PolylineOverlay: Overlay, Annotation: Overlay,
      CoordinateRegion: class { constructor(center, span) { this.center = center; this.span = span; } },
      CoordinateSpan: class { constructor(latitudeDelta, longitudeDelta) { this.latitudeDelta = latitudeDelta; this.longitudeDelta = longitudeDelta; } },
      Padding: class { constructor(top, right, bottom, left) { Object.assign(this, { top, right, bottom, left }); } },
      Style: class { constructor(o) { Object.assign(this, o); } },
      FeatureVisibility: { Hidden: 'hidden' },
    },
  };
}

const answer = {
  name: 'Afrikaans',
  regions: [
    { name: 'the Cape and the Free State', rings: [[[17, -35], [30, -35], [30, -26], [17, -26]]] },
    { name: 'Namibia', rings: [[[12, -29], [25, -29], [25, -17], [12, -17]]] },
  ],
};
const guess = { lat: 4, lng: 11 };
const nearestPoint = { lat: -17, lng: 12 };

let fire = () => {};
let size = { w: 1440, h: 735 };
let width;
let height;
beforeEach(() => {
  jest.useFakeTimers();
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  global.requestAnimationFrame = () => 1;
  global.cancelAnimationFrame = () => {};
  global.ResizeObserver = class { constructor(cb) { fire = cb; } observe() {} disconnect() {} };
  size = { w: 1440, h: 735 };
  width = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => size.w);
  height = jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => size.h);
});
afterEach(() => {
  width.mockRestore();
  height.mockRestore();
  delete global.ResizeObserver;
  jest.useRealTimers();
});

const covers = (region, point) => {
  const dLng = ((((point.lng - region.center.longitude) % 360) + 540) % 360) - 180;
  return Math.abs(dLng) <= region.span.longitudeDelta / 2 &&
    Math.abs(point.lat - region.center.latitude) <= region.span.latitudeDelta / 2;
};

function reveal(fake, props = {}) {
  const { rerender } = render(<AppleScriptMap mapkit={fake.mapkit} mode="guess" />);
  act(() => {
    rerender(<AppleScriptMap mapkit={fake.mapkit} mode="result" answer={answer} guess={guess} nearestPoint={nearestPoint} {...props} />);
  });
  return rerender;
}

test('the reveal frames the pin, the nearest place and every region', () => {
  const fake = fakeMapKit();
  reveal(fake);
  const moves = fake.log.filter((e) => e[0] === 'setRegion');
  expect(moves).toHaveLength(1);
  const region = moves[0][1];
  for (const point of [guess, nearestPoint, { lat: -35, lng: 30 }, { lat: -17, lng: 25 }]) expect(covers(region, point)).toBe(true);
  expect(fake.log.some((e) => e[0] === 'showItems')).toBe(false);
});

test('the reveal frames itself again once the map has settled into its new size', () => {
  const fake = fakeMapKit();
  reveal(fake);
  const fits = () => fake.log.filter((e) => e[0] === 'setRegion').length;
  expect(fits()).toBe(1);
  size = { w: 1440, h: 400 };
  act(() => { fire(); jest.advanceTimersByTime(300); });
  expect(fits()).toBe(2);
  const region = fake.log.filter((e) => e[0] === 'setRegion')[1][1];
  expect(covers(region, guess)).toBe(true);
});

test('choosing one region frames that region alone', () => {
  const fake = fakeMapKit();
  const rerender = reveal(fake);
  act(() => {
    rerender(<AppleScriptMap mapkit={fake.mapkit} mode="result" answer={answer} guess={guess} nearestPoint={nearestPoint} selectedRegion={1} />);
  });
  const region = fake.log.filter((e) => e[0] === 'setRegion').pop()[1];
  expect(covers(region, { lat: -23, lng: 18 })).toBe(true);
  expect(covers(region, guess)).toBe(false);
});

test("Apple's logo and zoom buttons sit above the controls that cover the map while guessing", () => {
  const fake = fakeMapKit();
  const { rerender } = render(<AppleScriptMap mapkit={fake.mapkit} mode="guess" guessInset={132} />);
  const paddings = () => fake.log.filter((e) => e[0] === 'padding').map((e) => e[1].bottom);
  expect(paddings()).toContain(132);
  act(() => { rerender(<AppleScriptMap mapkit={fake.mapkit} mode="guess" guessInset={96} />); });
  expect(paddings().pop()).toBe(96);
});
