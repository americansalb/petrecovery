/** @jest-environment jsdom */
/**
 * "I've seen Max" on a phone, with a street typed and never picked.
 *
 * 2026-11-17: a witness typed "Barton Springs Rd" and pressed Send without
 * picking it from the suggestions. The typed street was ignored and Send
 * sent the phone's own position (30.2672, -97.7431) with no address: the
 * owner was sent to the wrong place. Now typing a place takes the phone's
 * pin off, Send waits until a match is picked or the pin is put on the map,
 * and the line over the button says what Send will send.
 */
import React, { useState } from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react';

jest.mock('leaflet', () => {
  const layer = () => {
    const l = { addTo: () => l, on: () => l, setLatLng: () => l, remove() {} };
    return l;
  };
  const L = {
    map: () => {
      const map = { zoom: 17, on: () => map, setView: () => map, fitBounds: () => map, getZoom: () => map.zoom, invalidateSize() {}, remove() {} };
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
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }) => <a href={href}>{children}</a> }));

import { Seen } from '@/app/mission-control/steps/Witness';

const PHONE = { lat: 30.2672, lng: -97.7431, address: '', city: '' };
const SEARCH = { lat: 30.3148, lng: -97.7459 };

beforeAll(() => {
  // jsdom lays nothing out: the picker's map needs a height to be made.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 400 });
});

beforeEach(() => {
  Object.defineProperty(window.navigator, 'permissions', { configurable: true, value: { query: jest.fn(async () => ({ state: 'granted', onchange: null })) } });
  Object.defineProperty(window.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: jest.fn() } });
  // The site's own geocoder finds the street by its name; the others are down.
  global.fetch = jest.fn(async (url) => {
    if (String(url).startsWith('/api/geocode?') && /[?&]q=/.test(String(url))) {
      return { ok: true, status: 200, json: async () => [{ name: 'Barton Springs Road', lat: '30.2615', lon: '-97.7608', address: { road: 'Barton Springs Road', city: 'Austin', state: 'Texas' } }] };
    }
    return { ok: false, status: 503, json: async () => ({}) };
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

/** The form as the search screen holds it: the place lives above it, and "Just now" can put the phone's spot back. */
function Form({ onSend, seen }) {
  const [where, setWhere] = useState(PHONE);
  const put = (value) => {
    seen.push(value);
    setWhere(value);
  };
  return (
    <>
      <Seen name="Max" owner={{ firstName: 'Avery' }} where={where} onWhere={put} near={SEARCH} locating={false} canLocate minutes={0} onMinutes={() => {}} onSend={() => onSend(where)} busy={false} problem="" />
      <button type="button" onClick={() => setWhere(PHONE)}>
        Phone spot again
      </button>
    </>
  );
}

const sendButton = (view) => view.getByRole('button', { name: 'Send to Avery' });
const sending = (view) => view.container.textContent.match(/Sending: ([^.]*?)(?=Pick|Type|Send to)/)?.[1]?.trim();

test('a street typed and not picked is not sent, and the phone\'s own spot is not sent in its place', async () => {
  const onSend = jest.fn();
  const seen = [];
  const view = render(<Form onSend={onSend} seen={seen} />);
  await act(async () => {});
  // Opened on the phone's own reading: Send sends where they are, and says so.
  expect(sending(view)).toBe('where you are now');
  expect(sendButton(view).disabled).toBe(false);

  fireEvent.click(view.getByRole('button', { name: 'Type the street instead' }));
  fireEvent.change(view.getByLabelText('Street, park or cross streets'), { target: { value: 'Barton Springs Rd' } });
  // The pin comes off at the first letter, and Send waits.
  expect(seen[seen.length - 1]).toBeNull();
  expect(sendButton(view).disabled).toBe(true);
  expect(sending(view)).toBe('nothing yet');
  expect(view.getByText('Pick the street from the list, or put the pin on the map.')).toBeTruthy();
  fireEvent.click(sendButton(view));
  expect(onSend).not.toHaveBeenCalled();

  // "Just now" puts the phone's spot back while the street is still typed: it is taken off again.
  await act(async () => fireEvent.click(view.getByRole('button', { name: 'Phone spot again' })));
  expect(seen[seen.length - 1]).toBeNull();
  expect(sendButton(view).disabled).toBe(true);

  // Picked from the list: that street is the place, with its name, and Send sends it.
  const match = await view.findByText('Barton Springs Road', {}, { timeout: 5000 });
  await act(async () => fireEvent.click(match.closest('button')));
  await waitFor(() => expect(sendButton(view).disabled).toBe(false));
  expect(sending(view)).toBe('Barton Springs Road, Austin, Texas');
  fireEvent.click(sendButton(view));
  expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ lat: 30.2615, lng: -97.7608, address: 'Barton Springs Road, Austin, Texas' }));
  view.unmount();
});
