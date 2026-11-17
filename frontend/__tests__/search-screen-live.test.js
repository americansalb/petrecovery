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

const made = { groups: [], polygons: [], markers: [] };
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
      const map = { on: () => map, once: () => map, off: () => map, remove() {}, removeLayer() {}, getZoom: () => 16, getCenter: () => ({ lat: 30.3, lng: -97.7 }), distance: () => 500, getBounds: () => ({ pad: () => ({ contains: () => true }) }), panTo() {}, setView: () => map, fitBounds() {}, invalidateSize() {}, attributionControl: { setPrefix() {}, getContainer: () => null } };
      return map;
    },
    layerGroup: () => {
      const group = { addTo: () => group, clearLayers: jest.fn() };
      made.groups.push(group);
      return group;
    },
    tileLayer: shape,
    // What an area is drawn with, so a test can read its green.
    polygon: (points, options) => {
      made.polygons.push({ points, options });
      return shape();
    },
    polyline: shape,
    rectangle: shape,
    circle: shape,
    // What a mark is drawn with, so a test can read its words and whether it answers a tap.
    marker: (at, options) => {
      const mark = { at, options, tooltip: null, ...shape() };
      mark.bindTooltip = (content) => {
        mark.tooltip = content;
        return mark;
      };
      made.markers.push(mark);
      return mark;
    },
    divIcon: (options) => ({ html: options?.html || null }),
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

/**
 * Where things are, since this browser lays nothing out: a phone 844 tall, its sheet from 300 down, the buttons
 * kept at the sheet's bottom from 700, and everything else (a word, the line to answer in) where `place.word`
 * says. A test moves `place.word` to put a word under the buttons or back above them.
 */
