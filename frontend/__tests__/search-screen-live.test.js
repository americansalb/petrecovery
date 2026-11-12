/** @jest-environment jsdom */
/**
 * The real search screen, rendered, for the things a rule read from its
 * source cannot see.
 *
 *   - While someone holds a street, or has been asked to walk one, their
 *     phone's map is drawn once and not on every render. (The first test
 *     of this used hand-built props and passed while the screen itself
 *     handed the map a new object every time.)
 *   - A word written to someone is on their card whatever else the card is
 *     showing, an ask included, and the card says when it has shown the
 *     word and the ask. That is what the desk reads as "seen".
 *   - On the desk, "Answer" writes to the person answered and never falls
 *     back to everyone.
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
      const map = { on: () => map, once: () => map, off: () => map, remove() {}, removeLayer() {}, getZoom: () => 16, setView: () => map, fitBounds() {}, invalidateSize() {}, attributionControl: { setPrefix() {}, getContainer: () => null } };
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
jest.mock('next/navigation', () => ({ __esModule: true, useSearchParams: () => ({ get: () => null }) }));
jest.mock('@/app/hooks/useInstrument', () => ({ __esModule: true, default: jest.fn(() => ({ instrument: 'bridge', resolving: false })), INSTRUMENTS: { COMMAND: 'command', FIELD: 'field', BRIDGE: 'bridge' } }));
jest.mock('@/app/mission-control/hooks/useSearch', () => ({ __esModule: true, default: jest.fn() }));

import useSearch from '@/app/mission-control/hooks/useSearch';
import SearchScreen from '@/app/mission-control/SearchScreen';
import Messages from '@/app/mission-control/desktop/Messages';

beforeAll(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Element.prototype.scrollIntoView = () => {};
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});
beforeEach(() => {
  made.groups.length = 0;
});

const NOW = new Date('2026-11-12T04:00:05Z').getTime();
const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
const draws = () => made.groups[0].clearLayers.mock.calls.length;
const street = (id, over = {}) => ({ id, name: `Elm ${id}`, title: `Elm ${id} from A St to B St`, fromName: 'A St', toName: 'B St', path: [[30.31, -97.74], [30.312, -97.74]], minutes: 10, center: { lat: 30.311, lng: -97.74 }, priority: 8, first: false, status: 'UNSEARCHED', searchCount: 0, marked: false, mine: false, reserved: false, ...over });
const picture = (over = {}) => ({
  id: 'case-1',
  caseNumber: 'AUS-1',
  reportType: 'LOST',
  open: true,
  timeZone: 'America/Chicago',
  pet: { name: 'Max', species: 'DOG' },
  lastSeen: { lat: 30.3148, lng: -97.7459, at: new Date(NOW - 86400000).toISOString(), place: 'Sinclair Ave' },
  owner: { firstName: 'Avery', phone: null },
  sightings: [],
  looking: { helpers: 1 },
  forces: 0,
  updates: [],
  viewer: { kind: 'volunteer', firstName: 'Dana', isOwner: false, seesNames: false, leads: false, waiver: true, signedIn: false },
  ...over,
});
/** What the hook hands the screen: one object while nothing has changed, as the hook gives. */
const hook = (over = {}) => {
  const items = over.items || [street('a')];
  return {
    loading: false,
    failure: null,
    picture: picture(),
    board: { unit: 'street' },
    unit: 'street',
    items,
    around: [],
    mine: items.find((i) => i.mine) || null,
    people: [],
    talk: [],
    words: [],
    viewer: picture().viewer,
    volunteer: { id: 'vol-1', name: 'Dana' },
    position: null,
    mySightings: [],
    hot: null,
    now: NOW,
    reload: jest.fn(),
    locate: jest.fn(async () => null),
    join: jest.fn(),
    acceptWaiver: jest.fn(),
    act: jest.fn(async () => ({ ok: true })),
    sendSighting: jest.fn(),
    answer: jest.fn(),
    tell: jest.fn(async () => ({ ok: true })),
    ask: jest.fn(),
    unask: jest.fn(),
    cannot: jest.fn(async () => ({ ok: true })),
    say: jest.fn(async () => ({ ok: true })),
    saw: jest.fn(async () => ({ ok: true })),
    ...over,
  };
};

