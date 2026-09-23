/** @jest-environment jsdom */

/**
 * A reaction floats up, holds, and goes, once.
 *
 * Each toast was keyed on its place in the list. When the oldest one
 * was cleared, every toast after it moved up a place, got a new key,
 * and was mounted again, so its arrival played a second time while it
 * should have been sitting still. Now the arrival is a four-second
 * animation (pe-reaction in motion.css), and a remount would restart
 * the whole thing: a reaction that has already faded would pop back.
 */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { ReactionToasts } from '@/app/geo/components/rooms/RoomPanels';

const fs = require('fs');
const path = require('path');

const players = [
  { id: 'p1', name: 'Kevin', color: '#f00' },
  { id: 'p2', name: 'Ana', color: '#0f0' },
];

afterEach(() => { jest.useRealTimers(); });

test('a toast that is still showing is not mounted again when an older one goes', () => {
  jest.useFakeTimers();
  const start = Date.now();
  const first = { at: start + 1, p: 'p1', e: '🔥', n: 'Kevin' };
  const second = { at: start + 2, p: 'p2', e: '😂', n: 'Ana' };
  const view = render(<ReactionToasts reactions={[first]} players={players} />);
  expect(screen.getByText('Kevin').closest('.pe-reaction')).toBeInTheDocument();

  act(() => { jest.advanceTimersByTime(2000); });
  view.rerender(<ReactionToasts reactions={[first, second]} players={players} />);
  const ana = screen.getByText('Ana').closest('.pe-reaction');

  // The first toast's four seconds are up; it is cleared and the second
  // moves to the head of the list.
  act(() => { jest.advanceTimersByTime(2300); });
  expect(screen.queryByText('Kevin')).toBeNull();
  expect(screen.getByText('Ana').closest('.pe-reaction')).toBe(ana);
});

test('the animation lasts as long as the toast', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../app/geo/motion.css'), 'utf8');
  const panels = fs.readFileSync(path.resolve(__dirname, '../../app/geo/components/rooms/RoomPanels.js'), 'utf8');
  expect(css).toMatch(/\.pe-reaction \{\s*animation: pe-reaction 4s linear forwards;/);
  expect(panels).toMatch(/Date\.now\(\) - r\.shownAt < 4000/);
});
