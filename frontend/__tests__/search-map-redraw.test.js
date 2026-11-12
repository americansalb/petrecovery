/** @jest-environment jsdom */
/**
 * The map of a search is drawn when the search changes, and not otherwise.
 *
 * Drawing it clears every street, mark and label and makes them again, and
 * closes the label under the pointer. So it must not happen because a
 * clock ticked, a row was pointed at, or a poll came back the same. Before
 * this test the screen only promised that in a comment: a list that was
 * made new on every render (an empty default, the study's rings) sat among
 * what the drawing compares, and the whole map was redrawn on every render,
 * on a desk and on a phone.
 *
 * The map library is a stand-in that counts: `clearLayers` on the first
 * layer group of a map is one full redraw.
 */
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';

const made = { groups: [] };
jest.mock('leaflet', () => {
  const shape = () => ({
    addTo() {
      return this;
    },
    bindTooltip() {
      return this;
    },
    on() {
      return this;
    },
  });
  const L = {
    map: () => {
      const map = {
        on: () => map,
        once: () => map,
        off: () => map,
        remove() {},
        removeLayer() {},
        getZoom: () => 16,
        setView: () => map,
        fitBounds() {},
        invalidateSize() {},
        attributionControl: { setPrefix() {}, getContainer: () => null },
      };
      return map;
    },
    layerGroup: () => {
      const group = { addTo: () => group, clearLayers: jest.fn() };
      made.groups.push(group);
      return group;
    },
    tileLayer: shape,
    polyline: shape,
    rectangle: shape,
    circle: shape,
    marker: shape,
    divIcon: () => ({}),
    control: { zoom: () => ({ addTo() {} }) },
    latLngBounds: () => ({
      pad() {
        return this;
      },
    }),
    DomEvent: { stopPropagation() {} },
  };
  return { __esModule: true, default: L };
});
jest.mock('next/dynamic', () => ({ __esModule: true, default: () => require('@/app/mission-control/components/SearchMap').default }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }) => <a href={href}>{children}</a> }));

import SearchMap from '@/app/mission-control/components/SearchMap';
import Command from '@/app/mission-control/desktop/Command';

beforeAll(() => {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => {
  made.groups.length = 0;
});

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
/** How many times the map's own layer (the first group it makes) has been cleared and drawn. */
const draws = () => made.groups[0].clearLayers.mock.calls.length;

const NOW = new Date('2026-11-12T04:00:05Z').getTime();
const street = (id, over = {}) => ({ id, name: `Elm ${id}`, title: `Elm ${id} from A St to B St`, fromName: 'A St', toName: 'B St', path: [[30.31, -97.74], [30.312, -97.74]], minutes: 10, center: { lat: 30.311, lng: -97.74 }, priority: 8, first: false, status: 'UNSEARCHED', searchCount: 0, marked: false, mine: false, reserved: false, ...over });

describe('on a phone', () => {
  // The same objects on every render, as SearchScreen's memos and its NO_TRACK constant are. It passes no rings.
  const lastSeen = { lat: 30.3148, lng: -97.7459, label: 'Lost here' };
  const streets = [{ id: 'a', path: [[30.31, -97.74], [30.312, -97.74]], status: 'SEARCHED', mine: false, who: null }];
  const sightings = [];
  const cells = [];
  const track = [];
  const tags = [];
  const fit = [[30.3148, -97.7459]];
  const padding = { top: 44, right: 64, bottom: 324, left: 64 };
  const phone = () => <SearchMap theme="dark" lastSeen={lastSeen} sightings={sightings} streets={streets} cells={cells} me={null} track={track} tags={tags} fit={fit} fitKey="home|1|7" padding={padding} label="Map of the search for Max" />;

  test('the map is drawn once, however many times the screen around it renders', async () => {
    const view = render(phone());
    await settle();
    const first = draws();
    expect(first).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 4; i += 1) await act(async () => view.rerender(phone()));
    expect(draws() - first).toBe(0);
  });

  test('and with nothing passed for the lists it does not use, it is still drawn once', async () => {
    const bare = () => <SearchMap lastSeen={lastSeen} fit={fit} fitKey="home" padding={padding} />;
    const view = render(bare());
    await settle();
    const first = draws();
    for (let i = 0; i < 4; i += 1) await act(async () => view.rerender(bare()));
    expect(draws() - first).toBe(0);
  });

  test('a change in the search does draw it again', async () => {
    const view = render(phone());
    await settle();
    const first = draws();
    const changed = [{ ...streets[0], status: 'IN_PROGRESS' }];
    await act(async () => view.rerender(<SearchMap theme="dark" lastSeen={lastSeen} sightings={sightings} streets={changed} cells={cells} me={null} track={track} tags={tags} fit={fit} fitKey="home|1|7" padding={padding} />));
    expect(draws() - first).toBe(1);
  });
});