describe('a phone\'s map is drawn when the search changes, with the real screen around it', () => {
  test.each([
    ['holding a street', { items: [street('a', { status: 'IN_PROGRESS', mine: true }), street('b')] }],
    ['asked to walk a street', { items: [street('a', { askedOfMe: true, askedNote: '', askedBy: 'Avery', askedSeen: true }), street('b')] }],
    ['with no street', {}],
  ])('%s: four renders, one drawing', async (_what, over) => {
    const state = hook(over);
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const first = draws();
    expect(first).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 4; i += 1) await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(draws() - first).toBe(0);
  });
});

describe('a word written to someone is on their card, and the card says when it has shown it', () => {
  const words = [{ id: 'm1', at: new Date(NOW - 60000).toISOString(), text: 'Do not go into the yard on the corner.', mine: false, from: 'Avery', seen: false }];

  test('with an ask on the card too: both are shown, and both are said to have been shown', async () => {
    const state = hook({ items: [street('a', { askedOfMe: true, askedNote: 'Check the alley.', askedBy: 'Avery', askedSeen: false }), street('b')], words });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const card = view.container.querySelector('[aria-label="Your step"]').textContent;
    expect(card).toMatch(/Avery asked you/);
    expect(card).toMatch(/Walk Elm a/);
    // The word is there with the ask, not hidden behind it.
    expect(card).toMatch(/Do not go into the yard on the corner\./);
    expect(state.saw).toHaveBeenCalledWith({ words: ['m1'] });
    expect(state.saw).toHaveBeenCalledWith({ ask: true });
    // Once each, however often the card is drawn again.
    const calls = state.saw.mock.calls.length;
    for (let i = 0; i < 3; i += 1) await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(state.saw.mock.calls.length).toBe(calls);
  });

  test('a word or an ask the screen has already said it showed is not said again', async () => {
    const state = hook({ items: [street('a', { askedOfMe: true, askedNote: '', askedBy: 'Avery', askedSeen: true })], words: [{ ...words[0], seen: true }] });
    useSearch.mockReturnValue(state);
    render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(state.saw).not.toHaveBeenCalled();
  });

  test('a page that is not in front of anyone has shown nothing, and says so when it is', async () => {
    const state = hook({ words });
    useSearch.mockReturnValue(state);
    let visible = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible });
    render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(state.saw).not.toHaveBeenCalled();
    visible = 'visible';
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(state.saw).toHaveBeenCalledWith({ words: ['m1'] });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  test('a computer does not show an ask, so it never says it did', async () => {
    const useInstrument = require('@/app/hooks/useInstrument').default;
    useInstrument.mockReturnValue({ instrument: 'command', resolving: false });
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const state = hook({ items: [street('a', { askedOfMe: true, askedNote: 'Check the alley.', askedBy: 'Avery', askedSeen: false })] });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(view.container.textContent).not.toMatch(/Avery asked you/);
    expect(state.saw).not.toHaveBeenCalledWith({ ask: true });
    useInstrument.mockReturnValue({ instrument: 'bridge', resolving: false });
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  });

  test('a phone on a street loses its signal: until the search has heard, the card says it again every half minute', async () => {
    const state = hook({ words });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const told = () => state.saw.mock.calls.filter(([what]) => what.words && what.words[0] === 'm1').length;
    expect(told()).toBe(1);
    // Half a minute on and the search still says "not seen": said again. The hook sends it only if the first was not heard.
    useSearch.mockReturnValue({ ...state, now: NOW + 31000 });
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(told()).toBe(2);
    // Heard: the search says "seen", and the card has nothing more to say however long it stays up.
    useSearch.mockReturnValue({ ...state, now: NOW + 62000, words: [{ ...words[0], seen: true }] });
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    useSearch.mockReturnValue({ ...state, now: NOW + 93000, words: [{ ...words[0], seen: true }] });
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(told()).toBe(2);
  });

  test('asked for another street while walking one: the street card shows the ask, and says it did', async () => {
    const state = hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true }), street('b', { askedOfMe: true, askedNote: 'Check the alley.', askedBy: 'Avery', askedSeen: false })] });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const card = view.container.querySelector('[aria-label="Your step"]').textContent;
    // Their own street is still the card, with its one button.
    expect(card).toMatch(/Walk Elm a/);
    expect(card).toMatch(/I walked it/);
    expect(card).toMatch(/Avery asked you/);
    expect(card).toMatch(/Walk Elm b\./);
    expect(state.saw).toHaveBeenCalledWith({ ask: true });
  });

  test('the answer line keeps what is being typed when a new word arrives above it', async () => {
    const state = hook({ words });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const box = view.getByPlaceholderText('Answer Avery');
    await act(async () => fireEvent.change(box, { target: { value: 'On my way to' } }));
    // A second word from the owner comes in on the next read.
    const more = hook({ words: [...words, { id: 'm2', at: new Date(NOW - 5000).toISOString(), text: 'And the gate.', mine: false, from: 'Avery', seen: false }] });
    useSearch.mockReturnValue({ ...state, words: more.words });
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(view.container.textContent).toMatch(/And the gate\./);
    expect(view.getByPlaceholderText('Answer Avery').value).toBe('On my way to');
  });
});

