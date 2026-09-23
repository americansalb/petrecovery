/** @jest-environment jsdom */

/**
 * Leaving a round while its spot is still loading must not break the
 * next one.
 *
 * A Look Around view that is destroyed, or taken out of the page, before
 * it has answered leaves every later view in that tab silent for good
 * (lib/lookAround.js, STALL_MS). The game moves between the lobby and a
 * round without reloading, so a player who gave up on a slow round and
 * started another was starting it on a page that could no longer find
 * a spot. The pane parks an unanswered search out of sight instead, and
 * lets it finish.
 */
import { act, render } from '@testing-library/react';
import AppleLookAroundPane from '@/app/geo/components/AppleLookAroundPane';

function fakeMapKit() {
  const made = [];
  return {
    made,
    Coordinate: function Coordinate(lat, lng) { this.lat = lat; this.lng = lng; },
    LookAround: function LookAround(element) {
      const listeners = {};
      const view = {
        element,
        answered: false,
        destroyed: false,
        destroyedUnanswered: false,
        destroy() { this.destroyed = true; if (!this.answered) this.destroyedUnanswered = true; },
        addEventListener(type, fn) { listeners[type] = fn; },
        answer(type) { this.answered = true; listeners[type]?.({}); },
      };
      made.push(view);
      return view;
    },
  };
}

const spots = [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }];
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => { document.getElementById('pe-look-around-parking')?.remove(); });

test('leaving mid-search parks the unanswered view instead of pulling it out', async () => {
  const mapkit = fakeMapKit();
  const view = render(<AppleLookAroundPane mapkit={mapkit} candidates={spots} roundKey="0" />);
  await flush();
  const [first] = mapkit.made;
  expect(first.answered).toBe(false);

  view.unmount();
  // Still in the page, out of sight, and not destroyed.
  expect(document.body.contains(first.element)).toBe(true);
  expect(document.getElementById('pe-look-around-parking').contains(first.element)).toBe(true);
  expect(first.destroyed).toBe(false);

  // Once it answers it can go, and it takes its element with it.
  await act(async () => { first.answer('load'); });
  await flush();
  expect(first.destroyed).toBe(true);
  expect(first.destroyedUnanswered).toBe(false);
  expect(document.body.contains(first.element)).toBe(false);
});

test("the round's own view goes with the round", async () => {
  const mapkit = fakeMapKit();
  const onLocated = jest.fn();
  const view = render(<AppleLookAroundPane mapkit={mapkit} candidates={spots} roundKey="0" onLocated={onLocated} />);
  await flush();
  await act(async () => { mapkit.made[0].answer('load'); });
  await flush();
  expect(onLocated).toHaveBeenCalledWith(0);

  view.unmount();
  expect(mapkit.made[0].destroyed).toBe(true);
  expect(document.getElementById('pe-look-around-parking')?.children.length || 0).toBe(0);
});

test('a retry does not pull the spot still loading out from under MapKit', async () => {
  const mapkit = fakeMapKit();
  const view = render(<AppleLookAroundPane mapkit={mapkit} candidates={spots} roundKey="0" />);
  await flush();
  const [first] = mapkit.made;

  view.rerender(<AppleLookAroundPane mapkit={mapkit} candidates={[{ lat: 3, lng: 3 }]} roundKey="0" />);
  await flush();
  expect(document.body.contains(first.element)).toBe(true);
  expect(first.destroyed).toBe(false);

  // The old search answers and cleans up after itself; the new one runs.
  await act(async () => { first.answer('error'); });
  await flush();
  expect(first.destroyed).toBe(true);
  expect(first.destroyedUnanswered).toBe(false);
  expect(document.body.contains(first.element)).toBe(false);
  expect(mapkit.made.length).toBe(2);
  view.unmount();
});