const place = { word: { top: 400, bottom: 440 } };
beforeAll(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Element.prototype.scrollIntoView = () => {};
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Element.prototype.getBoundingClientRect = function box() {
    const at = this.hasAttribute('data-sheet') ? { top: 300, bottom: 844 } : this.hasAttribute('data-pinned') ? { top: 700, bottom: 834 } : place.word;
    return { top: at.top, bottom: at.bottom, left: 0, right: 390, width: 390, height: at.bottom - at.top, x: 0, y: at.top };
  };
});
beforeEach(() => {
  made.groups.length = 0;
  made.polygons.length = 0;
  made.markers.length = 0;
  place.word = { top: 400, bottom: 440 };
  // What a phone has put away ("Got it") is kept in the browser: each test starts with nothing put away.
  window.localStorage.clear();
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

  test('a word under the buttons has not been shown: it is said when it is scrolled to where it can be read', async () => {
    // Its middle is at 750, and the buttons kept at the bottom of the sheet start at 700.
    place.word = { top: 720, bottom: 780 };
    const state = hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true })], words });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(view.container.querySelector('[aria-label="Your step"]').textContent).toMatch(/Do not go into the yard/);
    expect(state.saw).not.toHaveBeenCalledWith({ words: ['m1'] });
    // The sheet is scrolled, and the word is above the buttons now.
    place.word = { top: 500, bottom: 560 };
    await act(async () => view.container.querySelector('[data-sheet]').dispatchEvent(new Event('scroll')));
    expect(state.saw).toHaveBeenCalledWith({ words: ['m1'] });
  });

  test('a new word moves the sheet so it, and the line to answer in, are above the buttons', async () => {
    // The end of what was said is at 780: 80 below the top of the buttons.
    place.word = { top: 720, bottom: 780 };
    const state = hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true })], words });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const sheet = view.container.querySelector('[data-sheet]');
    expect(sheet.scrollTop).toBe(88);
    // Drawn again with nothing new said, the sheet is left where the person put it.
    sheet.scrollTop = 20;
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(sheet.scrollTop).toBe(20);
    // A second word arrives: it moves again.
    useSearch.mockReturnValue({ ...state, words: [...words, { id: 'm2', at: new Date(NOW - 5000).toISOString(), text: 'Come to the corner when you are done.', mine: false, from: 'Avery', seen: false }] });
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(sheet.scrollTop).toBe(108);
  });

  test('on a phone the one main button is kept on the sheet, with "I\'ve seen" under it, whatever the card is', async () => {
    const pinnedWords = (view) => (view.container.querySelector('[data-pinned]')?.textContent || '');
    // Holding a street.
    useSearch.mockReturnValue(hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true })], words }));
    let view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(pinnedWords(view)).toMatch(/I walked it/);
    expect(pinnedWords(view)).toMatch(/I've seen Max/);
    // What was said is not in with the buttons: it scrolls under them.
    expect(pinnedWords(view)).not.toMatch(/Do not go into the yard/);
    view.unmount();
    // With no street.
    useSearch.mockReturnValue(hook({ words }));
    view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(pinnedWords(view)).toMatch(/I can walk a street/);
    expect(pinnedWords(view)).toMatch(/I've seen Max/);
    view.unmount();
    // Asked to walk one.
    useSearch.mockReturnValue(hook({ items: [street('a', { askedOfMe: true, askedNote: '', askedBy: 'Avery', askedSeen: true })] }));
    view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(pinnedWords(view)).toMatch(/Start/);
  });

  test('everything after the kept buttons is reached by scrolling the card, and is drawn over the cover under them', async () => {
    // 2026-11-17, a 375 px phone: scrolled to the end of the first card, "Call Avery" and "Share" sat under the
    // buttons' cover (the strip that hides what scrolls under them) and could not be seen.
    useSearch.mockReturnValue(hook({ picture: picture({ owner: { firstName: 'Avery', phone: '5125550100' } }) }));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const pinned = view.container.querySelector('[data-pinned]');
    // Only the main button and "I've seen" are kept in place.
    expect(pinned.textContent).not.toMatch(/Call Avery|Share/);
    const after = [];
    for (let el = pinned.nextElementSibling; el; el = el.nextElementSibling) after.push(el.textContent);
    expect(after.join(' ')).toMatch(/Call Avery.*Share/);
    // What follows the kept buttons is lifted over the cover they cast below themselves.
    expect(pinned.className).toMatch(/shadow-\[0_48px_0_0_var\(--mc-surface\)\]/);
    expect(pinned.className).toMatch(/\[&~\*\]:relative \[&~\*\]:z-\[11\]/);
  });

  test('a desk keeps nothing in place: its card is one of several in a column', async () => {
    const useInstrument = require('@/app/hooks/useInstrument').default;
    useInstrument.mockReturnValue({ instrument: 'command', resolving: false });
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    useSearch.mockReturnValue(hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true })], words }));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(view.container.textContent).toMatch(/I walked it/);
    expect(view.container.querySelector('[data-pinned]')).toBeNull();
    useInstrument.mockReturnValue({ instrument: 'bridge', resolving: false });
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  });

  test('"Got it" folds what was said into one line, and the line opens it again', async () => {
    const state = hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true })], words: [{ ...words[0], seen: true }] });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const card = () => view.container.querySelector('[aria-label="Your step"]').textContent;
    expect(card()).toMatch(/Do not go into the yard on the corner\./);
    expect(view.queryByPlaceholderText('Answer Avery')).not.toBeNull();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Got it' })));
    // One line in its place: whose it was and when. The words and the answer line are gone, and the buttons are not.
    expect(card()).toMatch(/Avery wrote to you at 9:59 pm/);
    expect(card()).not.toMatch(/Do not go into the yard/);
    expect(view.queryByPlaceholderText('Answer Avery')).toBeNull();
    expect(card()).toMatch(/I walked it/);
    // The line opens it again, to read or to answer after all.
    await act(async () => fireEvent.click(view.getByRole('button', { name: /Avery wrote to you at 9:59 pm/ })));
    expect(card()).toMatch(/Do not go into the yard on the corner\./);
    expect(view.queryByPlaceholderText('Answer Avery')).not.toBeNull();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Close' })));
    expect(card()).not.toMatch(/Do not go into the yard/);
  });

  test('an answer folds it too, and the line says the answer went', async () => {
    const answered = [{ ...words[0], seen: true }, { id: 'm2', at: new Date(NOW - 20000).toISOString(), text: 'Understood.', mine: true, from: null }];
    useSearch.mockReturnValue(hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true })], words: answered }));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const card = view.container.querySelector('[aria-label="Your step"]').textContent;
    expect(card).toMatch(/You answered Avery at 9:59 pm/);
    expect(card).not.toMatch(/Do not go into the yard/);
  });

  test('a new word opens a folded card by itself', async () => {
    const answered = [{ ...words[0], seen: true }, { id: 'm2', at: new Date(NOW - 20000).toISOString(), text: 'Understood.', mine: true, from: null }];
    const state = hook({ items: [street('a', { status: 'IN_PROGRESS', mine: true })], words: answered });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(view.container.textContent).toMatch(/You answered Avery/);
    useSearch.mockReturnValue({ ...state, words: [...answered, { id: 'm3', at: new Date(NOW - 2000).toISOString(), text: 'Come to the corner when you are done.', mine: false, from: 'Avery', seen: false }] });
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    const card = view.container.querySelector('[aria-label="Your step"]').textContent;
    expect(card).toMatch(/Come to the corner when you are done\./);
    expect(view.queryByPlaceholderText('Answer Avery')).not.toBeNull();
    expect(state.saw).toHaveBeenCalledWith({ words: ['m3'] });
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

describe('a phone holding an area', () => {
  // Founder, 2026-11-14, on the area card: "Text takes up 80% of screen".
  const ground = (over = {}) => ({
    id: 'z-east', key: 'east', ring: 1, name: 'East side', title: 'East side',
    reach: '150 m to 400 m east of where Max was lost', landmarks: ['Elm St', 'Oak Ave'],
    center: { lat: 30.3148, lng: -97.743 }, outline: [[30.316, -97.744], [30.313, -97.744], [30.3148, -97.741]],
    minutes: 45, priority: 6, status: 'IN_PROGRESS', on: 1, searchCount: 0, mine: true, ...over,
  });
  const onArea = () => {
    const items = [ground()];
    return { ...hook({ items }), unit: 'area', board: { unit: 'area' }, circle: { center: { lat: 30.3148, lng: -97.7459 }, radius: 400 } };
  };

  test('closed over the map, the card is the area and how long, and Sarama\'s row opens the rest', async () => {
    const { searcherBrief } = require('@/app/mission-control/lib/briefLines');
    const brief = searcherBrief(picture());
    useSearch.mockReturnValue(onArea());
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const card = () => view.container.querySelector('[aria-label="Your step"]').textContent;
    expect(card()).toMatch(/Search the east side/);
    expect(card()).toMatch(/Around Elm St and Oak Ave\. About 45 minutes\./);
    expect(card()).not.toContain(brief.look);
    expect(card()).not.toMatch(/150 m to 400 m east/);
    // What to do on seeing the pet is on the map meanwhile, in the brief's own words.
    expect(view.container.textContent).toContain(brief.neverFirst);
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'How to search here' })));
    expect(card()).toContain(brief.look);
    expect(card()).toContain(brief.call);
    expect(card()).toMatch(/150 m to 400 m east of where Max was lost, around Elm St and Oak Ave\./);
    expect(view.getByRole('button', { name: 'Show the map' }).getAttribute('aria-expanded')).toBe('true');
  });

  test('the handle closes it again, and the buttons are there either way', async () => {
    useSearch.mockReturnValue(onArea());
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const pinned = () => view.container.querySelector('[data-pinned]').textContent;
    expect(pinned()).toMatch(/I searched it/);
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'How to search here' })));
    expect(pinned()).toMatch(/I searched it/);
    // A key press on the handle (a finger is answered on the way up, a key by the click).
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Show the map' }), { detail: 0 }));
    expect(view.getByRole('button', { name: 'Show all of the card' }).getAttribute('aria-expanded')).toBe('false');
    expect(view.getByRole('button', { name: 'How to search here' })).toBeTruthy();
  });
});

