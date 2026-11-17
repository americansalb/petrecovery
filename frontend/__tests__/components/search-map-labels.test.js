/** @jest-environment jsdom */
/**
 * The labels on a phone's search map (app/mission-control/components/SearchMap.js, tidyWords).
 *
 * 2026-11-17, on a 375 px phone: nine labels shared a 219 px strip of map,
 * seven pairs lay on top of each other, "Lost here Fri 12:48 am" ran 53 px
 * past the edge of the screen and the map's key sat over the pins. Now each
 * label is put on a side of its mark where it fits: inside the map, clear of
 * every label already placed and of what the screen lays over the map. The
 * most needed are placed first, and one that fits nowhere is left off.
 *
 * jsdom lays nothing out, so this file does: a mark is at the point its
 * root names, and a label's box follows the side its style puts it on, as
 * the browser would.
 */
import { tidyWords } from '@/app/mission-control/components/SearchMap';

const H = 23;
function boxOf(el) {
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top });
  if (el.dataset.box) {
    const [l, t, r, b] = el.dataset.box.split(',').map(Number);
    return rect(l, t, r - l, b - t);
  }
  if (el.hasAttribute('data-dot')) {
    const root = el.parentElement;
    const size = Number(el.dataset.size || 14);
    return rect(Number(root.dataset.x) - size / 2, Number(root.dataset.y) - size / 2, size, size);
  }
  if (el.hasAttribute('data-words')) {
    const root = el.parentElement;
    const x = Number(root.dataset.x);
    const y = Number(root.dataset.y);
    const w = Number(el.dataset.width);
    const s = el.style;
    const left = s.right ? x - parseFloat(s.right) - w : s.transform ? x - w / 2 : x + parseFloat(s.left);
    const top = s.bottom ? y - parseFloat(s.bottom) - H : y + parseFloat(s.top);
    return rect(left, top, w, H);
  }
  return rect(0, 0, 0, 0);
}

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return boxOf(this);
  };
});

/** A map 375 wide whose visible strip is 92 to 311, as on a 375 x 667 phone. */
function holder() {
  document.body.innerHTML = '';
  const map = document.createElement('div');
  map.dataset.box = '0,92,375,667';
  document.body.appendChild(map);
  return map;
}

/** A mark with a label beside it, as the map's own `tagged` builds it. */
function mark(map, { x, y, text, side = 'right', rank = 10, width = 120, dot = true }) {
  const root = document.createElement('div');
  root.dataset.x = String(x);
  root.dataset.y = String(y);
  if (dot) {
    const d = document.createElement('span');
    d.dataset.dot = '';
    root.appendChild(d);
  }
  if (text) {
    const words = document.createElement('span');
    words.textContent = text;
    words.dataset.words = side;
    words.dataset.rank = String(rank);
    words.dataset.width = String(width);
    Object.assign(words.style, side === 'left' ? { top: '-13px', right: '16px' } : { top: '-13px', left: '16px' });
    root.appendChild(words);
  }
  map.appendChild(root);
  return root.querySelector('[data-words]');
}

/** What the screen lays over the map: the line at the top, the key, the card. */
function cover(box) {
  const el = document.createElement('div');
  el.setAttribute('data-map-cover', '');
  el.dataset.box = box;
  document.body.appendChild(el);
  return el;
}

const shown = (el) => el.style.visibility !== 'hidden';
const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('a label that would run off the screen is moved to the side of its mark that fits', () => {
  const map = holder();
  // Where Max was lost, 30 px from the right edge: beside it on the right, "Lost here" ended at 437 on a 375 screen.
  const lost = mark(map, { x: 300, y: 200, text: 'Lost here Fri 12:48 am', rank: 60, width: 154 });
  tidyWords(map, null);
  const box = lost.getBoundingClientRect();
  expect(shown(lost)).toBe(true);
  expect(box.right).toBeLessThanOrEqual(375);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(lost.style.right).toBe('16px');
});

test('labels never lie on each other or on what covers the map, and the most needed is kept', () => {
  const map = holder();
  cover('12,104,285,140'); // "If you see Max, don't chase or call out."
  cover('12,258,82,302'); // the "Key" chip
  cover('0,311,375,667'); // the card
  const lost = mark(map, { x: 150, y: 200, text: 'Lost here Fri 12:48 am', rank: 60, width: 154 });
  const seen = mark(map, { x: 160, y: 205, text: 'Seen 8:54 pm', rank: 50, width: 104 });
  const who = mark(map, { x: 155, y: 202, text: 'Dana', rank: 20, width: 46, dot: false });
  tidyWords(map, null);
  const placed = [lost, seen, who].filter(shown).map((el) => el.getBoundingClientRect());
  expect(shown(lost)).toBe(true);
  expect(shown(seen)).toBe(true);
  for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) expect(meet(placed[i], placed[j])).toBe(false);
  const covers = [...document.querySelectorAll('[data-map-cover]')].map((el) => el.getBoundingClientRect());
  for (const box of placed) for (const c of covers) expect(meet(box, c)).toBe(false);
});

test('a label that fits nowhere is left off, and comes back when there is room', () => {
  const map = holder();
  // The key open over the whole strip: nothing can be read, so nothing is drawn half under it.
  const key = cover('0,92,375,311');
  cover('0,311,375,667');
  const lost = mark(map, { x: 150, y: 200, text: 'Lost here Fri 12:48 am', rank: 60, width: 154 });
  tidyWords(map, null);
  expect(shown(lost)).toBe(false);
  key.remove();
  tidyWords(map, null);
  expect(shown(lost)).toBe(true);
});

test('the map\'s own credit is kept clear too', () => {
  const map = holder();
  const credit = document.createElement('div');
  credit.dataset.box = '189,285,375,302';
  const seen = mark(map, { x: 260, y: 290, text: 'Seen 8:54 pm', rank: 50, width: 104 });
  tidyWords(map, { attributionControl: { getContainer: () => credit } });
  expect(shown(seen)).toBe(true);
  expect(meet(seen.getBoundingClientRect(), credit.getBoundingClientRect())).toBe(false);
});