describe('on the desk, "Answer" writes to the person answered and never to everyone', () => {
  const owner = picture({ viewer: { kind: 'user', firstName: 'Avery', isOwner: true, seesNames: true, leads: true, waiver: true, signedIn: true } });
  const people = [{ handle: 'h-dana', name: 'Dana', state: 'free' }];
  const base = { picture: owner, items: [], now: NOW, people, words: [], onTo: jest.fn(), onSelect: jest.fn(), onFocus: jest.fn(), onAdd: jest.fn() };

  test('a person who is on the list is written to by name', async () => {
    const onTell = jest.fn(async () => ({ ok: true }));
    const onWord = jest.fn(async () => ({ ok: true }));
    const view = render(<Messages {...base} to="h-dana" onTell={onTell} onWord={onWord} />);
    const box = view.getByPlaceholderText('Write to Dana');
    await act(async () => fireEvent.change(box, { target: { value: 'Call me, I am at the corner.' } }));
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Send' })));
    expect(onWord).toHaveBeenCalledWith(people[0], 'Call me, I am at the corner.');
    expect(onTell).not.toHaveBeenCalled();
  });

  test('a person who is no longer on the list is not swapped for "everyone": there is nothing to type into', async () => {
    const onTell = jest.fn(async () => ({ ok: true }));
    const onWord = jest.fn(async () => ({ ok: true }));
    const view = render(<Messages {...base} to="h-gone" onTell={onTell} onWord={onWord} />);
    expect(view.container.textContent).toMatch(/That person is no longer on this search, so there is nowhere to send it\./);
    expect(view.queryByPlaceholderText('Write to everyone helping')).toBeNull();
    expect(view.container.querySelector('textarea')).toBeNull();
    expect(onTell).not.toHaveBeenCalled();
    expect(onWord).not.toHaveBeenCalled();
  });

  test('with nobody picked the owner writes to everyone, and the box says so', async () => {
    const onTell = jest.fn(async () => ({ ok: true }));
    const view = render(<Messages {...base} to={null} onTell={onTell} onWord={jest.fn()} />);
    expect(view.getByPlaceholderText('Write to everyone helping')).toBeTruthy();
  });
});