describe('on a desk', () => {
  const items = [street('a'), street('b', { status: 'SEARCHED', searchedAt: new Date(NOW - 3600000).toISOString(), searchCount: 1 }), street('c', { priority: 5 })];
  const picture = {
    id: 'case-1',
    caseNumber: 'AUS-1',
    open: true,
    timeZone: 'America/Chicago',
    pet: { name: 'Max', species: 'DOG' },
    lastSeen: { lat: 30.3148, lng: -97.7459, at: new Date(NOW - 86400000).toISOString(), place: 'Sinclair Ave' },
    owner: { firstName: 'Avery', phone: null },
    sightings: [],
    looking: { helpers: 0 },
    forces: 0,
    updates: [],
    viewer: { kind: 'user', firstName: 'Avery', isOwner: true, seesNames: true, leads: true, waiver: true, signedIn: true },
  };
  // One object for the hook's answer, as the hook gives while nothing has changed.
  const search = { people: [], talk: [], words: [], act: async () => ({}), tell: async () => ({}), ask: async () => ({}), unask: async () => ({}), say: async () => ({}) };
  const desk = (now, over = {}) => (
    <Command picture={picture} items={items} unit="street" now={now} line={{ text: 'Lost', tone: 'lost' }} petHref="/cases/AUS-1" onPhoto={() => {}} step={<p>step</p>} full={false} onBack={() => {}} onSeen={() => {}} onShare={() => {}} search={search} mapLabel="Map of the search for Max" overlays={null} {...over} />
  );

  test('a poll that comes back the same redraws nothing: only the clock moved', async () => {
    const view = render(desk(NOW));
    await settle();
    const first = draws();
    expect(first).toBeGreaterThanOrEqual(1);
    // The same picture and the same streets, five and ten seconds on, inside the same minute.
    await act(async () => view.rerender(desk(NOW + 5000)));
    await act(async () => view.rerender(desk(NOW + 10000)));
    expect(draws() - first).toBe(0);
  });

  test('pointing at a street in the list lights it without redrawing the search', async () => {
    const view = render(desk(NOW));
    await settle();
    await act(async () => fireEvent.click(view.getByRole('tab', { name: /^Streets/ })));
    const first = draws();
    const row = view.getAllByRole('button').find((b) => /Elm a from A St/.test(b.textContent) && b.getAttribute('aria-pressed') != null);
    expect(row).toBeDefined();
    await act(async () => fireEvent.mouseEnter(row));
    await act(async () => fireEvent.mouseLeave(row));
    await act(async () => fireEvent.click(row));
    expect(draws() - first).toBe(0);
  });

  test('the study\'s rings are drawn when asked for, once, and not again on the next tick', async () => {
    const view = render(desk(NOW));
    await settle();
    const first = draws();
    await act(async () => fireEvent.click(view.getByRole('button', { name: /^Show 400 ft and 1 mile around where Max was lost$/ })));
    expect(draws() - first).toBe(1);
    await act(async () => view.rerender(desk(NOW + 5000)));
    expect(draws() - first).toBe(1);
  });

  test('a street that changed is drawn', async () => {
    const view = render(desk(NOW));
    await settle();
    const first = draws();
    const changed = [street('a', { status: 'IN_PROGRESS', claimedByName: 'Dana', claimedAt: new Date(NOW).toISOString() }), items[1], items[2]];
    await act(async () => view.rerender(desk(NOW + 5000, { items: changed })));
    expect(draws() - first).toBe(1);
  });

  test('with no board at all the list does not say every street has been walked', async () => {
    const view = render(desk(NOW, { items: [] }));
    await settle();
    await act(async () => fireEvent.click(view.getByRole('tab', { name: /^Streets/ })));
    expect(view.container.textContent).toMatch(/The streets of this search are not here yet\./);
    expect(view.container.textContent).not.toMatch(/Every street has been walked/);
  });
});
