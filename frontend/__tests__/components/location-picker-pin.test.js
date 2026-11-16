/** @jest-environment jsdom */
/**
 * The place step of the lost and found report wizards, with location turned
 * off and the street lookup down (Nominatim and Photon rate-limit in
 * production): the person could not place the pet at all. The picker offered
 * "Put the pin on the map" only where a screen gave it a `near` point, and
 * only the search screen did; the wizards' footer still said "Use my
 * location" after the browser had said no (2026-11-16).
 *
 * Now the map can be opened by hand in the wizards too. With no `near` it
 * opens on the country or region the device's time zone names, or the whole
 * world (app/lib/maps/roughStart.js), says to zoom in, and a tap zooms in
 * toward the spot until the map is close enough for a tap to put the pin.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react';

const mockMaps = [];
jest.mock('leaflet', () => {
  const layer = () => {
    const l = { addTo: () => l, on: () => l, setLatLng: () => l, remove() {} };
    return l;
  };
  const L = {
    map: () => {
      const handlers = {};
      const map = {
        zoom: null,
        calls: [],
        on(name, fn) {
          (handlers[name] = handlers[name] || []).push(fn);
          return map;
        },
        fire(name, e) {
          (handlers[name] || []).forEach((fn) => fn(e));
        },
        setView(center, zoom) {
          map.calls.push(['setView', center, zoom]);
          map.zoom = zoom;
          map.fire('zoomend');
          return map;
        },
        // What Leaflet would pick for a box this size on a phone.
        fitBounds(box) {
          map.calls.push(['fitBounds', box]);
          map.zoom = 5;
          map.fire('zoomend');
          return map;
        },
        getZoom: () => map.zoom,
        invalidateSize() {},
        remove() {},
      };
      mockMaps.push(map);
      return map;
    },
    tileLayer: layer,
    marker: layer,
    circle: layer,
    divIcon: () => ({}),
    control: { zoom: () => ({ addTo() {} }) },
  };
  return { __esModule: true, default: L };
});
jest.mock('@/app/lib/maps/appleMapKit', () => ({
  __esModule: true,
  searchAutocomplete: jest.fn(() => Promise.reject(new Error('MapKit did not load'))),
  getPlaceFromAutocomplete: jest.fn(),
}));

import LocationPicker, { PIN_ZOOM } from '@/app/components/report/LocationPicker';
import { roughStart, boxAround, WORLD_VIEW } from '@/app/lib/maps/roughStart';

const inBox = ([[south, west], [north, east]], [lat, lng]) => lat >= south && lat <= north && lng >= west && lng <= east;

let permission;
beforeAll(() => {
  // jsdom lays nothing out: the map's box needs a height for the map to be made.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 400 });
});

beforeEach(() => {
  mockMaps.length = 0;
  permission = { state: 'denied', onchange: null };
  Object.defineProperty(window.navigator, 'permissions', { configurable: true, value: { query: jest.fn(async () => permission) } });
  Object.defineProperty(window.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: jest.fn() } });
  // Every geocoder is down: Photon and Nominatim answer 503, and the reverse lookup does too.
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('the wizard place step with location off and the lookup down', () => {
  test('the person can still put the pin on a map, and is never offered "Use my location"', async () => {
    const onChange = jest.fn();
    const onLocateOffer = jest.fn();
    const view = render(<LocationPicker value={null} onChange={onChange} onLocateOffer={onLocateOffer} />);

    // The browser has said no: the picker says so to the screen, for its footer, and offers neither of its own buttons.
    await waitFor(() => expect(onLocateOffer).toHaveBeenLastCalledWith(false));
    expect(view.queryByText('Use my location')).toBeNull();
    expect(view.queryByLabelText('Use my location')).toBeNull();

    // The street lookup does not answer: the words say so, and point at the map, not at location.
    fireEvent.change(view.getByLabelText('Street, park or cross streets'), { target: { value: '12 Elm St' } });
    await view.findByText('Looking up the street did not work just now. Try again in a moment, or put the pin on the map yourself.', {}, { timeout: 3000 });

    // The map opens with no `near`: on the device's own region (Jest runs in America/New_York), with no pin.
    fireEvent.click(view.getByText('Put the pin on the map'));
    await waitFor(() => expect(mockMaps).toHaveLength(1));
    const map = mockMaps[0];
    const [kind, box] = map.calls[0];
    expect(kind).toBe('fitBounds');
    for (const city of [[40.71, -74.0], [25.76, -80.19], [33.75, -84.39], [42.36, -71.06]]) expect(inBox(box, city)).toBe(true);
    expect(inBox(box, [34.05, -118.24])).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    await view.findByText('Zoom in to the street, then tap to put the pin.');

    // From that far out a tap zooms in toward the spot. It does not put a pin miles from the place.
    const spot = { latlng: { lat: 30.2672, lng: -97.7431 } };
    act(() => map.fire('click', spot));
    expect(map.calls[map.calls.length - 1]).toEqual(['setView', spot.latlng, 9]);
    expect(onChange).not.toHaveBeenCalled();
    act(() => map.fire('click', spot));
    act(() => map.fire('click', spot));
    expect(map.getZoom()).toBe(PIN_ZOOM);
    expect(onChange).not.toHaveBeenCalled();
    await view.findByText('Tap the map to put the pin.');

    // Close in, a tap puts the pin there.
    await act(async () => map.fire('click', spot));
    expect(onChange).toHaveBeenCalledWith({ lat: 30.2672, lng: -97.7431, address: '', city: '' });
    view.unmount();
  });

  test('"Use my location" is offered until the browser says no, then goes, from the screen\'s footer too', async () => {
    permission = { state: 'prompt', onchange: null };
    navigator.geolocation.getCurrentPosition.mockImplementation((ok, fail) => fail({ code: 1 }));
    const onLocateOffer = jest.fn();
    const view = render(<LocationPicker value={null} onChange={() => {}} onLocateOffer={onLocateOffer} />);
    await waitFor(() => expect(navigator.permissions.query).toHaveBeenCalled());
    expect(onLocateOffer).toHaveBeenLastCalledWith(true);
    fireEvent.click(view.getByText('Use my location'));
    await view.findByText('Location is turned off for this page. Type the street, or put the pin on the map.');
    expect(onLocateOffer).toHaveBeenLastCalledWith(false);
    expect(view.queryByText('Use my location')).toBeNull();
    expect(view.getByText('Put the pin on the map')).toBeTruthy();
    view.unmount();
  });

  test('with `near` (the search screen) the map still opens close in at that point', async () => {
    const view = render(<LocationPicker value={null} onChange={() => {}} canLocate={false} near={{ lat: 40.75, lng: -73.99 }} />);
    fireEvent.click(view.getByText('Put the pin on the map'));
    await waitFor(() => expect(mockMaps).toHaveLength(1));
    expect(mockMaps[0].calls[0]).toEqual(['setView', [40.75, -73.99], 16]);
    await view.findByText('Tap the map to put the pin.');
    view.unmount();
  });
});

describe('where the map opens with nothing to go on', () => {
  test('a US time zone opens its own region, not the whole country', () => {
    const pacific = roughStart('America/Los_Angeles');
    expect(inBox(boxAround(pacific, pacific.km), [37.77, -122.42])).toBe(true);
    expect(inBox(boxAround(pacific, pacific.km), [32.72, -117.16])).toBe(true);
    expect(inBox(boxAround(pacific, pacific.km), [40.71, -74.0])).toBe(false);
    const central = roughStart('America/Chicago');
    expect(inBox(boxAround(central, central.km), [30.27, -97.74])).toBe(true);
    expect(inBox(boxAround(roughStart('Pacific/Honolulu'), roughStart('Pacific/Honolulu').km), [21.31, -157.86])).toBe(true);
  });

  test('another zone the site knows opens its country', () => {
    const bolivia = roughStart('America/La_Paz');
    expect(inBox(boxAround(bolivia, bolivia.km), [-16.5, -68.15])).toBe(true);
    const mexico = roughStart('America/Mexico_City');
    expect(inBox(boxAround(mexico, mexico.km), [19.43, -99.13])).toBe(true);
    const pr = roughStart('America/Puerto_Rico');
    expect(inBox(boxAround(pr, pr.km), [18.47, -66.11])).toBe(true);
  });

  test('a zone it does not know, or none, opens the whole world', () => {
    expect(roughStart('Asia/Tokyo')).toEqual(WORLD_VIEW);
    expect(roughStart('')).toEqual(WORLD_VIEW);
    expect(roughStart('Asia/Tokyo')).not.toBe(WORLD_VIEW);
  });
});

describe('the wizards follow the picker', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', 'app', rel), 'utf8');

  test.each(['report/new/page.js', 'report/found/page.js'])('%s offers "Use my location" in its footer only while the picker does', (file) => {
    const page = read(file);
    expect(page).toMatch(/const \[canLocate, setCanLocate\] = useState\(true\);/);
    expect(page).toMatch(/<LocationPicker[\s\S]*?onLocateOffer=\{setCanLocate\}[\s\S]*?\/>/);
    expect(page).toMatch(
      /location\s*\? \{ label: 'Confirm this spot', onClick: advance \}\s*: canLocate\s*\? \{ label: 'Use my location', onClick: \(\) => locationControl\.current\?\.locate\(\) \}\s*: \{ label: 'Confirm this spot', onClick: advance, disabled: true \}/
    );
    // Nothing else in the page offers it.
    expect(page.match(/'Use my location'/g)).toHaveLength(1);
  });
});
