/** @jest-environment jsdom */
/**
 * The dashboard (app/dashboard/page.js), rendered: an owner's own missing
 * pet leads the page whether or not they ever saved a profile for it.
 *
 * Testing found an owner who reported Pip, with no saved pet profile, saw
 * nothing about Pip: the missing-pet cards were built from saved profiles
 * alone. The owner's open lost reports are in `missions` (isOwner), and
 * now lead the page too, each with a way into the search.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next-auth/react', () => ({ __esModule: true, useSession: () => ({ data: { user: { id: 'u-avery', name: 'Avery Stone' } }, status: 'authenticated' }) }));
jest.mock('next/navigation', () => ({ __esModule: true, useRouter: () => ({ push: jest.fn() }), useSearchParams: () => ({ get: () => null }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, className }) => <a href={href} className={className}>{children}</a> }));

import DashboardPage from '@/app/dashboard/page';

const mission = (over = {}) => ({
  id: 'case-pip', missionNumber: 'AUS-2026-0042', petName: 'Pip', petSpecies: 'DOG', petPhotoUrl: null,
  hoursMissing: 50, sightings: 2, status: 'IN_PROGRESS', isOwner: true, squadsHelping: [], totalVolunteers: 0, ...over,
});

function serve(data) {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: { firstName: 'Avery' }, pets: [], squads: [], missions: [], nearbyAlerts: [], activeSearches: [], forcePets: [], ...data }) }));
}

afterEach(() => {
  delete global.fetch;
});

test('an owner who reported Pip and saved no profile sees Pip first, with the search one tap away', async () => {
  serve({ missions: [mission()] });
  render(<DashboardPage />);
  expect(await screen.findByText('Pip has been missing 2d')).toBeTruthy();
  expect(screen.getByText("Pip still isn't home.")).toBeTruthy();
  expect(screen.getByText(/Mission AUS-2026-0042 · 2 sightings/)).toBeTruthy();
  const open = screen.getByText('Open search').closest('a');
  expect(open.getAttribute('href')).toBe('/mission-control?mission=AUS-2026-0042');
  // The card itself opens the pet's page, where the owner's own tools are.
  expect(screen.getByText('Pip has been missing 2d').closest('a').getAttribute('href')).toBe('/cases/AUS-2026-0042');
});

test('a saved pet with an open report is shown once, by its profile', async () => {
  serve({
    pets: [{ id: 'pet-pip', name: 'Pip', species: 'DOG', primaryPhotoUrl: null, hasPhoto: false, missing: { caseId: 'case-pip', caseNumber: 'AUS-2026-0042', status: 'IN_PROGRESS', hoursMissing: 50 } }],
    missions: [mission()],
  });
  render(<DashboardPage />);
  expect(await screen.findByText('Pip has been missing 2d')).toBeTruthy();
  expect(screen.getAllByText('Open search')).toHaveLength(1);
});

test('a search someone else owns is not shown as the person\'s own missing pet', async () => {
  serve({ missions: [mission({ isOwner: false, myAreas: 4 })], pets: [{ id: 'pet-bo', name: 'Bo', species: 'CAT', primaryPhotoUrl: null, hasPhoto: true, missing: null }] });
  render(<DashboardPage />);
  expect(await screen.findByText('Searches you joined')).toBeTruthy();
  expect(screen.queryByText('Open search')).toBeNull();
  expect(screen.getByText(/you searched 4 areas/)).toBeTruthy();
});