/**
 * A search of ground on a phone, from what its record says: the green fades, a search of a few seconds leaves no
 * paw prints, "I am stopping" is leaving, and "Before you go out" is not skipped by a reload.
 */
describe('a phone on a search of ground', () => {
  const at = (minutes) => new Date(NOW - minutes * 60000).toISOString();
  const outline = (lat) => [[lat, -97.747], [lat - 0.002, -97.747], [lat - 0.002, -97.744], [lat, -97.744], [lat, -97.747]];
  const area = (key, lat, over = {}) => ({
    id: `z-${key}`, key, ring: 1, name: `${key[0].toUpperCase()}${key.slice(1)} side`, title: `${key} side`,
    reach: `150 m to 400 m ${key} of where Max was lost`, landmarks: [], hazards: [],
    center: { lat: lat - 0.001, lng: -97.7455 }, outline: outline(lat),
    minutes: 45, priority: 6, status: 'UNSEARCHED', on: 0, coming: 0, searchCount: 0, searchedAt: null, history: [], mine: false, full: false, ...over,
  });
  const searchedAt = (minutes, more = {}) => ({ status: 'SEARCHED', searchCount: 1, searchedAt: at(minutes), history: [{ at: at(minutes), marked: false, minutes: 40, covered: 'ALL', ...more }] });
  const onGround = (items, over = {}) => ({ ...hook({ items, ...over }), unit: 'area', board: { unit: 'area' }, circle: { center: { lat: 30.3148, lng: -97.7459 }, radius: 400 }, trail: null, ways: [], debrief: jest.fn(async () => ({ ok: true })), trained: jest.fn(async () => undefined), ...over });
  const card = (view) => view.container.querySelector('[aria-label="Your step"]').textContent;
  const green = (item) => made.polygons.filter((p) => p.points === item.outline).pop()?.options.fillOpacity;
  // The join card reads the waiver's text when it opens.
  const realFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ version: '3', content: 'The waiver.' }) }));
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  test('the map draws a search fading over a day, as the desk does: two days old is bare, and a search of seconds is not a full one', async () => {
    const fresh = area('north', 30.318, searchedAt(10));
    const old = area('south', 30.312, searchedAt(50 * 60));
    // "I searched it" fourteen seconds after taking it, and "Most of it".
    const tapped = area('east', 30.315, searchedAt(1, { minutes: 0.2, covered: 'MOST' }));
    useSearch.mockReturnValue(onGround([fresh, old, tapped]));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(green(fresh)).toBeGreaterThan(0.5);
    // Searched two days ago: nothing is left of it but the faint fill every searched area has.
    expect(green(old)).toBeCloseTo(0.06, 2);
    expect(green(tapped)).toBeLessThan(0.07);
    // The key says the green fades, and never a bare "searched".
    expect(view.container.textContent).toMatch(/Searched just now/);
    expect(view.container.textContent).toMatch(/Fades over a day/);
    expect(view.container.textContent).not.toMatch(/Already searched/);
  });

  test('with every search faded, the key has no green to explain', async () => {
    useSearch.mockReturnValue(onGround([area('north', 30.318, searchedAt(30 * 60)), area('south', 30.312)]));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(view.container.textContent).not.toMatch(/Searched just now|Already searched/);
  });

  test('"I searched it" seconds after taking an area: no cheer and no paw prints, and Sarama says nothing of it', async () => {
    const mine = area('east', 30.315, { status: 'IN_PROGRESS', on: 1, mine: true });
    const after = onGround([area('east', 30.315, searchedAt(0, { minutes: 0.2 }))]);
    const state = onGround([mine], { act: jest.fn(async () => { useSearch.mockReturnValue(after); return { ok: true, paws: 0 }; }) });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I searched it' })));
    expect(state.act).toHaveBeenCalledWith('area', 'z-east', 'searched');
    expect(card(view)).toMatch(/Thank you, Dana/);
    expect(card(view)).not.toMatch(/paw prints|Well done|\+3|Sarama says/);
    expect(view.queryByRole('img', { name: /paw print/ })).toBeNull();
    // The debrief is still asked.
    expect(card(view)).toMatch(/How much of it did you cover\?/);
    // No count of the areas "searched so far" either: the trail's own count is what is true now.
    expect(card(view)).not.toMatch(/searched so far/);
  });

  test('the thanks is theirs: their name, the area with when it was searched, the debrief, and two ways on', async () => {
    const mine = area('east', 30.315, { status: 'IN_PROGRESS', on: 1, mine: true });
    const after = onGround([area('east', 30.315, searchedAt(0))]);
    const state = onGround([mine], { act: jest.fn(async () => { useSearch.mockReturnValue(after); return { ok: true, paws: 3 }; }) });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I searched it' })));
    const text = card(view);
    expect(text).toMatch(/^Thank you, Dana/);
    // Never a bare "searched": the time is said with it.
    expect(text).toMatch(/The east side searched at \d{1,2}:\d\d (am|pm)\./);
    expect(text).not.toMatch(/is searched|Help look for Max/);
    expect(text).toMatch(/How much of it did you cover\?/);
    expect(view.getByRole('button', { name: 'Search another area' })).toBeTruthy();
    // "I'm done for now" does what "I am stopping" does, with nothing held to hand back.
    state.act.mockClear();
    await act(async () => fireEvent.click(view.getByRole('button', { name: "I'm done for now" })));
    expect(state.act).not.toHaveBeenCalled();
    expect(card(view)).toMatch(/^Thank you for looking for Max/);
    expect(view.getByRole('button', { name: 'Search again' })).toBeTruthy();
  });

  test('a real search is cheered, with the prints the server counted', async () => {
    const mine = area('east', 30.315, { status: 'IN_PROGRESS', on: 1, mine: true });
    const after = onGround([area('east', 30.315, searchedAt(0))]);
    const state = onGround([mine], { act: jest.fn(async () => { useSearch.mockReturnValue(after); return { ok: true, paws: 3 }; }) });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I searched it' })));
    expect(card(view)).toMatch(/Well done\. That is 3 paw prints on this search\./);
    expect(view.getByRole('img', { name: '3 paw prints' })).toBeTruthy();
  });

  test('"I am stopping" is leaving: a short card thanks them, says how to share the link, and does not ask them to help', async () => {
    const trail = { paws: 7, helpers: 1, mine: { searches: 2, debriefs: 1, paws: 7, rank: 'Scout' } };
    const viewer = { ...picture().viewer, trained: true };
    const mine = area('east', 30.315, { status: 'IN_PROGRESS', on: 1, mine: true });
    const after = onGround([area('east', 30.315)], { trail, picture: picture({ viewer }), viewer });
    const state = onGround([mine], { trail, picture: picture({ viewer }), viewer, act: jest.fn(async () => { useSearch.mockReturnValue(after); return { ok: true }; }) });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I am stopping' })));
    expect(state.act).toHaveBeenCalledWith('area', 'z-east', 'release');
    const text = card(view);
    expect(text).toMatch(/^Thank you for looking for Max/);
    expect(text).toMatch(/Send the link to neighbors\. It shows them where to look and how to send a sighting\./);
    expect(view.getByRole('button', { name: 'Share the link' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Search again' })).toBeTruthy();
    // Not the card that asks people to help, and no second thanks from Sarama under the heading's.
    expect(text).not.toMatch(/Help look for Max|I can search an area|Thank you for your time|Sarama says|Keep the map green/);
    // "Search again" takes ground again, through the same door as anyone.
    after.act = jest.fn(async () => ({ ok: true }));
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Search again' })));
    expect(after.act).toHaveBeenCalledWith('area', 'z-east', 'claim');
    // Opening the link again another time is coming back: she says nothing then, rather than a greeting that sits
    // in the way of the card (founder, 2026-11-17: "saRama keeps getting in the way").
    view.unmount();
    useSearch.mockReturnValue(after);
    const again = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(card(again)).not.toMatch(/Good to see you again|Thank you for/);
    expect(card(again)).toMatch(/Help look for Max/);
  });

  test('"Before you go out" is not skipped by a reload: agreed, not trained, and asking for ground shows it first', async () => {
    const viewer = { ...picture().viewer, waiver: true, trained: false };
    const state = onGround([area('north', 30.318), area('south', 30.312)], { picture: picture({ viewer }), viewer, act: jest.fn(async () => ({ ok: true })) });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I can search an area' })));
    // The training, and not the tick again: they have agreed.
    expect(card(view)).toMatch(/Before you go out/);
    expect(card(view)).not.toMatch(/I agree/);
    expect(state.act).not.toHaveBeenCalled();
    // Its one button records it and gives them their ground.
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I understand. Give me an area' })));
    expect(state.trained).toHaveBeenCalledTimes(1);
    expect(state.act).toHaveBeenCalledWith('area', expect.any(String), 'claim');
  });

  test('"Before you go out" shows every point by its title, each one tap from what it means, and nothing is skipped', async () => {
    const { searchTraining } = require('@/app/lib/safetyRules');
    const points = searchTraining('Max');
    const viewer = { ...picture().viewer, waiver: true, trained: false };
    useSearch.mockReturnValue(onGround([area('north', 30.318)], { picture: picture({ viewer }), viewer, act: jest.fn(async () => ({ ok: true })) }));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I can search an area' })));
    const items = [...view.container.querySelectorAll('[aria-label="Your step"] ol > li')];
    expect(items.map((li) => li.textContent)).toEqual(points.map((p, i) => `${i + 1}${p.title}${p.text}`));
    // Each title is a button; what it means is under it, hidden until it is tapped, and one is open at a time.
    const chase = view.getByRole('button', { name: /Do not chase or grab/ });
    const phone = view.getByRole('button', { name: /Phone away while you move/ });
    const said = (button) => view.container.querySelector(`#${button.getAttribute('aria-controls')}`);
    expect(chase.getAttribute('aria-expanded')).toBe('false');
    expect(said(chase).hidden).toBe(true);
    await act(async () => fireEvent.click(chase));
    expect(chase.getAttribute('aria-expanded')).toBe('true');
    expect(said(chase).hidden).toBe(false);
    expect(said(chase).textContent).toBe(points[3].text);
    await act(async () => fireEvent.click(phone));
    expect(said(phone).hidden).toBe(false);
    expect(said(chase).hidden).toBe(true);
    // The last point is its title alone: nothing to open.
    expect(view.queryByRole('button', { name: /local emergency number/ })).toBeNull();
    expect(card(view)).not.toMatch(/optional|skip|later/i);
  });

  test('"Read them" opens the rules and the waiver over the whole screen, set to be read, and closes back to the tick', async () => {
    const content = '# Liability Waiver and Assumption of Risk\n\nVersion 3.\n\n## In short\n\n- You search at your own risk.\n- Nobody is watching where you are.';
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ version: '3', content }) }));
    const viewer = { ...picture().viewer, waiver: false, trained: false };
    useSearch.mockReturnValue(onGround([area('north', 30.318)], { picture: picture({ viewer }), viewer }));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I can search an area' })));
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Read them' })));
    const dialog = view.getByRole('dialog', { name: 'Safety rules and waiver' });
    // On the page's body, not inside the card's sheet.
    expect(dialog.closest('[aria-label="Your step"]')).toBeNull();
    expect([...dialog.querySelectorAll('h3, h4')].map((h) => h.textContent)).toEqual(['Safety rules', 'Liability Waiver and Assumption of Risk', 'In short']);
    expect([...dialog.querySelectorAll('li')].map((li) => li.textContent)).toEqual(expect.arrayContaining(['You search at your own risk.', 'Nobody is watching where you are.']));
    // No mark of the markdown is left on what is read.
    expect(dialog.textContent).not.toMatch(/# |- You/);
    await act(async () => fireEvent.click(view.getAllByRole('button', { name: 'Close' })[0]));
    expect(view.queryByRole('dialog')).toBeNull();
    expect(card(view)).toMatch(/Join the search/);
  });

  test('someone who has been through it is given ground at once, and someone who has not agreed is asked to first', async () => {
    const trained = { ...picture().viewer, waiver: true, trained: true };
    let state = onGround([area('north', 30.318)], { picture: picture({ viewer: trained }), viewer: trained, act: jest.fn(async () => ({ ok: true })) });
    useSearch.mockReturnValue(state);
    let view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I can search an area' })));
    expect(state.act).toHaveBeenCalledWith('area', 'z-north', 'claim');
    expect(card(view)).not.toMatch(/Before you go out/);
    view.unmount();
    const fresh = { ...picture().viewer, waiver: false, trained: false };
    state = onGround([area('north', 30.318)], { picture: picture({ viewer: fresh }), viewer: fresh, act: jest.fn(async () => ({ ok: true })) });
    useSearch.mockReturnValue(state);
    view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'I can search an area' })));
    expect(card(view)).toMatch(/Join the search/);
    expect(state.act).not.toHaveBeenCalled();
  });

  // 2026-11-17, on a 375 px phone: nine labels on a strip of map, seven pairs on top of each other, and the key over
  // the pins. Now only where the pet was lost and the newest sighting carry words, and the key is a chip.
  test('the map names only where the pet was lost and the newest sighting; an older one is a dot that says when on a tap', async () => {
    const seen = (id, minutes, lat) => ({ id, at: at(minutes), lat, lng: -97.7455, place: null });
    const sightings = [seen('s3', 200, 30.312), seen('s2', 300, 30.313), seen('s1', 400, 30.316)];
    useSearch.mockReturnValue(onGround([area('north', 30.318)], { picture: picture({ sightings }) }));
    render(<SearchScreen mission="AUS-1" />);
    await settle();
    const words = (mark) => mark.options.icon?.html?.querySelector?.('[data-words]')?.textContent || '';
    const marks = made.markers.filter((m) => sightings.some((s) => s.lat === m.at[0]));
    expect(marks).toHaveLength(3);
    const named = marks.filter((m) => words(m));
    expect(named).toHaveLength(1);
    expect(named[0].at[0]).toBe(30.312);
    expect(words(named[0])).toMatch(/^Seen /);
    for (const dot of marks.filter((m) => !words(m))) {
      expect(dot.options.interactive).toBe(true);
      expect(dot.options.title).toMatch(/^Seen /);
      expect(dot.tooltip.textContent).toBe(dot.options.title);
    }
    // Where the pet was lost keeps its words.
    expect(made.markers.some((m) => /^Lost here /.test(words(m)))).toBe(true);
  });

  test('on a phone the key is a "Key" chip: its words are there, and shown when it is pressed', async () => {
    useSearch.mockReturnValue(onGround([area('north', 30.318, searchedAt(10)), area('south', 30.312)]));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    const chip = view.getByRole('button', { name: 'Key' });
    const key = view.container.querySelector('#mc-map-key');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.getAttribute('aria-controls')).toBe('mc-map-key');
    expect(key.hidden).toBe(true);
    expect(key.textContent).toMatch(/Searched just now.*Fades over a day/);
    await act(async () => fireEvent.click(chip));
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(key.hidden).toBe(false);
    // The chip, the line at the top and the card are what the map's labels keep clear of.
    expect(chip.closest('[data-map-cover]')).toBeTruthy();
    expect(view.container.querySelector('section[aria-label="Your step"]').hasAttribute('data-map-cover')).toBe(true);
    await act(async () => fireEvent.click(chip));
    expect(key.hidden).toBe(true);
  });

  test('the owner\'s card says how much is searched now, not how much was ever searched', async () => {
    const owner = picture({ viewer: { kind: 'user', firstName: 'Avery', isOwner: true, seesNames: true, leads: true, waiver: true, trained: true, signedIn: true } });
    const items = [area('north', 30.318, searchedAt(60)), area('east', 30.315, searchedAt(30 * 60)), area('south', 30.312, searchedAt(50 * 60)), area('west', 30.309)];
    useSearch.mockReturnValue(onGround(items, { picture: owner, viewer: owner.viewer }));
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    // In figures, with the age in the label: "1 of 4", "areas searched in the last 12 hours".
    const standing = view.container.querySelector('dl[aria-label="Where the search stands"]').textContent;
    expect(standing).toMatch(/areas searched in the last 12 hours1 of 4/);
    expect(card(view)).not.toMatch(/3 of 4|3 of the 4 areas/);
  });

  test('the owner can search too: the area around home, through the same claim, with no waiver to sign', async () => {
    const owner = picture({ viewer: { kind: 'user', firstName: 'Avery', isOwner: true, seesNames: true, leads: true, waiver: true, trained: false, signedIn: true } });
    const middle = area('middle', 30.3148, { ring: 0, name: 'The middle', reach: 'Within 150 m of where Max was lost', minutes: 30 });
    const state = onGround([middle, area('north', 30.318)], { picture: owner, viewer: owner.viewer, act: jest.fn(async () => ({ ok: true })) });
    useSearch.mockReturnValue(state);
    const view = render(<SearchScreen mission="AUS-1" />);
    await settle();
    expect(card(view)).not.toMatch(/What to do now/);
    // Three steps of the engine's advice are on the card, without a tap.
    expect(view.container.querySelectorAll('section[aria-label="What to do"] li')).toHaveLength(3);
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Search the area around home' })));
    expect(state.act).toHaveBeenCalledWith('area', 'z-middle', 'claim');
    // Named, not ranked: the phone is not asked where it is, and nobody is sent to the join card.
    expect(state.locate).not.toHaveBeenCalled();
    expect(card(view)).not.toMatch(/Join the search|Before you go out/);
    // On it, the card is that area and its one button says it is searched.
    useSearch.mockReturnValue({ ...state, items: [{ ...middle, mine: true, status: 'IN_PROGRESS', on: 1 }, area('north', 30.318)], mine: { ...middle, mine: true, status: 'IN_PROGRESS', on: 1 } });
    await act(async () => view.rerender(<SearchScreen mission="AUS-1" />));
    expect(card(view)).toMatch(/You are searchingThe middleWithin 150 m of where Max was lost\. About 30 minutes\./);
    expect(view.getByRole('button', { name: 'I searched it' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'I am stopping' })).toBeTruthy();
  });
});
