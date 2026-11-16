/** @jest-environment jsdom */
/**
 * The search screen once the pet is home (Home in
 * app/mission-control/steps/Helper.js), rendered.
 *
 * Testing found a reunion from two days ago read "home at 7:48 pm" with no
 * day, and the owner read their own reunion in the third person, under a
 * button asking them to sign up for alerts about other people's pets.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, className }) => <a href={href} className={className}>{children}</a> }));

import { Home } from '@/app/mission-control/steps/Helper';

// Monday 16 November 2026, noon in Austin. Pip was marked home on the Saturday evening.
const NOW = new Date('2026-11-16T18:00:00Z').getTime();
const SATURDAY = '2026-11-15T01:48:00Z';
const picture = (over = {}) => ({
  pet: { name: 'Pip' },
  reunited: true,
  open: false,
  resolvedAt: SATURDAY,
  timeZone: 'America/Chicago',
  searched: { areas: 5, streets: 0, blocks: 0, people: 9, mine: false },
  viewer: { isOwner: false },
  ...over,
});
const show = (over) => render(<Home picture={picture(over)} name="Pip" owner={{ firstName: 'Avery' }} petHref="/cases/AUS-2026-0042" now={NOW} />);

test('a reunion from two days ago says its day as well as its time', () => {
  show();
  expect(screen.getByText('Avery marked Pip home on Sat at 7:48 pm. The search is over.')).toBeTruthy();
  expect(screen.queryByText(/home at 7:48 pm/)).toBeNull();
});

test('a reunion today says its time alone', () => {
  show({ resolvedAt: '2026-11-16T16:10:00Z' });
  expect(screen.getByText('Avery marked Pip home at 10:10 am. The search is over.')).toBeTruthy();
});

test('a helper is counted with the others and thanked, and offered alerts for the next pet', () => {
  show({ searched: { areas: 5, streets: 0, blocks: 0, people: 9, mine: true } });
  expect(screen.getByText('9 people searched 5 areas. You were one of them. Thank you.')).toBeTruthy();
  expect(screen.getByText('Alert me when a pet is lost near me')).toBeTruthy();
  expect(screen.getByText("Open Pip's page").closest('a').getAttribute('href')).toBe('/cases/AUS-2026-0042');
});

test('the owner reads their own reunion as theirs, with how many people helped them', () => {
  show({ viewer: { isOwner: true } });
  expect(screen.getByText('You marked Pip home on Sat at 7:48 pm. The search is over.')).toBeTruthy();
  expect(screen.getByText('9 people helped you search 5 areas.')).toBeTruthy();
  expect(screen.queryByText(/Avery marked/)).toBeNull();
  expect(screen.queryByText(/You were one of them/)).toBeNull();
});

test('the owner is not asked to sign up for alerts about other pets, and keeps the way to their pet\'s page', () => {
  show({ viewer: { isOwner: true } });
  expect(screen.queryByText('Alert me when a pet is lost near me')).toBeNull();
  expect(screen.getByText("Open Pip's page").closest('a').getAttribute('href')).toBe('/cases/AUS-2026-0042');
});

test('an owner who closed the search reads that they did, and when', () => {
  show({ reunited: false, viewer: { isOwner: true } });
  expect(screen.getByText('You closed this search on Sat at 7:48 pm.')).toBeTruthy();
});
